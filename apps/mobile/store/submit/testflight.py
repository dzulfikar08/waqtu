#!/usr/bin/env python3
"""Invites people to TestFlight for Waqtu (iPhone) or Waqtu for Mac with the newest (or a given) processed build.

Run by .github/workflows/testflight-invite.yml. Idempotent: a rerun reuses groups, testers and the review submission.
App Store Connect users go into the internal group "Owner" (access to all builds, no Beta App Review); everyone else goes
into the external group "Family", which needs the build approved by Beta App Review before the invite email goes out.

Environment:
  STORE_PLATFORM                            "ios" (default) or "mac"; picks the app like appstore.py
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH   App Store Connect API key (.p8 file path)
  TESTFLIGHT_EMAILS                         comma or whitespace separated email addresses
  BUILD_NUMBER                              CFBundleVersion to use (default: newest build)
  GRANT_APP_ACCESS                          "true": an App Store Connect user who cannot see this app gets access to it
                                            (visibleApps) so they can join the internal group instead of Family
  REVIEW_ACCOUNT_PASSWORD, REVIEW_CONTACT_PHONE
  GITHUB_STEP_SUMMARY                       optional
"""

import os
import re
import sys
import time

import appstore as a
from appstore import APP_ID, Asc, AscError, note, ref

INTERNAL_GROUP = "Owner"
EXTERNAL_GROUP = "Family"
PROCESSING_TIMEOUT = 45 * 60
WHATS_NEW = "Testing build."


def newest_build(asc: Asc) -> dict:
    wanted = os.environ.get("BUILD_NUMBER", "").strip()
    params = {
        "filter[app]": APP_ID,
        "filter[preReleaseVersion.platform]": a.ASC_PLATFORM,
        "filter[expired]": "false",
        "sort": "-uploadedDate",
        "limit": 10,
    }
    if wanted:
        params["filter[version]"] = wanted
    deadline = time.time() + PROCESSING_TIMEOUT
    while True:
        builds = asc.get("/v1/builds", **params)["data"]
        if builds:
            build = builds[0]
            state = build["attributes"]["processingState"]
            if state == "VALID":
                return build
            if state in ("FAILED", "INVALID"):
                raise SystemExit(f"Build {build['attributes']['version']} processing {state}")
            a.log(f"Build {build['attributes']['version']} is {state}; waiting")
        else:
            a.log("No build uploaded yet; waiting")
        if time.time() > deadline:
            raise SystemExit("Timed out waiting for a VALID build")
        time.sleep(30)


def set_export_compliance(asc: Asc, build: dict) -> dict:
    # Both apps declare ITSAppUsesNonExemptEncryption = NO (HTTPS only), so the build normally has the answer already.
    if build["attributes"].get("usesNonExemptEncryption") is None:
        asc.patch(
            f"/v1/builds/{build['id']}",
            {"data": {"type": "builds", "id": build["id"], "attributes": {"usesNonExemptEncryption": False}}},
        )
        note("Export compliance: usesNonExemptEncryption=false (HTTPS only)")
    else:
        note(f"Export compliance: already answered ({build['attributes']['usesNonExemptEncryption']})")
    return build


def grant_app_access(asc: Asc, user: dict) -> None:
    if user["attributes"].get("allAppsVisible"):
        return
    visible = {a_["id"] for a_ in asc.all(f"/v1/users/{user['id']}/visibleApps")}
    if APP_ID in visible:
        return
    asc.post(f"/v1/users/{user['id']}/relationships/visibleApps", {"data": [{"type": "apps", "id": APP_ID}]})
    note(f"{user['attributes']['username']}: granted access to app {APP_ID}")


def send_invitation(asc: Asc, email: str, group: dict) -> None:
    """Internal testers get the invite email from an explicit invitation; a repeat is refused and harmless."""
    for tester in asc.all("/v1/betaTesters", **{"filter[email]": email}):
        if any(g["id"] == group["id"] for g in asc.all(f"/v1/betaTesters/{tester['id']}/betaGroups")):
            try:
                asc.post(
                    "/v1/betaTesterInvitations",
                    {
                        "data": {
                            "type": "betaTesterInvitations",
                            "relationships": {"app": ref("apps", APP_ID), "betaTester": ref("betaTesters", tester["id"])},
                        }
                    },
                )
                note(f"{email}: invitation email sent")
            except AscError as e:
                if e.status != 409:
                    raise
                note(f"{email}: invitation not re-sent ({e.body['errors'][0].get('detail')})")
            return


