#!/usr/bin/env python3
"""Builds the entitlements a Developer ID build is signed with.

usage: make-entitlements.py SRC.entitlements OUT.plist BUNDLE_ID [PROFILE.provisionprofile]

Expands $(TeamIdentifierPrefix) and, when a profile is given, adds the application and team
identifiers from it and checks that every restricted entitlement is covered by the profile
(exits 1 and names the entitlement otherwise). Without a profile the restricted entitlements
are dropped, since a build that claims them without a profile is killed at launch.
"""
import fnmatch
import plistlib
import subprocess
import sys

TEAM = "F6Q6UFUK69"
RESTRICTED = {
    "com.apple.security.application-groups",
    "com.apple.developer.ubiquity-kvstore-identifier",
    "com.apple.developer.applesignin",
    "com.apple.developer.icloud-container-identifiers",
    "com.apple.developer.icloud-services",
}


def expand(value, prefix):
    if isinstance(value, str):
        return value.replace("$(TeamIdentifierPrefix)", prefix)
    if isinstance(value, list):
        return [expand(v, prefix) for v in value]
    return value


def covered(ours, theirs):
    """True when every value we claim is allowed by the profile's value (wildcards allowed)."""
    if isinstance(ours, list):
        theirs_list = theirs if isinstance(theirs, list) else [theirs]
        return all(any(fnmatch.fnmatchcase(str(o), str(t)) for t in theirs_list) for o in ours)
    if isinstance(theirs, list):
        return any(fnmatch.fnmatchcase(str(ours), str(t)) for t in theirs)
    return fnmatch.fnmatchcase(str(ours), str(theirs))


def main():
    src, out, bundle_id = sys.argv[1:4]
    profile_path = sys.argv[4] if len(sys.argv) > 4 else None
    with open(src, "rb") as f:
        ents = expand(plistlib.load(f), TEAM + ".")

    if not profile_path:
        for key in sorted(RESTRICTED & ents.keys()):
            print(f"warning: no provisioning profile for {bundle_id}; dropping restricted entitlement {key}", file=sys.stderr)
            del ents[key]
    else:
        decoded = subprocess.run(["security", "cms", "-D", "-i", profile_path], check=True, capture_output=True).stdout
        profile = plistlib.loads(decoded)
        granted = profile["Entitlements"]
        team = profile["TeamIdentifier"][0]
        app_id = granted["com.apple.application-identifier"]
        if not fnmatch.fnmatchcase(f"{team}.{bundle_id}", app_id):
            print(f"error: profile '{profile.get('Name')}' ({app_id}) does not cover {team}.{bundle_id}", file=sys.stderr)
            sys.exit(1)
        ents["com.apple.application-identifier"] = f"{team}.{bundle_id}"
        ents["com.apple.developer.team-identifier"] = team
        failed = False
        for key in sorted(RESTRICTED & ents.keys()):
            if key not in granted:
                print(f"error: entitlement {key} is not in profile '{profile.get('Name')}' (profile has: {sorted(granted)})", file=sys.stderr)
                failed = True
            elif not covered(ents[key], granted[key]):
                print(f"error: entitlement {key}={ents[key]!r} is not covered by profile value {granted[key]!r}", file=sys.stderr)
                failed = True
        if failed:
            sys.exit(1)
        print(f"profile '{profile.get('Name')}' covers {team}.{bundle_id}; granted entitlements: {sorted(granted)}")

    with open(out, "wb") as f:
        plistlib.dump(ents, f)


main()
