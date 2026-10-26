#!/usr/bin/env python3
"""Updates the Google Play store listing of Waqtu from apps/mobile/store and releases a build to production.

Run by .github/workflows/store-submit.yml, through the Android Publisher API (one edit, committed at the end). With
managed publishing off, committing sends the changes to review.

Environment:
  PLAY_SERVICE_ACCOUNT_JSON   service account key (raw JSON)
  VERSION_CODE                versionCode to release (app.json android.versionCode); must already be uploaded
  VERSION_NAME                release name shown in Play Console (app.json version)
  PLAY_ASSETS_DIR             files of the play-listing-assets release (icon-512.png, feature-graphic.png,
                              phone-<id|en>-NN.png)
  SUBMIT                      "true" commits the edit; anything else validates it and throws it away
  GITHUB_STEP_SUMMARY         optional, the final state goes there
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import jwt
import requests

PACKAGE = "dat.waqtu.app"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PACKAGE}"
UPLOAD = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PACKAGE}"
STORE = Path(__file__).resolve().parents[1]
RELEASE_NOTES = {"id": "Rilis pertama", "en": "First release"}

summary: list[str] = []


def log(message: str) -> None:
    print(message, flush=True)


def note(message: str) -> None:
    log(message)
    summary.append(message)


class Play:
    def __init__(self) -> None:
        account = json.loads(os.environ["PLAY_SERVICE_ACCOUNT_JSON"])
        now = int(time.time())
        assertion = jwt.encode(
            {
                "iss": account["client_email"],
                "scope": "https://www.googleapis.com/auth/androidpublisher",
                "aud": account["token_uri"],
                "iat": now,
                "exp": now + 3600,
            },
            account["private_key"],
            algorithm="RS256",
        )
        r = requests.post(
            account["token_uri"],
            data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
            timeout=60,
        )
        r.raise_for_status()
        self.http = requests.Session()
        self.http.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    def request(self, method: str, url: str, **kwargs):
        r = self.http.request(method, url, timeout=300, **kwargs)
        if r.status_code >= 400:
            raise SystemExit(f"{method} {url.replace(API, '')} -> {r.status_code}: {r.text[:3000]}")
        return r.json() if r.content else None


def text(folder: str, name: str) -> str:
    return (STORE / "play" / folder / f"{name}.txt").read_text(encoding="utf-8").strip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def update_images(play: Play, edit: str, language: str, image_type: str, files: list[Path]) -> None:
    base = f"{API}/edits/{edit}/listings/{language}/{image_type}"
    current = play.request("GET", base).get("images", [])
    if [i.get("sha256") for i in current] == [sha256(f) for f in files]:
        log(f"{language} {image_type}: {len(files)} already in place")
        return
    if current:
        play.request("DELETE", base)
    for f in files:
        play.request(
            "POST",
            f"{UPLOAD}/edits/{edit}/listings/{language}/{image_type}",
            params={"uploadType": "media"},
            data=f.read_bytes(),
            headers={"Content-Type": "image/png"},
        )
    log(f"{language} {image_type}: uploaded {', '.join(f.name for f in files)}")


def main() -> None:
    submit = os.environ.get("SUBMIT", "false") == "true"
    version_code = os.environ["VERSION_CODE"]
    version_name = os.environ["VERSION_NAME"]
    assets = Path(os.environ["PLAY_ASSETS_DIR"])
    play = Play()
    edit = play.request("POST", f"{API}/edits", json={})["id"]
    committed = False
    try:
        details = play.request("GET", f"{API}/edits/{edit}/details")
        default = details.get("defaultLanguage", "")
        log(f"Default listing language: {default}")
        # Play lists Indonesian as "id"; the default listing is the Indonesian one.
        languages = {"id": default if default.split("-")[0] in ("id", "in") else "id", "en": "en-US"}

        for folder, language in languages.items():
            # PUT creates the listing when the language has none yet (PATCH answers 404 then).
            play.request(
                "PUT",
                f"{API}/edits/{edit}/listings/{language}",
                json={
                    "language": language,
                    "title": text(folder, "title"),
                    "shortDescription": text(folder, "short_description"),
                    "fullDescription": text(folder, "full_description"),
                },
            )
            update_images(play, edit, language, "icon", [assets / "icon-512.png"])
            update_images(play, edit, language, "featureGraphic", [assets / "feature-graphic.png"])
            phones = sorted(assets.glob(f"phone-{folder}-[0-9][0-9].png"))[:8]
            if len(phones) < 2:
                raise SystemExit(f"Need at least 2 phone screenshots for {folder}, found {len(phones)}")
            update_images(play, edit, language, "phoneScreenshots", phones)
            note(f"Listing {language}: text, icon, feature graphic, {len(phones)} phone screenshots")

        bundles = play.request("GET", f"{API}/edits/{edit}/bundles").get("bundles", [])
        codes = sorted(b["versionCode"] for b in bundles)
        log(f"Uploaded bundles: {codes}")
        if int(version_code) not in codes:
            raise SystemExit(f"versionCode {version_code} is not uploaded to Play (have {codes})")

        current = play.request("GET", f"{API}/edits/{edit}/tracks/production")
        log(f"Production before: {json.dumps(current.get('releases', []))}")
        play.request(
            "PUT",
            f"{API}/edits/{edit}/tracks/production",
            json={
                "track": "production",
                "releases": [
                    {
                        "name": version_name,
                        "versionCodes": [version_code],
                        "status": "completed",
                        "releaseNotes": [
                            {"language": languages["id"], "text": RELEASE_NOTES["id"]},
                            {"language": "en-US", "text": RELEASE_NOTES["en"]},
                        ],
                    }
                ],
            },
        )
        note(f"Production: release {version_name} ({version_code}), status completed")

        if not submit:
            play.request("POST", f"{API}/edits/{edit}:validate")
            note("Edit validated; submit=false, so it was not committed")
            return
        play.request("POST", f"{API}/edits/{edit}:commit")
        committed = True
        note("Edit committed (managed publishing is off, so the changes go to review)")

        check = play.request("POST", f"{API}/edits", json={})["id"]
        try:
            for track in ("production", "internal"):
                releases = play.request("GET", f"{API}/edits/{check}/tracks/{track}").get("releases", [])
                for r in releases:
                    note(f"Final: {track} {r.get('name')} {r.get('versionCodes')} {r.get('status')}")
        finally:
            play.request("DELETE", f"{API}/edits/{check}")
    finally:
        if not committed:
            play.request("DELETE", f"{API}/edits/{edit}")
        out = os.environ.get("GITHUB_STEP_SUMMARY")
        if out:
            with open(out, "a", encoding="utf-8") as f:
                f.write("## Google Play\n\n" + "\n".join(f"- {line}" for line in summary) + "\n")


if __name__ == "__main__":
    sys.exit(main())
