# Four-madhab fiqh companion (DEV-14): sourcing, RAG design, evaluation

Status: research only, nothing is built. The feature ships after Ramadhan and only after a scholar has
reviewed it. Everything below was checked on 2026-10-25 against the sources linked in each row;
anything not checked is marked **[UNVERIFIED]**.

The companion is a study aid, not a mufti. For a question it shows the Hanafi, Maliki, Shafi'i and
Hanbali positions side by side, each with its dalil and an exact citation (book, volume, page), says
"agreed by all four" only when the sources say so, and never picks a side.

## Key findings

1. **Every planned classical text is in OpenITI except al-Jaziri.** The comparative work of Ibn Rushd,
   all the madhab texts and all six hadith books exist as OpenITI versions digitised from Shamela, and
   each carries page markers (`PageV<vol>P<page>`) for almost every page. al-Jaziri's _al-Fiqh 'ala
   al-Madhahib al-Arba'ah_ is not in the OpenITI `1375AH` repository; it is on Shamela as book 9849,
   whose card says its pagination follows the print edition.
2. **The OpenITI licence is non-commercial.** OpenITI releases are published under
   [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode) (stated in the
   [OpenITI documentation](http://openiti.org/documentation/) and on the
   [Zenodo record of release 2025.1.9](https://doi.org/10.5281/zenodo.17767721), whose API reports
   `cc-by-nc-sa-4.0`). Putting the companion behind Premium, or anywhere in a paid product, conflicts
   with "NonCommercial" unless OpenITI agrees or a lawyer concludes that the public-domain classical
   text itself is not covered. This is the biggest open decision (D1).
3. **Shamela grants no reuse licence.** Its current terms (for the Shamela MCP service) say rights in
   books and editions stay with their holders and that the terms grant no right to reuse content beyond
   the rights holder's permission or the law. The old site says the library is free, must not be used
   to spread what contradicts the way of Ahl al-Sunnah wa al-Jama'ah, and that it follows Saudi
   copyright law.
4. **Page numbers are usable for citations.** For each chosen version the page markers run through all
   volumes with at most two unnumbered (`V00P000`) markers, and Shamela's book card says "pagination
   matches the print edition" (`ترقيم الكتاب موافق للمطبوع`) for every chosen edition.
5. **There is no standalone, print-paginated al-Hidayah in OpenITI.** The two Shamela-based versions
   were split out of commentaries (al-'Ayni's _al-Binayah_, al-Babarti's _al-'Inayah_), so their pages
   are the commentary edition's pages. The standalone version (`JK000242`) has page markers but its
   print edition is not identified. Radd al-Muhtar is the better primary Hanafi source (D6).
6. **sunnah.com does not allow scraping or mass reproduction**; data comes through its API with a key
   on request. The hadith text can come from OpenITI instead (same NC licence), with sunnah.com links
   for readers.

## 1. Per-text sourcing

OpenITI URIs below were confirmed by listing the GitHub repositories
`github.com/OpenITI/<25-year repo>/data/<author>/<book>/` through the GitHub API; repository heads at
the time of checking are listed under [Pinning](#pinning). "Pages" counts the `PageV..P..` markers in
the version file and the highest page per volume.

| Text                                                    | Madhab                   | Edition to cite (from the Shamela book card)                                                                                                                                                                                                   | OpenITI version (URI)                                                                                                                                                                                                                                       | Shamela                                                                  | Page numbers in source                                                                                                                                                                                                           |
| ------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ibn Rushd, _Bidayat al-Mujtahid wa Nihayat al-Muqtasid_ | Comparative (all four +) | Dar al-Hadith, Cairo, 1425/2004, 4 parts in 2 bindings; hadith takhrij by Farid 'Abd al-'Aziz al-Jundi                                                                                                                                         | [`0595IbnRushdHafid.BidayatMujtahid.Shamela0021739-ara1`](https://github.com/OpenITI/0600AH/tree/master/data/0595IbnRushdHafid/0595IbnRushdHafid.BidayatMujtahid)                                                                                           | [21739](https://shamela.ws/book/21739)                                   | 946 markers, vols 1–4 (258/215/235/258 pp.); Shamela: matches print                                                                                                                                                              |
| al-Jaziri, _al-Fiqh 'ala al-Madhahib al-Arba'ah_        | Comparative (four)       | Dar al-Kutub al-'Ilmiyyah, Beirut, 2nd ed. 1424/2003, 5 vols                                                                                                                                                                                   | **Not in OpenITI** (no al-Jaziri, d. 1360, in the `1375AH` repo's `data/` listing)                                                                                                                                                                          | [9849](https://shamela.ws/book/9849)                                     | Shamela pages are print pages (card: matches print; URLs show "ج1 - ص439" style references)                                                                                                                                      |
| al-Marghinani, _al-Hidayah fi Sharh Bidayat al-Mubtadi_ | Hanafi                   | (a) inside al-Babarti, _al-'Inayah_ with _Fath al-Qadir_, Mustafa al-Babi al-Halabi, 1st ed. 1389/1970, 10 vols (repr. Dar al-Fikr); (b) inside al-'Ayni, _al-Binayah_, Dar al-Kutub al-'Ilmiyyah, 1420/2000, 13 vols, ed. Ayman Salih Sha'ban | (a) [`…HidayaFiSharhBidaya.Shamela0009403BK1-ara1`](https://github.com/OpenITI/0600AH/tree/master/data/0593BurhanDinFarghaniMarghinani/0593BurhanDinFarghaniMarghinani.HidayaFiSharhBidaya); (b) `…Shamela0000427BK1-ara1`; (c) standalone `…JK000242-ara1` | [9403](https://shamela.ws/book/9403), [427](https://shamela.ws/book/427) | (a) 4,867 markers, 10 vols; (b) 7,019 markers, 13 vols; both are the **commentary edition's** pages (OpenITI split the matn out). (c) 978 markers, 4 vols, publisher "al-Maktabah al-Islamiyyah", print edition **[UNVERIFIED]** |
| Ibn 'Abidin, _Radd al-Muhtar 'ala al-Durr al-Mukhtar_   | Hanafi                   | Mustafa al-Babi al-Halabi, 2nd ed. 1386/1966 (current Shamela card); OpenITI header records Dar al-Fikr, Beirut, 2nd ed. 1412/1992 (photo reprint); al-Haskafi's _al-Durr al-Mukhtar_ is printed at the top of each page                       | [`1252IbnCabidinDimashqi.RaddMukhtar.Shamela0021613-ara1`](https://github.com/OpenITI/1275AH/tree/master/data/1252IbnCabidinDimashqi/1252IbnCabidinDimashqi.RaddMukhtar)                                                                                    | [21613](https://shamela.ws/book/21613)                                   | 4,258 markers, 6 vols (663/628/851/604/711/815 pp.); Shamela: matches print. Whether the 1966 and 1992 printings share pagination: **[UNVERIFIED]**                                                                              |
| Khalil b. Ishaq, _Mukhtasar Khalil_                     | Maliki                   | Dar al-Hadith, Cairo, 1st ed. 1426/2005, ed. Ahmad Jad, 264 pp.                                                                                                                                                                                | [`0767KhalilIbnIshaq.MukhtasarKhalil.Shamela0011355-ara1`](https://github.com/OpenITI/0775AH/tree/master/data/0767KhalilIbnIshaq/0767KhalilIbnIshaq.MukhtasarKhalil) (OpenITI dates Khalil 767; Shamela says 776)                                           | [11355](https://shamela.ws/book/11355)                                   | 335 markers, 1 vol, up to p. 264; Shamela: matches print                                                                                                                                                                         |
| al-Nawawi, _Minhaj al-Talibin_                          | Shafi'i                  | Dar al-Fikr, 1st ed. 1425/2005, ed. 'Awad Qasim Ahmad 'Awad, 370 pp.                                                                                                                                                                           | [`0676Nawawi.MinhajTalibin.Shamela0012096-ara1`](https://github.com/OpenITI/0700AH/tree/master/data/0676Nawawi/0676Nawawi.MinhajTalibin)                                                                                                                    | [12096](https://shamela.ws/book/12096)                                   | 407 markers, 1 vol, up to p. 370; Shamela: matches print                                                                                                                                                                         |
| al-Nawawi, _al-Majmu' Sharh al-Muhadhdhab_              | Shafi'i                  | Idarat al-Tiba'ah al-Muniriyyah, Cairo, 1344–1347 (9 parts of Nawawi's original), photo reprint Dar al-Fikr, Beirut, 20 vols with the _Takmilah_ of al-Subki and al-Muti'i                                                                     | [`0676Nawawi.Majmuc.Shamela0002186-ara1`](https://github.com/OpenITI/0700AH/tree/master/data/0676Nawawi/0676Nawawi.Majmuc)                                                                                                                                  | [2186](https://shamela.ws/book/2186)                                     | 9,793 markers, 20 vols; Shamela: matches print. Volumes after Nawawi's own part are by al-Subki / al-Muti'i; the exact volume boundary is **[UNVERIFIED]**                                                                       |
| Ibn Qudamah, _al-Mughni_ (on _Mukhtasar al-Khiraqi_)    | Hanbali                  | Maktabat al-Qahirah, 1st ed. 1388–1389/1968–1969, 10 vols, ed. Taha al-Zayni et al.                                                                                                                                                            | [`0620IbnQudamaMaqdisi.Mughni.Shamela0008463-ara1`](https://github.com/OpenITI/0625AH/tree/master/data/0620IbnQudamaMaqdisi/0620IbnQudamaMaqdisi.Mughni)                                                                                                    | [8463](https://shamela.ws/book/8463)                                     | 5,010 markers, 10 vols; Shamela: matches print                                                                                                                                                                                   |
| al-Buhuti, _Kashshaf al-Qina' 'an Matn al-Iqna'_        | Hanbali                  | Maktabat al-Nasr al-Hadithah, Riyadh, undated (dated 1388/1968 by al-Turki per the card), rev. Hilal Musaylihi, 6 vols (repr. Dar al-Fikr, 'Alam al-Kutub)                                                                                     | [`1051IbnYunusBuhutiHanbali.KashshafQinac.Shamela0021642-ara1`](https://github.com/OpenITI/1075AH/tree/master/data/1051IbnYunusBuhutiHanbali/1051IbnYunusBuhutiHanbali.KashshafQinac)                                                                       | [21642](https://shamela.ws/book/21642)                                   | 3,211 markers, 6 vols; Shamela: matches print. OpenITI header records "Dar al-Kutub al-'Ilmiyyah" as publisher, which differs from the current card: pagination match **[UNVERIFIED]**                                           |

Notes that apply to the whole table:

- **Edition metadata comes from two places.** The OpenITI file header (`#META#`) is a snapshot of
  Shamela's metadata at digitisation time; the Shamela book card is current. They disagree for Radd
  al-Muhtar and Kashshaf al-Qina'. Before ingesting, compare a sample of pages (say 10 per volume) in
  the OpenITI file against the live Shamela page with the same volume/page to confirm the pagination is
  the same printing.
- **Other versions exist** for most books (`JK…`, `ShamAY…`, `Shia…Vols`). They were not evaluated; the
  `Shamela…` versions were chosen because Shamela states their pagination follows print.
- **Layered texts need a layer field.** Radd al-Muhtar pages carry al-Durr al-Mukhtar on top; al-Mughni
  quotes al-Khiraqi's matn; Kashshaf al-Qina' quotes al-Iqna'; the _al-Majmu'_ reprint includes the
  _Takmilah_; the Hidayah versions were cut out of commentaries. A citation must name the text whose
  words are quoted, not only the book file.
- **Modern editorial matter.** OpenITI says it removes editorial matter still in copyright (footnotes,
  introductions) during annotation ([documentation, "what about copyright issues?"](http://openiti.org/documentation/)).
  Whether that has been done for each file above: **[UNVERIFIED]**. The pipeline should drop footnote
  blocks anyway (the takhrij in the Dar al-Hadith Bidayah is by a modern editor).
- **Mu'tamad status.** al-Mughni is a comparative Hanbali work rather than the later mu'tamad;
  Kashshaf al-Qina' (or Sharh Muntaha al-Iradat, also in OpenITI as
  `1051IbnYunusBuhutiHanbali.SharhMuntahaIradat`) is closer to the later relied-upon position.
  Similarly al-Majmu' is broad; Minhaj al-Talibin is the Shafi'i reference matn, usually read with
  _Tuhfat al-Muhtaj_ or _Nihayat al-Muhtaj_ (not checked). Which text counts as "the madhab position"
  per bab is a scholar decision (D6 below).

### Licences as actually stated

| Source                                      | What it says                                                                                                                                                                                                                                                                                                                                                                                            | Link                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| OpenITI corpus releases                     | "OpenITI releases are published under the CC BY-NC-SA 4.0 license." Zenodo release 2025.1.9 (2025-12-30) metadata: `cc-by-nc-sa-4.0`. The GitHub working repositories have no LICENSE file (GitHub API `license: null` for `OpenITI/RELEASE`).                                                                                                                                                          | [documentation](http://openiti.org/documentation/), [Zenodo 10.5281/zenodo.17767721](https://doi.org/10.5281/zenodo.17767721) |
| OpenITI platform terms                      | §5.1/5.2: most Material is under "Creative Commons Attribution-Non-Commercial (CC BY-SA) 4.0" (the label mixes NC and SA); "You also may not use the Creative Material for commercial purposes"; attribution, licence link and change notice required.                                                                                                                                                  | [Terms of Use](https://openiti.org/docs/Terms%20of%20Use.html)                                                                |
| Shamela (current, MCP service terms)        | Last updated 19 Sept 2026. Use allowed for lawful research, reading and citation; no rebuilding the full index around rate limits; "Rights in books, editions, and other materials remain with their respective holders… These terms do not grant rights to reuse content beyond permission from the rights holder or applicable law." Search previews are not citable until the source page is opened. | [shamela.ws/page/terms](https://shamela.ws/page/terms)                                                                        |
| Shamela (old site help page)                | The library is free; it may not be used to spread what contradicts the way of Ahl al-Sunnah wa al-Jama'ah; the site follows the Saudi copyright law and takes complaints. "All rights reserved © Shamela 2005–2010."                                                                                                                                                                                    | [old.shamela.ws/help.php/page/1](https://old.shamela.ws/help.php/page/1)                                                      |
| Classical texts themselves                  | Authors died between 595 and 1360 AH. Whether the bare classical text, as typeset in a modern edition, is public domain in Indonesia and the countries of the stores is a legal question: **[UNVERIFIED]**, needs counsel. Modern tahqiq, footnotes and takhrij are in copyright unless the editor's rights expired.                                                                                    | —                                                                                                                             |
| al-Jaziri (d. 1360/1941)                    | Only on Shamela; no open licence found. The Dar al-Kutub al-'Ilmiyyah 2003 edition's rights: **[UNVERIFIED]**.                                                                                                                                                                                                                                                                                          | [shamela.ws/book/9849](https://shamela.ws/book/9849)                                                                          |
| Indonesian translations of any of the above | Not checked; none of the sources above grants translation rights. Each needs written permission from its publisher (as the spec says).                                                                                                                                                                                                                                                                  | —                                                                                                                             |

What this means in practice:

- **NonCommercial.** Serving OpenITI text in a paid tier is a commercial use on its face. Options:
  keep the companion free for everyone, ask the OpenITI/KITAB team (openiti@umd.edu, kitab@aku.edu) for
  permission, or get a legal opinion that the classical text is public domain and only OpenITI's own
  additions are covered. Owner decision D1.
- **ShareAlike.** The chunk store and embeddings are adaptations of the OpenITI text. If they are
  shipped or published they carry CC BY-NC-SA 4.0. Keep the corpus out of the MPL-2.0 tree (or in a
  `content/fiqh/` folder with its own licence README, the way `content/quran/README.md` handles Tanzil).
- **Attribution.** Every answer shows the book and edition; an "Sources" screen lists OpenITI (with the
  release or commit), Shamela book IDs and the licences.

### Pinning

The corpus must be pinned so that a citation always points at the same text. Either download a Zenodo
release (the version files above being present in release 2025.1.9 is **[UNVERIFIED]**), or pin GitHub
commits. Repository heads on 2026-10-25:

| Repo                                        | Commit         | Date       |
| ------------------------------------------- | -------------- | ---------- |
| [0275AH](https://github.com/OpenITI/0275AH) | `44e1c36738a2` | 2025-11-28 |
| [0300AH](https://github.com/OpenITI/0300AH) | `01a1544130e0` | 2025-11-28 |
| [0325AH](https://github.com/OpenITI/0325AH) | `089e665b4958` | 2025-12-01 |
| [0600AH](https://github.com/OpenITI/0600AH) | `ea4bdc6517a4` | 2026-08-10 |
| [0625AH](https://github.com/OpenITI/0625AH) | `f1e38210b32f` | 2025-11-28 |
| [0700AH](https://github.com/OpenITI/0700AH) | `3d8ff4e7b035` | 2025-11-28 |
| [0775AH](https://github.com/OpenITI/0775AH) | `61b0c7891699` | 2025-11-28 |
| [1075AH](https://github.com/OpenITI/1075AH) | `f2c1134cf9be` | 2025-11-28 |
| [1275AH](https://github.com/OpenITI/1275AH) | `d6d3091d7477` | 2025-11-28 |

## 2. Quran and hadith (dalil)

### Quran

Use the Tanzil Uthmani text already in the repo (`content/quran/quran-uthmani-1.1.txt`, see
`content/quran/README.md`): Creative Commons Attribution 3.0 plus Tanzil's terms (verbatim only,
credit with a link to tanzil.net). Quran citations are `surah:ayah`, which needs no page number. The
model never writes ayah text itself; the app renders the ayah from this file by reference.

Indonesian meaning: Tanzil's translation page says "The translations provided at this page are for
non-commercial purposes only. If used otherwise, you need to obtain necessary permission from the
translator or the publisher" ([tanzil.net/trans](https://tanzil.net/trans/)); this includes the
Indonesian Ministry of Religious Affairs translation listed there. So the Kemenag translation inside a
paid tier needs Kemenag's permission (D2).

### Kutubus Sittah

| Book              | OpenITI version                                                                                                             | Edition to cite (Shamela card)                                                                                                         | Shamela                              | Numbering                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Sahih al-Bukhari  | [`0256Bukhari.Sahih.Shamela0001681-ara1`](https://github.com/OpenITI/0275AH/tree/master/data/0256Bukhari/0256Bukhari.Sahih) | Sultaniyyah (Bulaq 1311) as reproduced by Dar Tawq al-Najat, 1422, with 'Abd al-Baqi's numbering                                       | [1681](https://shamela.ws/book/1681) | 12,531 page markers; hadith numbers inline (`- 1 -`) in the sample checked |
| Sahih Muslim      | `0261Muslim.Sahih.Shamela0001727-ara1.mARkdown`                                                                             | ed. Muhammad Fu'ad 'Abd al-Baqi, 'Isa al-Babi al-Halabi, 1374/1955, 5 vols                                                             | [1727](https://shamela.ws/book/1727) | 8,752 page markers; 'Abd al-Baqi numbers inline (e.g. `(1907)`)            |
| Sunan Abi Dawud   | `0275AbuDawudSijistani.Sunan.Shamela0001726-ara1`                                                                           | ed. Muhyi al-Din 'Abd al-Hamid, al-Maktabah al-'Asriyyah, 4 vols                                                                       | [1726](https://shamela.ws/book/1726) | 7,207 page markers; numbers inline (e.g. `2201 -`)                         |
| Jami' al-Tirmidhi | `0279Tirmidhi.Sunan.Shamela0007895-ara2`                                                                                    | ed. Bashshar 'Awwad Ma'ruf, Dar al-Gharb al-Islami, 1996, 6 vols                                                                       | [7895](https://shamela.ws/book/7895) | 3,105 page markers; numbers inline (e.g. `١٦٤٧ -`); file has `@MATN@` tags |
| Sunan al-Nasa'i   | `0303Nasai.SunanSughra.Shamela0000829-ara1`                                                                                 | al-Maktabah al-Tijariyyah al-Kubra, Cairo, 1348/1930 (with al-Suyuti and al-Sindi); hadith numbering is Abu Ghuddah's, not the print's | [829](https://shamela.ws/book/829)   | 2,578 page markers                                                         |
| Sunan Ibn Majah   | `0273IbnMaja.Sunan.Shamela0001198-ara1`                                                                                     | ed. Muhammad Fu'ad 'Abd al-Baqi, Dar Ihya' al-Kutub al-'Arabiyyah, 2 vols                                                              | [1198](https://shamela.ws/book/1198) | 5,911 page markers                                                         |

Licence: same as section 1 (OpenITI CC BY-NC-SA 4.0; Shamela grants nothing).

sunnah.com: "We do not permit the scraping of our data, nor mass reproduction of entire books or
collections on other websites… If you would like a snapshot of hadith data, consider using our API.
Reproducing individual hadith or selections of hadith for a teaching/didactic/presentation purpose is
permitted" ([sunnah.com/about](https://sunnah.com/about)). The API needs a key requested through a
GitHub issue ([sunnah.com/developers](https://sunnah.com/developers)); the API repository has no
licence file. Use: link each cited hadith to its sunnah.com page for readers; do not copy its data
(its English translations are third-party and unlicensed for us).

Hadith citation format: `<book> <number>` in the numbering of the cited edition (e.g. "Muslim 1907,
ed. 'Abd al-Baqi"), plus vol/page. Grading (sahih/hasan/da'if) is shown only when quoted from a source
that states it (al-Tirmidhi's own verdict in the text, or the fiqh book's takhrij); the model does not
grade hadith.

## 3. RAG design

### 3.1 Ingestion

1. Fetch the pinned OpenITI files; for al-Jaziri, only if D3 allows (Shamela offers no bulk download
   licence; see section 1).
2. Parse OpenITI mARkdown: `### |` headings (kitab/bab/fasl levels), `# ` paragraphs, `~~` line
   continuations, `PageV<vol>P<page>` markers. A page marker ends the page it follows, so every
   character offset maps to exactly one (vol, page).
3. Strip footnote and editor blocks; keep the matn/sharh/hashiyah split as a `layer` field where the
   source marks it (Radd al-Muhtar: Durr vs Radd; Mughni: Khiraqi matn vs Ibn Qudamah).
4. Normalise for search only (remove tashkil and tatweel, unify alif/ya/ta marbuta forms); keep the
   original text for display and for quote checking.

### 3.2 Chunking by masalah

A chunk is one masalah (legal question), not a fixed token window:

- Comparative books: Bidayat al-Mujtahid is organised as "masa'il" with the disagreement and its
  cause (`sabab al-ikhtilaf`); split on its masalah headings. al-Jaziri writes each topic with
  per-madhab paragraphs (`الحنفية - قالوا: …`, `المالكية - قالوا: …`, as seen on
  [shamela.ws/book/9849/668](https://shamela.ws/book/9849/668)); split on those labels so each
  paragraph is tagged with its madhab.
- Madhab texts: split at the lowest heading level (fasl/mas'alah); paragraphs longer than ~1,200
  Arabic words are split at sentence ends with a 1-paragraph overlap. A chunk that crosses a page
  keeps a page range.
- Every chunk is labelled with a topic id from a shared taxonomy (kitab > bab > masalah, e.g.
  `taharah.wudu.nawaqid.touching-women`). The first labels come from headings; a scholar-assistant
  pass fixes the mapping for the evaluated topics. The taxonomy is what lets the four madhab
  retrievals meet on the same question.

Chunk metadata:

```json
{
  "chunk_id": "mughni:v1:p141:3",
  "book": "al-Mughni",
  "openiti_uri": "0620IbnQudamaMaqdisi.Mughni.Shamela0008463-ara1",
  "corpus_pin": "0625AH@f1e38210b32f",
  "edition": "Maktabat al-Qahirah 1388/1968",
  "author": "Ibn Qudamah",
  "layer": "sharh",
  "madhab": "hanbali",
  "source_role": "madhab_text",
  "vol": 1,
  "page_start": 141,
  "page_end": 142,
  "heading_path": ["كتاب الطهارة", "باب ما ينقض الطهارة", "مسألة"],
  "topic_id": "taharah.wudu.nawaqid.touching-women",
  "text": "…",
  "text_norm": "…"
}
```

`source_role` is `comparative` (Ibn Rushd, al-Jaziri), `madhab_text`, `quran` or `hadith`.
Comparative chunks also carry `madhabs_mentioned`. Page numbers in the example are illustrative.

### 3.3 Index

Hybrid retrieval: BM25 on `text_norm` plus dense vectors from a multilingual embedding model that
handles classical Arabic and Indonesian queries. The questions are asked in Indonesian or English, the
corpus is Arabic, so the query is first rewritten into (a) Arabic fiqh keywords and (b) a topic id
guess. On the current stack the natural fit is Cloudflare Vectorize plus D1 (metadata, BM25 via FTS5)
behind the existing Worker [design option; Vectorize/D1 FTS5 limits not checked].

### 3.4 Retrieval per madhab

For one question:

1. Classify the question to topic ids (top 3).
2. Run **five** filtered retrievals: one per madhab over `madhab_text` chunks, plus one over
   `comparative` chunks. Each returns top-k (k ≈ 6) after a cross-encoder rerank.
3. From the retrieved chunks, collect the dalil they cite (ayah references, hadith with book/number)
   and fetch those from the Quran/hadith store by reference, not by similarity.
4. A madhab has "retrieved support" only if at least one of its own-madhab chunks passes the rerank
   threshold. A comparative-work statement about a madhab is shown as "according to Ibn Rushd /
   al-Jaziri" and never replaces the madhab's own text.

### 3.5 Answer schema

The model returns JSON only; the app renders it. Free text outside the schema is discarded.

```json
{
  "question": "Apakah menyentuh lawan jenis membatalkan wudhu?",
  "topic_id": "taharah.wudu.nawaqid.touching-women",
  "agreement": "disagreement",
  "positions": [
    {
      "madhab": "hanafi",
      "status": "found",
      "summary_id": "…",
      "summary_en": "…",
      "dalil": [
        { "kind": "quran", "ref": "5:6" },
        { "kind": "hadith", "book": "abu-dawud", "number": 178, "edition": "ed. 'Abd al-Hamid" }
      ],
      "citations": [
        {
          "chunk_id": "radd:v1:p…",
          "book": "Radd al-Muhtar",
          "edition": "al-Babi al-Halabi 1386/1966",
          "vol": 1,
          "page": 0,
          "quote_ar": "exact substring of the chunk text"
        }
      ]
    },
    { "madhab": "maliki", "status": "not_found", "citations": [] }
  ],
  "agreed_by_all": null,
  "comparative_notes": [{ "source": "Bidayat al-Mujtahid", "vol": 1, "page": 0, "quote_ar": "…" }],
  "disclaimer_key": "fiqh.notFatwa"
}
```

Rules:

- `positions` always has four entries in fixed order (Hanafi, Maliki, Shafi'i, Hanbali); the app shows
  them with identical layout. No "strongest view", "preferred", "rajih" or recommendation fields exist,
  and the prompt forbids tarjih; the neutrality check (3.7) rejects answers that contain it.
- `agreement = "agreed_by_all"` only if all four positions are `found` and a cited comparative or
  madhab source states the agreement (ijma'/ittifaq) in the quoted text. Four matching summaries are
  not enough.
- Summaries (Indonesian and English) are generated; quotes are not. Quotes must be exact substrings of
  retrieved chunks.
- Each answer ends with the "not a fatwa, ask a scholar for your situation" notice (i18n keys in id
  and en).

### 3.6 Refusal

- A madhab whose position was not retrieved gets `status: "not_found"` and the app shows "Position of
  the X madhab not found in the sources" with no summary. The model is never allowed to fill it from
  memory.
- If fewer than two madhabs are found, or the topic classifier is unsure, the whole answer becomes "not
  covered by the sources" with links to the closest topics.
- Out-of-scope questions get a fixed refusal: personal fatwa on a specific situation (divorce,
  inheritance shares, takfir, medical or legal emergencies), aqidah disputes, questions about
  individuals. These go to "ask a scholar".

### 3.7 Citation verification (before anything is shown)

Deterministic checks in the Worker, after the model returns:

1. Schema valid; four madhabs in order; no forbidden fields.
2. Every `chunk_id` was in the retrieved set for this request.
3. Every `quote_ar` is an exact substring of that chunk's original text (after whitespace
   normalisation only). The vol/page shown are recomputed from the quote's offset and the page
   markers, never taken from the model.
4. Every Quran ref exists in the Tanzil file; every hadith number exists in the pinned hadith file
   for that edition.
5. A quoted citation for madhab X comes from a chunk tagged X (or from a comparative chunk, labelled as
   such).
6. Neutrality filter: reject if summaries contain preference wording (Indonesian/English/Arabic word
   list: "yang lebih kuat", "paling benar", "rajih", "the correct view", "الراجح", …), with a second
   model-graded check in the evaluation, not at runtime.

Failures drop the offending position to `not_found` (one retry with the error fed back); a failed
agreement claim becomes `disagreement` or `unknown`. Optional extra check: Shamela's MCP service says it
can "resolve printed page references, and mechanically check quotations"
([terms](https://shamela.ws/page/terms)); it could be used offline in the evaluation to confirm that
our vol/page equals Shamela's [API details not checked].

### 3.8 Caching and cost control

Answers are cached by (topic_id, corpus_pin, prompt version), so popular questions are generated once
and reviewed. A reviewed answer can be frozen and served without a model call.

## 4. Evaluation plan

### Question set

- **Size:** 200 questions. 160 in-scope, spread over the babs Indonesian users ask about most:
  taharah (30), salah (40), sawm (25), zakat (20), hajj/umrah (15), nikah/talaq (15), mu'amalat (15).
  40 negative questions: out-of-scope personal fatwa, a topic where one madhab has no position in our
  texts, leading questions that ask "which madhab is right", and questions with false premises.
- **Gold answers:** written by the scholar reviewer (D4) before the system is run on them: for each
  madhab the position, the book/vol/page where it is stated in our editions, the main dalil, and
  whether the four agree. Questions where madhab-internal disagreement makes "the position" unclear are
  marked so the system can be graded on showing that.
- **Split:** 50 for development (prompt and threshold tuning), 150 held out and only run for release
  candidates.

### Metrics and pass bar (held-out set)

| Metric                                                                    | How measured                     | Pass bar |
| ------------------------------------------------------------------------- | -------------------------------- | -------- |
| Citation validity: quote exists at the stated book/vol/page               | Automatic (3.7) + spot check     | 100%     |
| Wrong attribution: a position shown for madhab X that is not X's position | Scholar grading                  | 0 cases  |
| Position correctness for `found` positions                                | Scholar grading against gold     | ≥ 95%    |
| Coverage: gold says found, system says found                              | Automatic against gold           | ≥ 85%    |
| "Agreed by all" precision                                                 | Scholar grading                  | 100%     |
| Neutrality: no tarjih or preference wording                               | Word list + scholar read-through | 0 cases  |
| Correct refusal on negative questions                                     | Scholar grading                  | ≥ 95%    |
| Dalil relevance (cited dalil is the one the madhab text uses)             | Scholar grading                  | ≥ 90%    |
| Indonesian summary faithful to the Arabic quote                           | Scholar or bilingual reviewer    | ≥ 95%    |

A release needs every bar met on the held-out set and written sign-off from the scholar reviewer. Any
wrong attribution or fabricated citation found after release disables the topic (a server flag per
topic_id) until fixed and re-reviewed.

### Ongoing

- In-app "report a problem" on each position, routed to the reviewer.
- Re-run the held-out set on every prompt, model or corpus pin change.

## 5. Open decisions for the owner

1. **D1 Licence and pricing.** OpenITI is CC BY-NC-SA 4.0 (non-commercial, share-alike). Choose: keep
   the companion free for all users, ask OpenITI/KITAB for permission to use it in Premium, or obtain a
   legal opinion on the public-domain status of the classical texts. Until decided, the feature cannot
   be Premium.
2. **D2 Indonesian translations.** Whether to show any published Indonesian translation (Kemenag
   Quran translation, translated fiqh books) or only Waqtu-generated summaries of the Arabic. Published
   translations need written publisher permission for a commercial app; Tanzil's own terms say its
   translations are non-commercial only.
3. **D3 al-Jaziri.** Not in OpenITI; only on Shamela, which grants no reuse rights. Choose: drop it
   (Ibn Rushd remains as the comparative source), get permission from the edition's publisher (Dar
   al-Kutub al-'Ilmiyyah), or use it only for evaluation and links, not as quoted corpus.
4. **D4 Scholar reviewer.** Who reviews (one scholar per madhab, or one comparative-fiqh scholar plus
   spot reviewers), the time budget for 200 gold answers, payment, and whether their name is shown in
   the app.
5. **D5 Model and provider.** Hosted LLM (needs strong classical Arabic and Indonesian, JSON output,
   data-processing terms that allow user questions) versus Cloudflare Workers AI models; embedding
   model choice. Candidate models were not benchmarked in this research; pick 2–3 and run the
   development set.
6. **D6 Which text speaks for each madhab.** Hanafi: Radd al-Muhtar first (al-Hidayah has no
   print-paginated standalone version in OpenITI). Hanbali: Kashshaf al-Qina' / Sharh Muntaha versus
   al-Mughni. Shafi'i: Minhaj (with which sharh?) versus al-Majmu'. Maliki: Mukhtasar Khalil alone is
   terse; a sharh (e.g. al-Dardir, al-Dasuqi) may be needed. The scholar reviewer should confirm.
7. **D7 Cost and tier.** Per-answer cost is about five retrievals plus one long-context generation;
   caching reviewed answers per topic cuts it. The marketing plan rules out subscriptions
   (`docs/marketing/marketing-strategy.md`), so a recurring model cost against a one-time Premium
   purchase needs a cap (questions per day) or a free curated-answers-only mode.
8. **D8 Scope at launch.** Launch with only the reviewed topics (curated, frozen answers) and open
   free-form questions later, or open free-form from day one behind the refusal rules.

## Sources

- OpenITI documentation (licence, copyright removal): <http://openiti.org/documentation/>
- OpenITI Terms of Use: <https://openiti.org/docs/Terms%20of%20Use.html>
- OpenITI release 2025.1.9 on Zenodo: <https://doi.org/10.5281/zenodo.17767721>; latest release DOI:
  <https://doi.org/10.5281/zenodo.3082463>
- OpenITI text repositories: <https://github.com/OpenITI>
- Shamela terms: <https://shamela.ws/page/terms>; old help page: <https://old.shamela.ws/help.php/page/1>
- Shamela book cards: 21739, 9849, 9403, 427, 21613, 11355, 12096, 2186, 8463, 21642, 1681, 1727,
  1726, 7895, 829, 1198 (`https://shamela.ws/book/<id>`)
- sunnah.com about and developers: <https://sunnah.com/about>, <https://sunnah.com/developers>
- Tanzil translations and terms: <https://tanzil.net/trans/>; Quran text terms: `content/quran/README.md`
