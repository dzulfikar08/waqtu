#!/usr/bin/env python3
"""Fills the App Store version of Waqtu from apps/mobile/store and submits it to App Review.

Run by .github/workflows/store-submit.yml. Everything goes through the App Store Connect API and is idempotent: a rerun
updates what differs and skips what is already in place.

Environment:
  ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH   App Store Connect API key (.p8 file path)
  BUILD_NUMBER                              CFBundleVersion of the build to submit (app.json ios.buildNumber)
  SCREENSHOTS_DIR                           unpacked screenshots-ios-iphone-pro-max artifact
  REVIEW_ACCOUNT_PASSWORD, REVIEW_CONTACT_PHONE
  SUBMIT                                    "true" submits the review submission; anything else stops before it
  GITHUB_STEP_SUMMARY                       optional, the final state table goes there
"""

import hashlib
import os
import sys
import tempfile
import time
from pathlib import Path

import jwt
import requests
from PIL import Image

API = "https://api.appstoreconnect.apple.com"
APP_ID = "6826628861"
STORE = Path(__file__).resolve().parents[1]
# store/appstore/<folder> -> App Store Connect locale; the first one is the primary locale.
LOCALES = {"id": "id", "en": "en-US"}
PRIMARY_LOCALE = "id"
COPYRIGHT = "2026 JoyoDigitama"
PRIMARY_CATEGORY = "LIFESTYLE"
SECONDARY_CATEGORY = "PRODUCTIVITY"
# 1320x2868 (6.9") screenshots go in the 6.7" set, the one App Store Connect requires for iPhone.
SCREENSHOT_TYPE = "APP_IPHONE_67"
REVIEW_CONTACT = {
    "contactFirstName": "Dzulfikar",
    "contactLastName": "Ats Tsauri",
    "contactEmail": "dzulfikar.at@gmail.com",
}
DEMO_ACCOUNT = "review@getwaqtu.com"
# Halaqah videos are YouTube embeds of third-party channels played through the official YouTube player, which YouTube's
# terms allow; the app also shows third-party prayer-time methods. So the honest answer is "uses third-party content"
# (with the rights to do so), not "does not use".
CONTENT_RIGHTS = "USES_THIRD_PARTY_CONTENT"
# Age rating questionnaire. Nothing objectionable; Circles let signed-in Premium users post text and voice notes to
# other members (user-generated content and messaging, moderated with report and block).
AGE_RATING = {
    "alcoholTobaccoOrDrugUseOrReferences": "NONE",
    "contests": "NONE",
    "gamblingSimulated": "NONE",
    "gunsOrOtherWeapons": "NONE",
    "horrorOrFearThemes": "NONE",
    "matureOrSuggestiveThemes": "NONE",
    "medicalOrTreatmentInformation": "NONE",
    "profanityOrCrudeHumor": "NONE",
    "sexualContentGraphicAndNudity": "NONE",
    "sexualContentOrNudity": "NONE",
    "violenceCartoonOrFantasy": "NONE",
    "violenceRealistic": "NONE",
    "violenceRealisticProlongedGraphicOrSadistic": "NONE",
    "gambling": False,
    "lootBox": False,
    "unrestrictedWebAccess": False,
    "advertising": False,
    "ageAssurance": False,
    "healthOrWellnessTopics": False,
    "parentalControls": False,
    "socialMedia": False,
    "userGeneratedContent": True,
    "messagingAndChat": True,
}
# Used only when a subscription or its group has no localization for a locale yet.
SUBSCRIPTION_TEXT = {
    "dat.waqtu.premium.monthly": {
        "id": ("Waqtu Premium Bulanan", "Sinkron antarperangkat dan Lingkaran halaqah"),
        "en-US": ("Waqtu Premium Monthly", "Sync across devices and halaqah Circles"),
    },
    "dat.waqtu.premium.yearly": {
        "id": ("Waqtu Premium Tahunan", "Sinkron antarperangkat dan Lingkaran halaqah"),
        "en-US": ("Waqtu Premium Yearly", "Sync across devices and halaqah Circles"),
    },
}
GROUP_NAME = "Waqtu Premium"
EDITABLE_VERSION_STATES = {
    "PREPARE_FOR_SUBMISSION",
    "READY_FOR_REVIEW",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
}
SUBMITTED_VERSION_STATES = {"WAITING_FOR_REVIEW", "IN_REVIEW"}

