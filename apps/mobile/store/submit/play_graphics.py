#!/usr/bin/env python3
"""Replaces only the hi-res icon and feature graphic of every Google Play listing language, nothing else.

Run by .github/workflows/store-submit.yml with platform=android-graphics. The release, the listing text and the phone
screenshots are not touched, so no build is needed. One edit, committed at the end; with managed publishing off the
commit sends the listing change to review. While the app has a rejected release Play refuses that ("Changes cannot be
sent for review automatically", answered by validate); the edit is then committed with changesNotSentForReview=true
(a commit-only parameter) and the changes wait in
Play Console > Publishing overview for "Send for review". After the commit a fresh edit reads the listings back,
downloads each image from Play and checks its hash against the uploaded file.

Environment:
  PLAY_SERVICE_ACCOUNT_JSON   service account key (raw JSON)
  PLAY_ASSETS_DIR             files of the play-listing-assets release (icon-512.png, feature-graphic.png)
  SUBMIT                      "true" commits the edit; anything else validates it and throws it away
  PLAY_CHECK_DIR              where the images read back from Play are written (default: ./play-check)
  GITHUB_STEP_SUMMARY         optional, the final state goes there
"""

import os
import sys
from pathlib import Path

import requests

from play import API, Play, PlayError, log, note, sha256, summary, update_images

GRAPHICS = {"icon": "icon-512.png", "featureGraphic": "feature-graphic.png"}


def listing_languages(play: Play, edit: str) -> list[str]:
    listings = play.request("GET", f"{API}/edits/{edit}/listings").get("listings", [])
    languages = sorted(item["language"] for item in listings)
    if not languages:
        raise SystemExit("The app has no store listing")
    return languages


def verify(play: Play, languages: list[str], assets: Path, out: Path) -> None:
    """Reads the committed listings back through a fresh edit and saves what Play serves."""
    out.mkdir(parents=True, exist_ok=True)
    edit = play.request("POST", f"{API}/edits", json={})["id"]
    try:
        for language in languages:
            for image_type, name in GRAPHICS.items():
                images = play.request("GET", f"{API}/edits/{edit}/listings/{language}/{image_type}").get("images", [])
                if len(images) != 1 or images[0].get("sha256") != sha256(assets / name):
                    raise PlayError(f"{language} {image_type}: Play does not serve the uploaded {name} ({images})")
                served = requests.get(images[0]["url"], timeout=120)
                served.raise_for_status()
                (out / f"{language}-{image_type}.png").write_bytes(served.content)
                note(f"{language} {image_type}: Play serves {name} ({len(served.content)} bytes downloaded)")
    finally:
        play.request("DELETE", f"{API}/edits/{edit}")


def main() -> None:
    submit = os.environ.get("SUBMIT", "false") == "true"
    assets = Path(os.environ["PLAY_ASSETS_DIR"])
    out = Path(os.environ.get("PLAY_CHECK_DIR", "play-check"))
    play = Play()
    edit = play.request("POST", f"{API}/edits", json={})["id"]
    committed = False
    try:
        languages = listing_languages(play, edit)
        log(f"Listing languages: {', '.join(languages)}")
        for language in languages:
            for image_type, name in GRAPHICS.items():
                update_images(play, edit, language, image_type, [assets / name])
            note(f"Listing {language}: icon, feature graphic")

        params = None
        try:
            play.request("POST", f"{API}/edits/{edit}:validate")
        except PlayError as e:
            if "changesNotSentForReview" not in str(e):
                raise
            # Only commit takes the parameter; validate has no way to accept it, so commit is the check then.
            params = {"changesNotSentForReview": "true"}
        if not submit:
            note("Edit " + ("uploaded the images" if params else "validated") + "; submit=false, so it was not committed")
            return
        play.request("POST", f"{API}/edits/{edit}:commit", params=params)
        committed = True
        if params:
            note(
                "Edit committed, but Play cannot send it for review through the API while the app has a rejected"
                " release. HUMAN-ONLY: Play Console > Publishing overview > Send changes for review."
            )
        else:
            note("Edit committed (managed publishing is off, so the listing change goes to review)")
        verify(play, languages, assets, out)
    except PlayError as e:
        note(f"ERROR {e}")
        raise SystemExit(1)
    finally:
        if not committed:
            play.request("DELETE", f"{API}/edits/{edit}")
        summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_file:
            with open(summary_file, "a", encoding="utf-8") as f:
                f.write("## Google Play graphics\n\n" + "\n".join(f"- {line}" for line in summary) + "\n")


if __name__ == "__main__":
    sys.exit(main())
