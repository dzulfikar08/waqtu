# Adhkar, Al-Ma'tsurat, doa, tasbih

Bundled in the phone app (apps/mobile/src/ibadah/content.ts, tasbih.ts) for the Ibadah tab. Copied unmodified from the
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

Rules:

- The JSON files are byte-for-byte copies (SHA-256 pinned in apps/mobile/test/ibadah.test.ts) and excluded from oxfmt.
  Never reformat or edit the Arabic.
- A text is shown with the translation its file has. Missing languages are not machine-translated; the app says which
  language the translation is in.
- `templates.json` from the same folder is not copied: it holds mutabaah habit templates (Fajr, Dhuha, ...), which Waqtu
  already has as its own checklist items. The muhasabah questions come from the Mutabaah app's `MuhasabahServiceImpl`.
