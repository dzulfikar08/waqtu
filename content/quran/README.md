# Quran text, metadata and font (hafalan)

Data behind the hafalan & murojaah feature (`apps/mobile/src/hafalan`, `packages/core/src/hafalan.ts`).
Nothing here is written by Waqtu: the text and the mushaf metadata are Tanzil Project's, the font is
Amiri Quran. Their licenses differ from the rest of the repository ([MPL-2.0](../../LICENSE)) and
apply to these files.

## Quran text: Tanzil Project, Uthmani, version 1.1

- Source: <https://tanzil.net/download> (Quran text, Uthmani, "Text (with aya numbers)" format
  `txt-2`, i.e. `surah|ayah|text` lines), downloaded 2026-10-25.
- License: **Creative Commons Attribution 3.0**, plus Tanzil's terms of use, which govern what this
  repository may do with the text:
  - Verbatim copies may be copied and distributed; **changing the text is not allowed**.
  - The text may be used in any website or application provided the source (Tanzil Project) is clearly
    indicated and a link to <https://tanzil.net> is made.
  - Tanzil's copyright notice must be reproduced in all verbatim copies and in all files derived from
    or containing a substantial portion of the text.
- Files:
  - `quran-uthmani-1.1.txt`: Tanzil's file **byte for byte**, notice included. Its SHA-256 is pinned in
    `packages/core/test/quran.test.ts`.
  - `surah/001.json` … `surah/114.json`: the same ayah strings, one JSON file per surah, so the app
    loads only the surah being studied (Metro evaluates a module when it is first required). Every file
    carries a `notice` field with Tanzil's copyright, license, "verbatim copy" term and link. The
    strings are not altered; a test compares all 6236 of them to `quran-uthmani-1.1.txt`.
  - The hafalan screens show the credit ("Teks Al-Qur'an: Tanzil Project (tanzil.net). Huruf: Amiri Quran." / "Quran text: Tanzil
    Project (tanzil.net). Font: Amiri Quran.", `apps/mobile/src/hafalan/strings.ts`) as a link that opens
    <https://tanzil.net>.
- How the text is used without modifying it:
  - Tanzil puts the Bismillah in front of ayah 1 of every surah except 1 and 9 (in surahs 95 and 97
    its marks are ordered differently). The app only **displays** it as a heading line above the
    verses (`splitBismillah`); the stored strings still contain it.
  - Ayah-end markers (﴿٣﴾) are drawn by the app next to each ayah; they are not in the text.
  - "Words" for the hide-and-reveal test are the space-separated tokens of an ayah.
- Integrity checks (`packages/core/test/quran.test.ts`, `apps/mobile/test/hafalan.test.ts`): 114
  surahs, 6236 ayahs numbered consecutively, ayah counts per surah equal to the metadata, checksum of
  the verbatim file, the per-surah files equal the verbatim file.

## Surah, juz and page metadata: Tanzil Quran Metadata, version 1.0

- Source: <https://tanzil.net/res/text/metadata/quran-data.js>, Copyright (C) 2008-2009 Tanzil.info,
  **Creative Commons Attribution 3.0**.
- Used for: Arabic and English surah names, ayah counts, the first ayah of each of the 30 juz and of
  each of the 604 pages of the Madinah mushaf. Pages are the pages of the standard 15-line Madinah
  mushaf (Hafs); an ayah that runs on to the next page belongs to the page it starts on.
- Generated into `packages/core/src/quran-data.ts` by `build.ts` (header carries the attribution).
  The same file holds the word count of every ayah, derived from the text above, which weights the
  half-page units of a plan.
- Indonesian surah names are the Kemenag transliteration, written for this project; English names are
  Tanzil's `ename` field.

## Font: Amiri Quran

- File: `apps/mobile/assets/fonts/AmiriQuran-Regular.ttf`, license text next to it
  (`AmiriQuran-OFL.txt`). Copyright 2010-2022 The Amiri Quran Project Authors
  (<https://github.com/aliftype/amiri>), **SIL Open Font License 1.1**.
- The OFL allows bundling the unmodified font in an app, including a commercial one; the font may not
  be sold by itself and its Reserved Font Name must not be used for a modified version. The font is
  not modified.
- Fetched from `google/fonts` (`ofl/amiriquran/`). A check with fontTools found that it has a glyph for
  every one of the 62 distinct characters that occur in the Tanzil text, plus the ornate parentheses
  and Arabic-Indic digits used for ayah markers.
- Why not KFGQPC Uthmanic Hafs: its license is a custom "all rights reserved; free to use and copy
  unmodified, not to be sold" notice rather than an open license, and its glyphs follow King Fahd
  Complex's own encoding, not the Unicode text of Tanzil. Amiri Quran is open and made for that text.

## Regenerating

```sh
curl -sSL -A "Mozilla/5.0" https://tanzil.net/res/text/metadata/quran-data.js -o /tmp/quran-data.js
bun content/quran/build.ts /tmp/quran-data.js && bun run fmt
```

Replacing `quran-uthmani-1.1.txt` with a newer Tanzil release also means updating the SHA-256 in the
core test. `content/quran/surah/**` is excluded from `oxfmt` so the JSON stays compact.

## Recitation recordings

Recordings made in the hafalan screen are stored in the app's private `Documents/hafalan` folder, which
is never uploaded. On iOS the folder is marked `NSURLIsExcludedFromBackupKey` (local Expo module
`apps/mobile/modules/waqtu-backup`, because `expo-file-system` has no API for it), so recordings stay out
of iCloud and iTunes backups; the mark is applied when a recording is saved and at every launch for a
folder that already exists. Android backups are off for the whole app (`allowBackup: false`).
