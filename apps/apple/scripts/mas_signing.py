#!/usr/bin/env python3
"""Mac App Store provisioning profiles through the App Store Connect API (release-mas.yml).

usage: mas_signing.py CERT_SERIAL OUT_DIR
    Writes OUT_DIR/<bundle id>.provisionprofile for dat.waqtu and dat.waqtu.mac-widget: the newest active
    MAC_APP_STORE profile that contains the distribution certificate with this serial (hex, as
    `openssl x509 -serial` prints it), created when there is none.

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (App Store Connect API key .p8).
"""

import base64
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "mobile" / "store" / "submit"))
from appstore import Asc, AscError, ref  # noqa: E402

BUNDLE_IDS = ("dat.waqtu", "dat.waqtu.mac-widget")
CERT_TYPES = "DISTRIBUTION,MAC_APP_DISTRIBUTION"


def serial(value: str) -> str:
    return value.strip().upper().removeprefix("SERIAL=").lstrip("0")


def bundle_id(asc: Asc, identifier: str) -> dict:
    found = [
        b
        for b in asc.all("/v1/bundleIds", **{"filter[identifier]": identifier})
        if b["attributes"]["identifier"] == identifier
    ]
    if not found:
        raise SystemExit(f"Bundle id {identifier} is not registered")
    mac = [b for b in found if b["attributes"]["platform"] in ("MAC_OS", "UNIVERSAL")]
    return (mac or found)[0]


def related(asc: Asc, path: str) -> list[dict]:
    """A to-many relationship list; some of them reject the `limit` parameter."""
    try:
        return asc.all(path)
    except AscError as e:
        if e.status != 400:
            raise
        return asc.get(path)["data"]


def profiles(asc: Asc, cert_serial: str, out_dir: Path) -> None:
    wanted = serial(cert_serial)
    certs = [
        c
        for c in asc.all("/v1/certificates", **{"filter[certificateType]": CERT_TYPES})
        if serial(c["attributes"].get("serialNumber") or "") == wanted
    ]
    if not certs:
        raise SystemExit(f"No distribution certificate with serial {wanted} in App Store Connect")
    cert = certs[0]
    out_dir.mkdir(parents=True, exist_ok=True)
    for identifier in BUNDLE_IDS:
        b = bundle_id(asc, identifier)
        chosen = None
        for p in related(asc, f"/v1/bundleIds/{b['id']}/profiles"):
            a = p["attributes"]
            if a["profileType"] != "MAC_APP_STORE" or a["profileState"] != "ACTIVE":
                continue
            if cert["id"] not in {c["id"] for c in related(asc, f"/v1/profiles/{p['id']}/certificates")}:
                continue
            if chosen is None or a["expirationDate"] > chosen["attributes"]["expirationDate"]:
                chosen = p
        if chosen is None:
            name = f"Waqtu MAS {identifier} {time.strftime('%Y%m%d%H%M')}"
            chosen = asc.post(
                "/v1/profiles",
                {
                    "data": {
                        "type": "profiles",
                        "attributes": {"name": name, "profileType": "MAC_APP_STORE"},
                        "relationships": {
                            "bundleId": ref("bundleIds", b["id"]),
                            "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]},
                        },
                    }
                },
            )["data"]
            print(f"{identifier}: created profile {name!r}")
        content = chosen["attributes"].get("profileContent") or asc.get(f"/v1/profiles/{chosen['id']}")["data"][
            "attributes"
        ]["profileContent"]
        path = out_dir / f"{identifier}.provisionprofile"
        path.write_bytes(base64.b64decode(content))
        print(f"{identifier}: profile {chosen['attributes']['name']!r} expires {chosen['attributes']['expirationDate']}")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    try:
        profiles(Asc(), sys.argv[1], Path(sys.argv[2]))
    except AscError as e:
        raise SystemExit(str(e))


if __name__ == "__main__":
    main()
