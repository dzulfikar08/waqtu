fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

### ios_beta

```sh
[bundle exec] fastlane ios_beta
```

Build waqtu-ios and upload to TestFlight

### ios_metadata

```sh
[bundle exec] fastlane ios_metadata
```

Push App Store metadata (from fastlane/metadata/ios) without a new binary

### ios_screenshots

```sh
[bundle exec] fastlane ios_screenshots
```

Capture iOS screenshots (requires snapshot() calls in a UITest — see README)

### mas_beta

```sh
[bundle exec] fastlane mas_beta
```

Build waqtu-mas and upload to TestFlight (Mac App Store)

### mas_metadata

```sh
[bundle exec] fastlane mas_metadata
```

Push MAS metadata (from fastlane/metadata/macos)

### tag

```sh
[bundle exec] fastlane tag
```

Tag current HEAD as a release (pass version: e.g. fastlane tag version:2.0.0)

---

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
