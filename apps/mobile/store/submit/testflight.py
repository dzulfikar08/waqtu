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


def ensure_tester(asc: Asc, email: str, group: dict, user: dict | None) -> str:
    """Returns the beta tester id, put into `group`."""
    found = asc.all("/v1/betaTesters", **{"filter[email]": email})
    if found:
        tester = found[0]
        a.log(f"{email}: existing beta tester {tester['id']} {tester['attributes']}")
        members = {t["id"] for t in asc.all(f"/v1/betaGroups/{group['id']}/betaTesters")}
        if tester["id"] not in members:
            asc.post(
                f"/v1/betaGroups/{group['id']}/relationships/betaTesters",
                {"data": [{"type": "betaTesters", "id": tester["id"]}]},
            )
        return tester["id"]
    attributes = {"email": email}
    if user:
        attributes["firstName"] = user["attributes"].get("firstName") or ""
        attributes["lastName"] = user["attributes"].get("lastName") or ""
    return asc.post(
        "/v1/betaTesters",
        {
            "data": {
                "type": "betaTesters",
                "attributes": attributes,
                "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": group["id"]}]}},
            }
        },
    )["data"]["id"]


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
    for e in emails:
        u = users.get(e)
        a.log(f"{e}: ASC user {u['attributes'] if u else None}")
    internal = [e for e in emails if e in users]
    external = [e for e in emails if e not in users]
    ensure_build_localization(asc, build)

    if internal:
        group = ensure_group(asc, INTERNAL_GROUP, True)
        for email in internal:
            ensure_tester(asc, email, group, users[email])
            note(f"{email}: internal ({INTERNAL_GROUP}); invite sent, no Beta App Review needed")

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
            ensure_tester(asc, email, group, None)
            note(f"{email}: external ({EXTERNAL_GROUP}); invite goes out once Beta App Review approves ({review})")


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