def ensure_group(asc: Asc, name: str, internal: bool) -> dict:
    for g in asc.all(f"/v1/apps/{APP_ID}/betaGroups"):
        if g["attributes"]["name"] == name:
            return g
    attributes = {"name": name, "isInternalGroup": internal}
    if internal:
        attributes["hasAccessToAllBuilds"] = True
    else:
        attributes["publicLinkEnabled"] = False
    g = asc.post(
        "/v1/betaGroups",
        {"data": {"type": "betaGroups", "attributes": attributes, "relationships": {"app": ref("apps", APP_ID)}}},
    )["data"]
    note(f"Created {'internal' if internal else 'external'} beta group {name}")
    return g


def asc_users(asc: Asc) -> dict[str, dict]:
    return {u["attributes"]["username"].lower(): u for u in asc.all("/v1/users")}


def tester_app_group(asc: Asc, testers: list[dict]) -> dict | None:
    """The group of this app (Owner or Family) one of these tester records already belongs to, if any."""
    mine = {g["id"]: g for g in asc.all(f"/v1/apps/{APP_ID}/betaGroups")}
    for tester in testers:
        for g in asc.all(f"/v1/betaTesters/{tester['id']}/betaGroups"):
            if g["id"] in mine:
                return mine[g["id"]]
    return None


def ensure_tester(asc: Asc, email: str, group: dict, user: dict | None) -> dict:
    """Puts the email into `group`; returns the group of this app the tester is in afterwards (already a member of
    Owner or Family counts as done).

    Beta tester records are per app: the same email has one record for every app it tests, and a record of another
    app cannot be assigned to this app's groups ("Tester(s) cannot be assigned"). So only a record already in one of
    this app's groups counts; otherwise a new record is created with the group.
    """
    current = tester_app_group(asc, asc.all("/v1/betaTesters", **{"filter[email]": email}))
    if current:
        return current
    attributes = {"email": email}
    if user:
        attributes["firstName"] = user["attributes"].get("firstName") or ""
        attributes["lastName"] = user["attributes"].get("lastName") or ""
    asc.post(
        "/v1/betaTesters",
        {
            "data": {
                "type": "betaTesters",
                "attributes": attributes,
                "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": group["id"]}]}},
            }
        },
    )
    return group


def ensure_beta_review_info(asc: Asc) -> None:
    notes = (a.STORE / "appstore" / "review_notes.txt").read_text(encoding="utf-8").strip()
    attributes = {
        **a.REVIEW_CONTACT,
        "contactPhone": os.environ["REVIEW_CONTACT_PHONE"].strip(),
        "demoAccountRequired": a.DEMO_ACCOUNT is not None,
        "demoAccountName": a.DEMO_ACCOUNT or "",
        "demoAccountPassword": os.environ["REVIEW_ACCOUNT_PASSWORD"] if a.DEMO_ACCOUNT else "",
        "notes": notes,
    }
    detail = asc.get(f"/v1/apps/{APP_ID}/betaAppReviewDetail")["data"]
    asc.patch(
        f"/v1/betaAppReviewDetails/{detail['id']}",
        {"data": {"type": "betaAppReviewDetails", "id": detail["id"], "attributes": attributes}},
    )
    locs = asc.all(f"/v1/apps/{APP_ID}/betaAppLocalizations")
    loc_attrs = {
        "description": "Waqtu shows prayer times, qibla, halaqah videos and Circles. Thank you for testing.",
        "feedbackEmail": a.REVIEW_CONTACT["contactEmail"],
    }
    # The submission needs a localization in the app's primary locale (App Store Connect rejects it otherwise).
    primary = asc.get(f"/v1/apps/{APP_ID}")["data"]["attributes"]["primaryLocale"]
    have = {l["attributes"]["locale"] for l in locs}
    for locale in dict.fromkeys([primary, "en-US"]):
        if locale not in have:
            asc.post(
                "/v1/betaAppLocalizations",
                {
                    "data": {
                        "type": "betaAppLocalizations",
                        "attributes": {"locale": locale, **loc_attrs},
                        "relationships": {"app": ref("apps", APP_ID)},
                    }
                },
            )
    note("Beta App Review information filled")