summary: list[str] = []


def log(message: str) -> None:
    print(message, flush=True)


def note(message: str) -> None:
    log(message)
    summary.append(message)


class AscError(Exception):
    def __init__(self, method: str, path: str, status: int, body: dict | str):
        self.status = status
        self.body = body
        errors = body.get("errors", []) if isinstance(body, dict) else []
        if errors:
            detail = "; ".join(
                f"{e.get('code')}: {e.get('title')} - {e.get('detail')}"
                + (f" {e['meta']}" if e.get("meta") else "")
                for e in errors
            )
        else:
            detail = str(body)[:2000]
        super().__init__(f"{method} {path} -> {status}: {detail}")


class Asc:
    def __init__(self) -> None:
        self.key_id = os.environ["ASC_KEY_ID"]
        self.issuer = os.environ["ASC_ISSUER_ID"]
        self.key = Path(os.environ["ASC_KEY_PATH"]).read_text()
        self.token = ""
        self.expires = 0.0
        self.http = requests.Session()

    def auth(self) -> str:
        now = time.time()
        if now > self.expires - 60:
            self.expires = now + 15 * 60
            self.token = jwt.encode(
                {"iss": self.issuer, "iat": int(now), "exp": int(self.expires), "aud": "appstoreconnect-v1"},
                self.key,
                algorithm="ES256",
                headers={"kid": self.key_id, "typ": "JWT"},
            )
        return self.token

    def request(self, method: str, path: str, body: dict | None = None, params: dict | None = None):
        url = path if path.startswith("http") else API + path
        for attempt in range(5):
            r = self.http.request(
                method,
                url,
                json=body,
                params=params,
                headers={"Authorization": f"Bearer {self.auth()}"},
                timeout=120,
            )
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(5 * (attempt + 1))
                continue
            break
        if r.status_code >= 400:
            try:
                parsed = r.json()
            except ValueError:
                parsed = r.text
            raise AscError(method, path, r.status_code, parsed)
        return r.json() if r.content else None

    def get(self, path: str, **params):
        return self.request("GET", path, params=params or None)

    def get_or_none(self, path: str, **params):
        try:
            return self.get(path, **params)["data"]
        except AscError as e:
            if e.status == 404:
                return None
            raise

    def all(self, path: str, **params) -> list[dict]:
        params.setdefault("limit", 200)
        page = self.get(path, **params)
        items = list(page["data"])
        while page.get("links", {}).get("next"):
            page = self.get(page["links"]["next"])
            items += page["data"]
        return items

    def post(self, path: str, body: dict):
        return self.request("POST", path, body)

    def patch(self, path: str, body: dict):
        return self.request("PATCH", path, body)

    def delete(self, path: str):
        return self.request("DELETE", path)


def text(folder: str, name: str) -> str:
    return (STORE / "appstore" / folder / f"{name}.txt").read_text(encoding="utf-8").strip()


def ref(kind: str, id_: str) -> dict:
    return {"data": {"type": kind, "id": id_}}


def find_version(asc: Asc) -> dict:
    versions = asc.all(f"/v1/apps/{APP_ID}/appStoreVersions", **{"filter[platform]": "IOS"})
    for v in versions:
        state = v["attributes"].get("appVersionState") or v["attributes"].get("appStoreState")
        if state in EDITABLE_VERSION_STATES | SUBMITTED_VERSION_STATES:
            return v
    raise SystemExit(
        "No App Store version in an editable state: "
        + ", ".join(f"{v['attributes']['versionString']}={v['attributes'].get('appVersionState')}" for v in versions)
    )


def version_state(v: dict) -> str:
    return v["attributes"].get("appVersionState") or v["attributes"].get("appStoreState")


