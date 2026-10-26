#!/usr/bin/env python3
"""Mac App Store signing material through the App Store Connect API.

usage:
  mas_signing.py inspect
      Lists the team's distribution certificates, the Mac bundle ids and their Mac App Store profiles
      (names, types, serials and dates only; nothing secret).
  mas_signing.py profiles CERT_SERIAL OUT_DIR
      Writes OUT_DIR/<bundle id>.provisionprofile for dat.waqtu and dat.waqtu.mac-widget: the newest
      active MAC_APP_STORE profile that contains the distribution certificate with this serial
      (hex, as `openssl x509 -serial` prints it), created when there is none.
  mas_signing.py installer-cert CSR_PEM OUT_DER [REVOKE_ID]
      Creates a MAC_INSTALLER_DISTRIBUTION certificate for the CSR and writes it (DER) to OUT_DER. Apple allows only a
      few of them; REVOKE_ID first revokes that existing Mac Installer Distribution certificate (only that type).

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (App Store Connect API key .p8).
"""

import base64
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "mobile" / "store" / "submit"))
from appstore import Asc, AscError, ref  # noqa: E402

BUNDLE_IDS = ("dat.waqtu", "dat.waqtu.mac-widget")
CERT_TYPES = "DISTRIBUTION,MAC_APP_DISTRIBUTION,MAC_INSTALLER_DISTRIBUTION,IOS_DISTRIBUTION"


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


def inspect(asc: Asc) -> None:
    print("Certificates:")
    for c in asc.all("/v1/certificates", **{"filter[certificateType]": CERT_TYPES}):
        a = c["attributes"]
        print(f"  {a['certificateType']:28} {a.get('displayName') or a.get('name')!s:40} serial={a.get('serialNumber')} "
              f"expires={a.get('expirationDate')} id={c['id']}")
    for identifier in BUNDLE_IDS:
        b = bundle_id(asc, identifier)
        caps = related(asc, f"/v1/bundleIds/{b['id']}/bundleIdCapabilities")
        print(f"Bundle id {identifier} ({b['attributes']['platform']}, id={b['id']}): "
              + ", ".join(sorted(c["attributes"]["capabilityType"] for c in caps)))
        for p in related(asc, f"/v1/bundleIds/{b['id']}/profiles"):
            a = p["attributes"]
            certs = related(asc, f"/v1/profiles/{p['id']}/certificates")
            print(f"  profile {a['name']!r} {a['profileType']} {a['profileState']} expires={a.get('expirationDate')} "
                  f"certs={[serial(c['attributes']['serialNumber']) for c in certs]}")


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


def installer_cert(asc: Asc, csr: Path, out: Path, revoke: str | None) -> None:
    if revoke:
        old = asc.get(f"/v1/certificates/{revoke}")["data"]["attributes"]
        if old["certificateType"] != "MAC_INSTALLER_DISTRIBUTION":
            raise SystemExit(f"{revoke} is a {old['certificateType']} certificate; only installer certificates are revoked here")
        asc.delete(f"/v1/certificates/{revoke}")
        print(f"Revoked {old['certificateType']} serial={old.get('serialNumber')} expires={old.get('expirationDate')}")
    created = asc.post(
        "/v1/certificates",
        {
            "data": {
                "type": "certificates",
                "attributes": {"certificateType": "MAC_INSTALLER_DISTRIBUTION", "csrContent": csr.read_text()},
            }
        },
    )["data"]
    out.write_bytes(base64.b64decode(created["attributes"]["certificateContent"]))
    a = created["attributes"]
    print(f"Created {a['certificateType']} {a.get('name')} serial={a.get('serialNumber')} expires={a.get('expirationDate')}")


def main() -> None:
    asc = Asc()
    command, *args = sys.argv[1:] or ["inspect"]
    try:
        if command == "inspect":
            inspect(asc)
        elif command == "profiles":
            profiles(asc, args[0], Path(args[1]))
        elif command == "installer-cert":
            installer_cert(asc, Path(args[0]), Path(args[1]), args[2] if len(args) > 2 else None)
        else:
            raise SystemExit(__doc__)
    except AscError as e:
        raise SystemExit(str(e))


if __name__ == "__main__":
    main()