def ensure_build_localization(asc: Asc, build: dict) -> None:
    locs = asc.all(f"/v1/builds/{build['id']}/betaBuildLocalizations")
    if any(l["attributes"]["locale"] == "en-US" for l in locs):
        return
    asc.post(
        "/v1/betaBuildLocalizations",
        {
            "data": {
                "type": "betaBuildLocalizations",
                "attributes": {"locale": "en-US", "whatsNew": WHATS_NEW},
                "relationships": {"build": ref("builds", build["id"])},
            }
        },
    )


def submit_beta_review(asc: Asc, build: dict) -> str:
    detail = asc.get(f"/v1/builds/{build['id']}/buildBetaDetail")["data"]
    state = detail["attributes"]["externalBuildState"]
    sub = asc.get_or_none(f"/v1/builds/{build['id']}/betaAppReviewSubmission")
    if sub:
        return f"{sub['attributes']['betaReviewState']} ({state})"
    if state != "READY_FOR_BETA_SUBMISSION":
        return state
    try:
        sub = asc.post(
            "/v1/betaAppReviewSubmissions",
            {"data": {"type": "betaAppReviewSubmissions", "relationships": {"build": ref("builds", build["id"])}}},
        )["data"]
    except AscError as e:
        if e.status == 409:
            return f"not submitted: {e}"
        raise
    return sub["attributes"]["betaReviewState"]


def main() -> None:
    emails = [e.lower() for e in re.split(r"[\s,;]+", os.environ["TESTFLIGHT_EMAILS"]) if e]
    if not emails:
        raise SystemExit("TESTFLIGHT_EMAILS is empty")
    asc = Asc()
    note(f"**{a.PLATFORM}** app {APP_ID}")
    build = set_export_compliance(asc, newest_build(asc))
    note(f"Build {build['attributes']['version']} is VALID")
    users = asc_users(asc)
    internal = [e for e in emails if e in users]
    external = [e for e in emails if e not in users]
    ensure_build_localization(asc, build)

    placed: dict[str, dict] = {}
    review = None
    if internal:
        group = ensure_group(asc, INTERNAL_GROUP, True)
        for email in internal:
            if os.environ.get("GRANT_APP_ACCESS") == "true":
                grant_app_access(asc, users[email])
            try:
                placed[email] = ensure_tester(asc, email, group, users[email])
            except AscError as e:
                # A tester record from another app can be refused by every internal path; Family accepts it.
                if e.status != 409:
                    raise
                note(f"{email}: cannot join internal group {INTERNAL_GROUP}; using external")
                external.append(email)

    if external:
        group = ensure_group(asc, EXTERNAL_GROUP, False)
        attached = {b["id"] for b in asc.all(f"/v1/betaGroups/{group['id']}/builds")}
        if build["id"] not in attached:
            asc.post(
                f"/v1/betaGroups/{group['id']}/relationships/builds",
                {"data": [{"type": "builds", "id": build["id"]}]},
            )
        ensure_beta_review_info(asc)
        review = submit_beta_review(asc, build)
        note(f"Beta App Review: {review}")
        for email in external:
            placed[email] = ensure_tester(asc, email, group, None)

    if review is None and any(not g["attributes"]["isInternalGroup"] for g in placed.values()):
        review = submit_beta_review(asc, build)
        note(f"Beta App Review: {review}")
    for email in emails:
        g = placed[email]
        name = g["attributes"]["name"]
        if g["attributes"]["isInternalGroup"]:
            send_invitation(asc, email, g)
            note(f"{email}: internal ({name}); invite sent, no Beta App Review needed")
        else:
            note(f"{email}: external ({name}); invite goes out once Beta App Review approves ({review})")


if __name__ == "__main__":
    try:
        main()
    except AscError as e:
        print(e, file=sys.stderr)
        raise SystemExit(1)
    finally:
        path = os.environ.get("GITHUB_STEP_SUMMARY")
        if path:
            with open(path, "a", encoding="utf-8") as f:
                f.write("\n".join(f"- {line}" for line in a.summary) + "\n")