def wait_for_build(asc: Asc, number: str, wait: bool) -> tuple[dict, str] | None:
    """The processed build with this CFBundleVersion and its marketing version; None when not ready and not waiting."""
    deadline = time.time() + 90 * 60
    while True:
        page = asc.get(
            "/v1/builds",
            **{
                "filter[app]": APP_ID,
                "filter[version]": number,
                "filter[preReleaseVersion.platform]": "IOS",
                "include": "preReleaseVersion",
                "limit": 5,
            },
        )
        if page["data"]:
            build = page["data"][0]
            pre = next(
                (i for i in page.get("included", []) if i["type"] == "preReleaseVersions"),
                None,
            )
            marketing = pre["attributes"]["version"] if pre else ""
            state = build["attributes"]["processingState"]
            log(f"Build {number} ({marketing}): {state}")
            if state == "VALID":
                return build, marketing
            if state in ("FAILED", "INVALID"):
                raise SystemExit(f"Build {number} is {state}")
        else:
            log(f"Build {number} not visible yet")
        if not wait:
            return None
        if time.time() > deadline:
            raise SystemExit(f"Build {number} did not finish processing within 90 minutes")
        time.sleep(60)


def attach_build(asc: Asc, version: dict, wait: bool) -> None:
    number = os.environ["BUILD_NUMBER"]
    found = wait_for_build(asc, number, wait)
    if found is None:
        note(f"Build {number} is not processed yet; not attached (dry run)")
        return
    build, marketing = found
    vid = version["id"]
    if marketing and version["attributes"]["versionString"] != marketing:
        asc.patch(
            f"/v1/appStoreVersions/{vid}",
            {"data": {"type": "appStoreVersions", "id": vid, "attributes": {"versionString": marketing}}},
        )
        note(f"Version string set to {marketing} to match build {number}")
    if build["attributes"].get("usesNonExemptEncryption") is None:
        asc.patch(
            f"/v1/builds/{build['id']}",
            {"data": {"type": "builds", "id": build["id"], "attributes": {"usesNonExemptEncryption": False}}},
        )
        log("Export compliance: build marked as not using non-exempt encryption")
    current = asc.get_or_none(f"/v1/appStoreVersions/{vid}/build")
    if not current or current["id"] != build["id"]:
        asc.patch(f"/v1/appStoreVersions/{vid}/relationships/build", ref("builds", build["id"]))
    note(f"Build: {marketing} ({number})")


def update_version_attributes(asc: Asc, vid: str) -> None:
    asc.patch(
        f"/v1/appStoreVersions/{vid}",
        {"data": {"type": "appStoreVersions", "id": vid, "attributes": {"copyright": COPYRIGHT}}},
    )
    try:
        asc.patch(
            f"/v1/appStoreVersions/{vid}",
            {"data": {"type": "appStoreVersions", "id": vid, "attributes": {"usesIdfa": False}}},
        )
    except AscError as e:
        # Apple moved the advertising identifier question into App Privacy; the attribute may be read-only now.
        log(f"usesIdfa not settable (covered by App Privacy): {e}")


def editable_app_info(asc: Asc) -> dict:
    infos = asc.all(f"/v1/apps/{APP_ID}/appInfos")
    live = {"READY_FOR_DISTRIBUTION", "READY_FOR_SALE", "REPLACED_WITH_NEW_INFO"}
    for info in infos:
        state = info["attributes"].get("state") or info["attributes"].get("appStoreState")
        if state not in live:
            return info
    return infos[0]


def upsert_localizations(asc: Asc, list_path: str, kind: str, parent: str, parent_kind: str, wanted: dict) -> dict:
    """wanted: locale -> attributes. Returns locale -> localization id."""
    existing = {loc["attributes"]["locale"]: loc for loc in asc.all(list_path)}
    ids = {}
    for locale, attributes in wanted.items():
        if locale in existing:
            loc = existing[locale]
            changed = {k: v for k, v in attributes.items() if loc["attributes"].get(k) != v}
            if changed:
                asc.patch(f"/v1/{kind}/{loc['id']}", {"data": {"type": kind, "id": loc["id"], "attributes": changed}})
                log(f"{kind} {locale}: updated {', '.join(sorted(changed))}")
            ids[locale] = loc["id"]
        else:
            created = asc.post(
                f"/v1/{kind}",
                {
                    "data": {
                        "type": kind,
                        "attributes": {"locale": locale, **attributes},
                        "relationships": {parent: ref(parent_kind, parent_id_of(list_path))},
                    }
                },
            )
            log(f"{kind} {locale}: created")
            ids[locale] = created["data"]["id"]
    return ids


def parent_id_of(list_path: str) -> str:
    # /v1/<parents>/<id>/<children>
    return list_path.strip("/").split("/")[2]


