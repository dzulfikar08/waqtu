# Adhkar, Al-Ma'tsurat, doa, tasbih

Bundled in the phone app (apps/mobile/src/ibadah/content.ts, tasbih.ts) for the Ibadah tab and in both Mac builds
(apps/apple, Ibadah window; the files are resources of the `waqtu` and `waqtu-mas` targets, read by name). Copied unmodified from the
Mutabaah app (github.com/dzulfikar08/Mutabaah, same developer), `Mutabaah/Resources/`:

| File                                       | What                                                                                             | Translation |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------- |
| `kubro-pagi.json`, `kubro-petang.json`     | Al-Ma'tsurat kubro, morning / evening                                                            | Indonesian  |
| `sugro-pagi.json`, `sugro-petang.json`     | Al-Ma'tsurat sughro, morning / evening                                                           | Indonesian  |
| `morning_dhikr.json`, `evening_dhikr.json` | Morning / evening dhikr, with hadith references                                                  | English     |
| `duas.json`                                | Daily duas by category, with hadith/Quran reference                                              | English     |
| `tasbih.json`                              | Tasbih phrases (`TasbihPreset.presets` in `Mutabaah/Core/Models/TasbihCounter.swift`), ids added | English     |

Al-Ma'tsurat is the wird compiled by Imam Hasan al-Banna. The files carry no further source or licence field; the hadith
and Quran references inside them are shown with each text.

## Indonesian translations (`translations-id.json`)

Human Indonesian translations of the morning / evening dhikr and the daily duas, keyed by the item ids of
`morning_dhikr.json`, `evening_dhikr.json` and `duas.json` (`{ source, quranSource, items: { <id>: { text, source, page } } }`).
Not part of the Mutabaah copy; added alongside the pinned files, which stay untouched.

| Source                                                                                                                                                                                                                                                                              | Used for                    | Licence basis                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| IslamHouse.com, "Ḥiṣnul Muslim Kumpulan Zikir dari Al-Qur`an dan Sunnah" by Dr. Sa'īd bin Ali bin Wahf Al-Qaḥṭāniy, published by Risala (Message of The Two Holy Mosques). Book 2846946, PDF `risala_id_hisnulmuslim.pdf`, version `id24v5.0 - 04/10/2026`. No translator is named. | 36 texts (`page` = printed) | IslamHouse content policy, quoted below                                                   |
| QuranEnc.com, "Indonesian Translation - Ministry of Religious Affairs" (`indonesian_affairs`, version 1.0.1), developed under the supervision of Rowwad Translation Center                                                                                                          | `dua-gratitude` (Quran 1:2) | QuranEnc terms of use (no modification, name the source, state the version), quoted below |

Policy: https://github.com/IslamHouse-API/multilingual-quran-hadith-islamic-content-database-api-hub — "You may
download, publish, print, and integrate the content into apps, websites, and technical projects while preserving the
original text and clearly citing the source." Conditions: do not alter the original text (no additions, deletions or
changes to content attributed to the platform), cite the source with the author, translator or publisher when
available, keep version information. Changing formatting or file format is allowed. QuranEnc
(https://quranenc.com/en/home/about): no modification, addition or deletion of the content; name the publisher and
QuranEnc.com; give the version number.

How the file was made:

- Each text is the book's Indonesian wording copied from the PDF, joined into one line: line breaks and the hyphen at
  a line end are the only changes. The superscript footnote numbers, the "Dibaca 3 kali" / "Ketika pagi" notes and the
  Arabic-transliteration lines between the two halves of a verse are not part of the translation and are left out;
  the book's quotation marks and braces are kept.
- Where one of our texts is a contiguous part of a longer text in the book (`morning-001`/`evening-001`,
  `morning-014`/`evening-014`), only that part is used, so the translation covers exactly the Arabic it sits under.
- Never paraphrased, never machine translated, never attached to an Arabic text worded differently from the book.
  Not in the file, so shown in English as before: `morning-013` and `evening-013`, `dua-evil-eye`, `dua-new-blessing`,
  `dua-leaving-home` (the book's Arabic is worded differently), and `dua-after-eating` (both IslamHouse editions, the
  2026 Risala one and the older 1089 one, have a different after-eating dua than ours).
- The attribution is shown in the apps: About & licences on the phone, under the Indonesian text on the Mac.
- The file is SHA-256 pinned in both test suites so the text cannot be reworded by hand or by a formatter.

Rules:

- The Mutabaah JSON files are byte-for-byte copies (SHA-256 pinned in apps/mobile/test/ibadah.test.ts and, with the same
  hashes, apps/apple/waqtuTests/IbadahContentTests.swift) and excluded from oxfmt, as is `translations-id.json`.
  Never reformat or edit the Arabic, and never edit the Indonesian text: it must stay the source's wording.
- A text is shown with the translation its file has, and in the Indonesian app with the human Indonesian one from
  `translations-id.json` where that has it. Missing languages are not machine-translated; the app says which language
  the translation is in.
- `templates.json` from the same folder is not copied: it holds mutabaah habit templates (Fajr, Dhuha, ...), which Waqtu
  already has as its own checklist items. The muhasabah questions come from the Mutabaah app's `MuhasabahServiceImpl`.