def update_app_info(asc: Asc, info: dict) -> None:
    upsert_localizations(
        asc,
        f"/v1/appInfos/{info['id']}/appInfoLocalizations",
        "appInfoLocalizations",
        "appInfo",
        "appInfos",
        {
            locale: {
                "name": text(folder, "name"),
                "subtitle": text(folder, "subtitle"),
                "privacyPolicyUrl": text(folder, "privacy_url"),
            }
            for folder, locale in LOCALES.items()
        },
    )
    asc.patch(
        f"/v1/apps/{APP_ID}",
        {
            "data": {
                "type": "apps",
                "id": APP_ID,
                "attributes": {"primaryLocale": PRIMARY_LOCALE, "contentRightsDeclaration": CONTENT_RIGHTS},
            }
        },
    )
    asc.patch(
        f"/v1/appInfos/{info['id']}",
        {
            "data": {
                "type": "appInfos",
                "id": info["id"],
                "relationships": {
                    "primaryCategory": ref("appCategories", PRIMARY_CATEGORY),
                    "secondaryCategory": ref("appCategories", SECONDARY_CATEGORY),
                },
            }
        },
    )
    note(f"App info: primary locale {PRIMARY_LOCALE}, {PRIMARY_CATEGORY}/{SECONDARY_CATEGORY}, {CONTENT_RIGHTS}")

    declaration = asc.get_or_none(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")
    if declaration is None:
        raise SystemExit("App info has no age rating declaration")
    asc.patch(
        f"/v1/ageRatingDeclarations/{declaration['id']}",
        {"data": {"type": "ageRatingDeclarations", "id": declaration["id"], "attributes": AGE_RATING}},
    )
    info = asc.get(f"/v1/appInfos/{info['id']}")["data"]
    note(f"Age rating: {info['attributes'].get('appStoreAgeRating')}")


def update_version_localizations(asc: Asc, vid: str) -> dict:
    return upsert_localizations(
        asc,
        f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations",
        "appStoreVersionLocalizations",
        "appStoreVersion",
        "appStoreVersions",
        {
            locale: {
                "description": text(folder, "description"),
                "keywords": text(folder, "keywords"),
                "promotionalText": text(folder, "promotional_text"),
                "supportUrl": text(folder, "support_url"),
                "marketingUrl": text(folder, "marketing_url"),
            }
            for folder, locale in LOCALES.items()
        },
    )


def screenshot_dir() -> Path:
    root = Path(os.environ["SCREENSHOTS_DIR"])
    hits = sorted(root.rglob("id-01-*.png"), key=lambda p: len(p.parts))
    hits = [p for p in hits if not any(part.startswith(("maestro-", "review")) for part in p.relative_to(root).parts)]
    if not hits:
        raise SystemExit(f"No store screenshots under {root}")
    return hits[0].parent


def flattened(src: Path, out_dir: Path) -> Path:
    """App Store Connect refuses images with an alpha channel; store an opaque RGB copy."""
    dest = out_dir / src.name
    with Image.open(src) as image:
        image.convert("RGB").save(dest, format="PNG", optimize=True)
    return dest


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def upload_asset(asc: Asc, kind: str, relationship: str, parent_kind: str, parent_id: str, path: Path) -> str:
    data = path.read_bytes()
    created = asc.post(
        f"/v1/{kind}",
        {
            "data": {
                "type": kind,
                "attributes": {"fileName": path.name, "fileSize": len(data)},
                "relationships": {relationship: ref(parent_kind, parent_id)},
            }
        },
    )["data"]
    for op in created["attributes"]["uploadOperations"]:
        headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        chunk = data[op["offset"] : op["offset"] + op["length"]]
        r = requests.request(op["method"], op["url"], data=chunk, headers=headers, timeout=300)
        r.raise_for_status()
    asc.patch(
        f"/v1/{kind}/{created['id']}",
        {
            "data": {
                "type": kind,
                "id": created["id"],
                "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()},
            }
        },
    )
    return created["id"]


def wait_for_assets(asc: Asc, kind: str, assets: dict) -> None:
    """Polls uploaded assets (id -> file name) until App Store Connect has processed all of them."""
    pending = dict(assets)
    deadline = time.time() + 30 * 60
    last = None
    while pending:
        states = {}
        for id_, name in list(pending.items()):
            state = asc.get(f"/v1/{kind}/{id_}")["data"]["attributes"].get("assetDeliveryState") or {}
            if state.get("state") == "COMPLETE":
                del pending[id_]
            elif state.get("state") == "FAILED":
                raise SystemExit(f"{kind} {name} failed: {state.get('errors')}")
            else:
                states[name] = state.get("state")
        if not pending:
            return
        if states != last:
            log(f"{kind}: processing {states}")
            last = states
        if time.time() > deadline:
            raise SystemExit(f"{kind} not processed within 30 minutes: {sorted(pending.values())}")
        time.sleep(30)


def update_screenshots(asc: Asc, localization_ids: dict) -> None:
    source = screenshot_dir()
    uploaded = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        for folder, locale in LOCALES.items():
            files = [flattened(p, tmp_dir) for p in sorted(source.glob(f"{folder}-[0-9][0-9]-*.png"))][:10]
            if not files:
                raise SystemExit(f"No {folder} screenshots in {source}")
            lid = localization_ids[locale]
            sets = asc.all(f"/v1/appStoreVersionLocalizations/{lid}/appScreenshotSets")
            shot_set = next((s for s in sets if s["attributes"]["screenshotDisplayType"] == SCREENSHOT_TYPE), None)
            if shot_set is None:
                shot_set = asc.post(
                    "/v1/appScreenshotSets",
                    {
                        "data": {
                            "type": "appScreenshotSets",
                            "attributes": {"screenshotDisplayType": SCREENSHOT_TYPE},
                            "relationships": {"appStoreVersionLocalization": ref("appStoreVersionLocalizations", lid)},
                        }
                    },
                )["data"]
            current = asc.all(f"/v1/appScreenshotSets/{shot_set['id']}/appScreenshots")
            current_sums = [s["attributes"].get("sourceFileChecksum") for s in current]
            states = {(s["attributes"].get("assetDeliveryState") or {}).get("state") for s in current}
            if current_sums == [md5(f) for f in files] and states <= {"COMPLETE", "UPLOAD_COMPLETE"}:
                uploaded.update({s["id"]: s["attributes"].get("fileName") for s in current})
                note(f"Screenshots {locale}: {len(files)} already in place")
                continue
            for shot in current:
                asc.delete(f"/v1/appScreenshots/{shot['id']}")
            for f in files:
                id_ = upload_asset(asc, "appScreenshots", "appScreenshotSet", "appScreenshotSets", shot_set["id"], f)
                uploaded[id_] = f"{locale}/{f.name}"
            note(f"Screenshots {locale}: uploaded {len(files)} ({', '.join(f.name for f in files)})")
    wait_for_assets(asc, "appScreenshots", uploaded)


def update_review_detail(asc: Asc, vid: str) -> None:
    notes = (STORE / "appstore" / "review_notes.txt").read_text(encoding="utf-8").strip()
    attributes = {
        **REVIEW_CONTACT,
        "contactPhone": os.environ["REVIEW_CONTACT_PHONE"].strip(),
        "demoAccountRequired": True,
        "demoAccountName": DEMO_ACCOUNT,
        "demoAccountPassword": os.environ["REVIEW_ACCOUNT_PASSWORD"],
        "notes": notes,
    }
    detail = asc.get_or_none(f"/v1/appStoreVersions/{vid}/appStoreReviewDetail")
    if detail:
        asc.patch(
            f"/v1/appStoreReviewDetails/{detail['id']}",
            {"data": {"type": "appStoreReviewDetails", "id": detail["id"], "attributes": attributes}},
        )
    else:
        asc.post(
            "/v1/appStoreReviewDetails",
            {
                "data": {
                    "type": "appStoreReviewDetails",
                    "attributes": attributes,
                    "relationships": {"appStoreVersion": ref("appStoreVersions", vid)},
                }
            },
        )
    note(f"App Review information: contact {REVIEW_CONTACT['contactEmail']}, demo account {DEMO_ACCOUNT}")


def ensure_free(asc: Asc) -> None:
    schedule = asc.get_or_none(f"/v1/apps/{APP_ID}/appPriceSchedule")
    if schedule:
        prices = asc.get(
            f"/v1/appPriceSchedules/{schedule['id']}/manualPrices", include="appPricePoint", limit=50
        )
        points = [i for i in prices.get("included", []) if i["type"] == "appPricePoints"]
        if points and all(float(p["attributes"]["customerPrice"]) == 0 for p in points):
            note("Price: free (already set)")
            return
    points = asc.all(f"/v1/apps/{APP_ID}/appPricePoints", **{"filter[territory]": "USA"})
    free = next(p for p in points if float(p["attributes"]["customerPrice"]) == 0)
    asc.post(
        "/v1/appPriceSchedules",
        {
            "data": {
                "type": "appPriceSchedules",
                "relationships": {
                    "app": ref("apps", APP_ID),
                    "baseTerritory": ref("territories", "USA"),
                    "manualPrices": {"data": [{"type": "appPrices", "id": "${free}"}]},
                },
            },
            "included": [
                {
                    "type": "appPrices",
                    "id": "${free}",
                    "attributes": {"startDate": None},
                    "relationships": {"appPricePoint": ref("appPricePoints", free["id"])},
                }
            ],
        },
    )
    note("Price: set to free")


def ensure_availability(asc: Asc) -> None:
    availability = asc.get_or_none(f"/v1/apps/{APP_ID}/appAvailabilityV2")
    if availability:
        available = asc.all(
            f"/v2/appAvailabilities/{availability['id']}/territoryAvailabilities", **{"fields[territoryAvailabilities]": "available"}
        )
        count = sum(1 for t in available if t["attributes"].get("available"))
        note(f"Availability: {count} territories (already set)")
        return
    territories = asc.all("/v1/territories")
    asc.post(
        "/v2/appAvailabilities",
        {
            "data": {
                "type": "appAvailabilities",
                "attributes": {"availableInNewTerritories": True},
                "relationships": {
                    "app": ref("apps", APP_ID),
                    "territoryAvailabilities": {
                        "data": [{"type": "territoryAvailabilities", "id": f"${{{t['id']}}}"} for t in territories]
                    },
                },
            },
            "included": [
                {
                    "type": "territoryAvailabilities",
                    "id": f"${{{t['id']}}}",
                    "attributes": {"available": True},
                    "relationships": {"territory": ref("territories", t["id"])},
                }
                for t in territories
            ],
        },
    )
    note(f"Availability: set to all {len(territories)} territories")


def subscription_screenshot() -> Path:
    root = Path(os.environ["SCREENSHOTS_DIR"])
    for pattern in ("en-23-circles.png", "en-06-settings.png", "en-01-*.png"):
        hits = sorted(root.rglob(pattern), key=lambda p: ("light" not in p.parts, len(p.parts)))
        hits = [p for p in hits if not any(part.startswith("maestro-") for part in p.parts)]
        if hits:
            return hits[0]
    raise SystemExit("No screenshot for the subscription review")


def prepare_subscriptions(asc: Asc) -> list[dict]:
    """Completes the subscriptions' metadata. Returns [{'group'|'subscription': ..., ...}] for the summary."""
    groups = asc.all(f"/v1/apps/{APP_ID}/subscriptionGroups")
    if not groups:
        raise SystemExit("The app has no subscription group")
    result = []
    with tempfile.TemporaryDirectory() as tmp:
        shot = flattened(subscription_screenshot(), Path(tmp))
        for group in groups:
            gid = group["id"]
            existing = {l["attributes"]["locale"] for l in asc.all(f"/v1/subscriptionGroups/{gid}/subscriptionGroupLocalizations")}
            for locale in LOCALES.values():
                if locale not in existing:
                    asc.post(
                        "/v1/subscriptionGroupLocalizations",
                        {
                            "data": {
                                "type": "subscriptionGroupLocalizations",
                                "attributes": {"locale": locale, "name": GROUP_NAME},
                                "relationships": {"subscriptionGroup": ref("subscriptionGroups", gid)},
                            }
                        },
                    )
                    log(f"Group {group['attributes']['referenceName']}: localization {locale} created")
            result.append({"kind": "group", "id": gid, "name": group["attributes"]["referenceName"]})
            for sub in asc.all(f"/v1/subscriptionGroups/{gid}/subscriptions"):
                sid = sub["id"]
                product = sub["attributes"]["productId"]
                locs = {l["attributes"]["locale"] for l in asc.all(f"/v1/subscriptions/{sid}/subscriptionLocalizations")}
                for locale in LOCALES.values():
                    if locale in locs:
                        continue
                    name, description = SUBSCRIPTION_TEXT.get(product, {}).get(
                        locale, (GROUP_NAME, "Sync across devices and halaqah Circles")
                    )
                    asc.post(
                        "/v1/subscriptionLocalizations",
                        {
                            "data": {
                                "type": "subscriptionLocalizations",
                                "attributes": {"locale": locale, "name": name, "description": description},
                                "relationships": {"subscription": ref("subscriptions", sid)},
                            }
                        },
                    )
                    log(f"{product}: localization {locale} created")
                screenshot = asc.get_or_none(f"/v1/subscriptions/{sid}/appStoreReviewScreenshot")
                if not screenshot:
                    id_ = upload_asset(
                        asc, "subscriptionAppStoreReviewScreenshots", "subscription", "subscriptions", sid, shot
                    )
                    wait_for_assets(asc, "subscriptionAppStoreReviewScreenshots", {id_: shot.name})
                    log(f"{product}: review screenshot uploaded ({shot.name})")
                if not asc.get_or_none(f"/v1/subscriptions/{sid}/subscriptionAvailability"):
                    territories = asc.all("/v1/territories")
                    asc.post(
                        "/v1/subscriptionAvailabilities",
                        {
                            "data": {
                                "type": "subscriptionAvailabilities",
                                "attributes": {"availableInNewTerritories": True},
                                "relationships": {
                                    "subscription": ref("subscriptions", sid),
                                    "availableTerritories": {
                                        "data": [{"type": "territories", "id": t["id"]} for t in territories]
                                    },
                                },
                            }
                        },
                    )
                    log(f"{product}: available in all {len(territories)} territories")
                prices = asc.get(f"/v1/subscriptions/{sid}/prices", limit=1)
                if not prices["data"]:
                    log(f"::warning::{product} has no price; set it in App Store Connect")
                state = asc.get(f"/v1/subscriptions/{sid}")["data"]["attributes"]["state"]
                note(f"Subscription {product}: {state}")
                result.append({"kind": "subscription", "id": sid, "name": product, "state": state})
    return result


def draft_version(asc: Asc, path: str, create_kind: str, parent: str, parent_kind: str, parent_id: str) -> dict | None:
    """The PREPARE_FOR_SUBMISSION / READY_FOR_REVIEW version of a subscription or group, created when missing."""
    try:
        versions = asc.all(path)
    except AscError as e:
        log(f"{path}: {e}")
        versions = []
    for v in versions:
        if v["attributes"].get("state") in ("PREPARE_FOR_SUBMISSION", "READY_FOR_REVIEW"):
            return v
    if any(v["attributes"].get("state") in ("WAITING_FOR_REVIEW", "IN_REVIEW", "APPROVED", "ACCEPTED") for v in versions):
        return None
    created = asc.post(
        f"/v1/{create_kind}",
        {"data": {"type": create_kind, "relationships": {parent: ref(parent_kind, parent_id)}}},
    )["data"]
    log(f"{create_kind}: created {created['id']} for {parent_kind} {parent_id}")
    return created


def review_submission(asc: Asc, version: dict, products: list[dict], submit: bool) -> None:
    vid = version["id"]
    open_submissions = asc.all(
        "/v1/reviewSubmissions",
        **{
            "filter[app]": APP_ID,
            "filter[platform]": "IOS",
            "filter[state]": "READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES",
        },
    )
    for s in open_submissions:
        log(f"Open review submission {s['id']}: {s['attributes']['state']}")
    if any(s["attributes"]["state"] in ("WAITING_FOR_REVIEW", "IN_REVIEW") for s in open_submissions):
        note("Already submitted; nothing to do")
        return
    draft = next((s for s in open_submissions if s["attributes"]["state"] in ("READY_FOR_REVIEW", "UNRESOLVED_ISSUES")), None)
    if draft is None:
        draft = asc.post(
            "/v1/reviewSubmissions",
            {"data": {"type": "reviewSubmissions", "attributes": {"platform": "IOS"}, "relationships": {"app": ref("apps", APP_ID)}}},
        )["data"]
        log(f"Review submission {draft['id']} created")
    rid = draft["id"]
    items = asc.all(
        f"/v1/reviewSubmissions/{rid}/items",
        include="appStoreVersion,subscriptionVersion,subscriptionGroupVersion",
    )
    present = set()
    for item in items:
        for rel, value in (item.get("relationships") or {}).items():
            data = (value or {}).get("data")
            if data:
                present.add((data["type"], data["id"]))

    def add(kind: str, id_: str, rel: str, label: str) -> bool:
        if (kind, id_) in present:
            log(f"Review item {label}: already in the submission")
            return True
        try:
            asc.post(
                "/v1/reviewSubmissionItems",
                {
                    "data": {
                        "type": "reviewSubmissionItems",
                        "relationships": {"reviewSubmission": ref("reviewSubmissions", rid), rel: ref(kind, id_)},
                    }
                },
            )
            log(f"Review item {label}: added")
            return True
        except AscError as e:
            note(f"Review item {label}: NOT added: {e}")
            return False

    ok = add("appStoreVersions", vid, "appStoreVersion", f"version {version['attributes']['versionString']}")
    for p in products:
        group = p["kind"] == "group"
        if not group and p["state"] in ("WAITING_FOR_REVIEW", "IN_REVIEW", "APPROVED"):
            continue
        kind, rel, parent_kind = (
            ("subscriptionGroupVersions", "subscriptionGroupVersion", "subscriptionGroups")
            if group
            else ("subscriptionVersions", "subscriptionVersion", "subscriptions")
        )
        parent = "subscriptionGroup" if group else "subscription"
        label = f"{'group' if group else 'subscription'} {p['name']}"
        try:
            draft_v = draft_version(asc, f"/v1/{parent_kind}/{p['id']}/versions", kind, parent, parent_kind, p["id"])
            added = draft_v is None or add(kind, draft_v["id"], rel, label)
        except AscError as e:
            note(f"Review item {label}: no draft version: {e}")
            added = False
        # The group's localizations travel with its subscriptions, so only the subscriptions are required.
        if not group:
            ok = added and ok
    if not ok:
        raise SystemExit("Some items could not be added to the review submission; not submitting")
    if not submit:
        note(f"Review submission {rid} is ready (draft); submit=false, so it was not submitted")
        return
    asc.patch(
        f"/v1/reviewSubmissions/{rid}",
        {"data": {"type": "reviewSubmissions", "id": rid, "attributes": {"submitted": True}}},
    )
    note(f"Review submission {rid} submitted")


def final_state(asc: Asc, vid: str) -> None:
    version = asc.get(f"/v1/appStoreVersions/{vid}")["data"]["attributes"]
    note(
        f"Final: version {version['versionString']} appVersionState={version.get('appVersionState')}"
        f" appStoreState={version.get('appStoreState')}"
    )
    for s in asc.all("/v1/reviewSubmissions", **{"filter[app]": APP_ID, "filter[platform]": "IOS"})[:5]:
        note(f"Final: review submission {s['id']} {s['attributes']['state']} submitted {s['attributes'].get('submittedDate')}")
    for group in asc.all(f"/v1/apps/{APP_ID}/subscriptionGroups"):
        for sub in asc.all(f"/v1/subscriptionGroups/{group['id']}/subscriptions"):
            note(f"Final: subscription {sub['attributes']['productId']} {sub['attributes']['state']}")


def main() -> None:
    submit = os.environ.get("SUBMIT", "false") == "true"
    asc = Asc()
    try:
        version = find_version(asc)
        vid = version["id"]
        note(f"App Store version {version['attributes']['versionString']}: {version_state(version)}")
        if version_state(version) in SUBMITTED_VERSION_STATES:
            note("Version is already submitted; not changing it")
        else:
            attach_build(asc, version, wait=submit)
            update_version_attributes(asc, vid)
            info = editable_app_info(asc)
            update_app_info(asc, info)
            localization_ids = update_version_localizations(asc, vid)
            update_screenshots(asc, localization_ids)
            update_review_detail(asc, vid)
            ensure_free(asc)
            ensure_availability(asc)
            products = prepare_subscriptions(asc)
            review_submission(asc, version, products, submit)
        final_state(asc, vid)
    except AscError as e:
        note(f"ERROR {e}")
        raise SystemExit(1)
    finally:
        out = os.environ.get("GITHUB_STEP_SUMMARY")
        if out:
            with open(out, "a", encoding="utf-8") as f:
                f.write("## App Store\n\n" + "\n".join(f"- {line}" for line in summary) + "\n")


if __name__ == "__main__":
    sys.exit(main())
