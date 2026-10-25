# Recitation mistake detection: model evaluation and alignment (DEV-15)

Goal: Tarteel-like checking for murojaah. The reciter records a hafalan unit; an on-device speech
model transcribes it; the transcript is aligned word by word to the expected ayat, and skipped
words, replaced words and jumps to the wrong ayah are highlighted. Tajweed and pronunciation
scoring are out of scope. Everything runs on the phone: recordings never leave the device (see
`content/quran/README.md`, "Recitation recordings").

Status of this document: model facts below were read from the Hugging Face model cards and the
Hub API on 2026-10-25. **No model has been run on a phone yet**; the alignment engine and the
acceptance harness exist and are tested, the on-device part is the remaining work (see
[What is still missing](#what-is-still-missing-for-the-acceptance-criteria)).

## Candidate models

Licences are quoted exactly as the model card states them (YAML `license` field). WER figures are
the card's own, unverified by us, and measured on the authors' own split, mostly on EveryAyah
(professional reciters, studio audio), which says little about a memoriser reciting from memory
into a phone.

### Whisper fine-tunes (run with whisper.cpp / whisper.rn)

| Model (Hugging Face)                                                                                                                    | Base                             | Size (weights)               | On-device file found on the Hub                                                                                                                                                                                                                                                            | Licence (card) | Training data (card)                                                                                     | Published WER (card)                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [tarteel-ai/whisper-base-ar-quran](https://huggingface.co/tarteel-ai/whisper-base-ar-quran)                                             | openai/whisper-base (74M params) | `pytorch_model.bin` 290.5 MB | ggml f16 148.0 MB, ggml q8_0 81.8 MB: [ram-a-dhan/tarteel-whisper-quran-ggml](https://huggingface.co/ram-a-dhan/tarteel-whisper-quran-ggml), [sadrapp/whisper-base-ar-quran-ggml](https://huggingface.co/sadrapp/whisper-base-ar-quran-ggml) (both `apache-2.0`)                           | `apache-2.0`   | not stated ("fine-tuned … on the None dataset"); [UNVERIFIED] presumably Tarteel's EveryAyah             | 5.7544 (eval set, unnamed)                                              |
| [tarteel-ai/whisper-tiny-ar-quran](https://huggingface.co/tarteel-ai/whisper-tiny-ar-quran)                                             | openai/whisper-tiny (39M)        | 151.1 MB                     | ggml f16 77.7 MB, q8_0 43.5 MB ([ram-a-dhan/tarteel-whisper-quran-ggml](https://huggingface.co/ram-a-dhan/tarteel-whisper-quran-ggml)); ONNX for transformers.js ([Sharjeelbaig/whisper-tiny-ar-quran-onnx](https://huggingface.co/Sharjeelbaig/whisper-tiny-ar-quran-onnx), `apache-2.0`) | `apache-2.0`   | not stated                                                                                               | 7.0535 (eval set, unnamed)                                              |
| [deepdml/whisper-base-ar-quran-mix-norm](https://huggingface.co/deepdml/whisper-base-ar-quran-mix-norm)                                 | openai/whisper-base              | `model.safetensors` 290.4 MB | none found (convert ourselves)                                                                                                                                                                                                                                                             | `apache-2.0`   | `tarteel-ai/everyayah`, `tarteel-ai/EA-UD`                                                               | 0.1620 (model-index on everyayah; the training table suggests percent)  |
| [deepdml/whisper-small-ar-quran-mix-norm](https://huggingface.co/deepdml/whisper-small-ar-quran-mix-norm)                               | openai/whisper-small (244M)      | 967.0 MB                     | ggml q3 113.8 MB ([ek-1999/gguf-deepdml-whisper-small-ar-quran-mix](https://huggingface.co/ek-1999/gguf-deepdml-whisper-small-ar-quran-mix), `apache-2.0`, no card text)                                                                                                                   | `apache-2.0`   | `tarteel-ai/EA-UD`, `tarteel-ai/everyayah`                                                               | 0.0254 (on EA-UD)                                                       |
| [deepdml/whisper-tiny-ar-quran-mix-norm](https://huggingface.co/deepdml/whisper-tiny-ar-quran-mix-norm)                                 | openai/whisper-tiny              | 151.1 MB                     | none found                                                                                                                                                                                                                                                                                 | `apache-2.0`   | everyayah, `deepdml/tlog-clean-sf16k`, EA-UD                                                             | 3.392 (on everyayah)                                                    |
| [MaddoggProduction/whisper-small-quran-lora-dataset-mix](https://huggingface.co/MaddoggProduction/whisper-small-quran-lora-dataset-mix) | openai/whisper-small             | 967.0 MB                     | ggml q8_0 264.5 MB, q4_0 145.5 MB (same author, `…-q8-ggml`, `…-q4_0-ggml`; no licence tag or card on those repos)                                                                                                                                                                         | `apache-2.0`   | train: `MohamedRashad/Quran-Recitations`, `tarteel-ai/everyayah`; test: `ahishamm/QURANICWhisperDataset` | 10.8% on a random 20% of the QURANICWhisperDataset test set             |
| [naazimsnh02/whisper-large-v3-turbo-ar-quran](https://huggingface.co/naazimsnh02/whisper-large-v3-turbo-ar-quran)                       | openai/whisper-large-v3-turbo    | 1617.8 MB                    | ggml q5_0 574.0 MB ([naderideas/whisper-large-v3-turbo-ar-quran-ggml](https://huggingface.co/naderideas/whisper-large-v3-turbo-ar-quran-ggml), `apache-2.0`)                                                                                                                               | `apache-2.0`   | `tarteel-ai/everyayah` (LoRA r=128)                                                                      | 1.18% WER / 0.34% CER on the full everyayah test split (23,473 samples) |

### Non-Whisper models (for comparison)

| Model                                                                                                                                 | Kind                                                      | Size           | Licence (card)                                                     | Notes                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [mohammed/fastconformer-quran-ar](https://huggingface.co/mohammed/fastconformer-quran-ar)                                             | NVIDIA FastConformer hybrid RNNT/CTC, 114.6M params, NeMo | `.nemo` 459 MB | `cc-by-4.0`                                                        | everyayah; card claims 0.14% WER on the everyayah validation set. No mobile export published; would need NeMo → ONNX (sherpa-onnx). CTC/transducer output is less inclined than Whisper's decoder to "complete" a verse the reciter cut short. |
| [Muno459/fastconformer-quran](https://huggingface.co/Muno459/fastconformer-quran)                                                     | FastConformer, ONNX q8 131.8 MB                           |                | `other` (`license_name: npl-1.1`; gated, licence text needs login) | Licence not open; not usable without reading and accepting NPL-1.1.                                                                                                                                                                            |
| [Quran-Lab/zipformer_p-arabic-v3](https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3)                                             | Zipformer, ONNX int8 72.7 MB, Core ML                     |                | `other` (`quran-lab-npl-1.2`, gated)                               | Gate terms forbid charging "for any feature it powers"; excluded unless Waqtu commits to that.                                                                                                                                                 |
| [rabah2026/wav2vec2-large-xlsr-53-arabic-quran-v_final](https://huggingface.co/rabah2026/wav2vec2-large-xlsr-53-arabic-quran-v_final) | wav2vec2 XLSR CTC                                         | 1262 MB        | `apache-2.0`                                                       | No training data or WER on the card; too large for a phone unquantised.                                                                                                                                                                        |

Training-data caveat: the EveryAyah dataset card ([tarteel-ai/everyayah](https://huggingface.co/datasets/tarteel-ai/everyayah))
says "Licensing of the individual recordings is not documented. Use at your own risk. The remainder
of the dataset is CC BY 4.0." The model weights above carry their own `apache-2.0` licence, which is
what the app would ship; the provenance question of the training audio stays with the model authors.

## On-device runtimes for Expo / React Native

The mobile app is Expo SDK 57 / React Native 0.86 (development builds, not Expo Go). Any of these
needs native code, so it goes in through a config plugin or prebuild, and CI builds it.

| Runtime                                                                                                                                 | Licence                                    | What it runs                                                                         | Notes                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [whisper.rn](https://github.com/mybigday/whisper.rn) (npm `whisper.rn` 0.7.4) on [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT (npm and GitHub)                       | ggml Whisper models; optional Core ML encoder on iOS; Hexagon NPU path on Snapdragon | README: "You will need to prebuild the project before using it" for Expo. Returns `{ result, language, segments[{ text, t0, t1 }], isAborted }`, which the harness reads directly. Used for Quran models by [ram-a-dhan/reciter](https://github.com/ram-a-dhan/reciter) (stated on the model card). |
| [react-native-executorch](https://github.com/software-mansion/react-native-executorch) 0.10.7                                           | npm: MIT; GitHub reports `NOASSERTION`     | ExecuTorch `.pte` exports (has Whisper support)                                      | Peer deps on `react-native-worklets`, `react-native-blob-util`, a background downloader. Would need our own `.pte` export of the chosen fine-tune.                                                                                                                                                  |
| [onnxruntime-react-native](https://www.npmjs.com/package/onnxruntime-react-native) 1.24.3                                               | MIT                                        | ONNX models (e.g. the `transformers.js` ONNX exports listed above)                   | Whisper decoding loop (tokeniser, beam/greedy, KV cache) is ours to write.                                                                                                                                                                                                                          |
| [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (`react-native-sherpa-onnx` 0.4.4)                                                 | Apache-2.0 (sherpa-onnx), MIT (RN wrapper) | ONNX Whisper, transducer and CTC models                                              | The route for a FastConformer/Zipformer CTC model if Whisper proves to fill in skipped words.                                                                                                                                                                                                       |

## Recommendation

**Start with `tarteel-ai/whisper-base-ar-quran`, converted to ggml q8_0 (about 82 MB), run through
whisper.rn**, with the tiny model (q8_0, about 44 MB) as the fallback for low-memory phones.

- Licence: `apache-2.0` on the card; the base Whisper code and weights are MIT. Shipping or
  downloading the weights in a free or paid app is allowed with the licence notice.
- Size: about 82 MB fits a mid-range Android (3–4 GB RAM) for a half-page unit; small (145–265 MB
  quantised) and large-v3-turbo (574 MB) are too heavy to be the default.
- Proven path: the same model through whisper.rn / whisper.cpp is what two published Quran apps
  say they use (cards of `ram-a-dhan/tarteel-whisper-quran-ggml` and `sadrapp/whisper-base-ar-quran-ggml`).
- Output format: trained on EveryAyah, whose text is imla'i with harakat ("بِسْمِ اللَّهِ الرَّحْمَنِ
  الرَّحِيمِ"), which `normalizeArabic` maps onto the Uthmani text (checked over the whole Quran, see
  below).
- Convert it ourselves with whisper.cpp's `models/convert-h5-to-ggml.py` from the pinned Tarteel
  revision rather than ship a third-party conversion that has no card; the Sadr card notes that the
  source `config.json` carries a wrong `max_length` (1024) and that the standard decoder context
  (448) has to be used.
- Download it on first use of the feature (not bundled), so the app size does not grow by 82 MB.

Contenders for the device test, same harness: `deepdml/whisper-base-ar-quran-mix-norm` (same size,
lower reported WER on everyayah) and, if accuracy on non-professional reciters is poor,
`MaddoggProduction/whisper-small-quran-lora-dataset-mix` q4_0 (trained on more varied recitations).

Main risk for skip detection: a Whisper decoder fine-tuned on the Quran has learnt the text, so it
may **write a word the reciter skipped**, which hides exactly the mistake we want to catch. Decode
with temperature 0, no initial prompt containing the expected text and no conditioning on previous
segments, and measure it with the harness on recordings with real skips. If recall stays below 90%
because of this, switch to a CTC model (FastConformer, `cc-by-4.0`, through sherpa-onnx).

## Alignment engine (`packages/core/src/recitation.ts`)

```ts
import { alignRecitation, normalizeArabic, sameWord, wordDistance } from "@waqtu/core";

const result = alignRecitation(
  expected, // ExpectedAyah[]: { surah, ayah, text } with Tanzil's stored text, in reading order
  transcript, // ASR text (imla'i or Uthmani, harakat optional)
  { context: surahAyat, minJumpWords: 3 }, // where to look for wrong-ayah jumps
);
// result.words[]: { surah, ayah, word, bismillah, text, status, heard[] }
//   status: "correct" | "skipped" | "substituted" | "omitted" (optional Bismillah not recited)
// result.inserted[], result.jumps[] ({ kind: "jump" | "repeat", at, start, end, ... }),
// result.skippedAyahs[], result.formulas[] (isti'adha / Bismillah / sadaqallah set aside), result.counts
```

- `word` is 0-based among the ayah's words after `splitBismillah`, i.e. the same numbering as the
  hafalan screen (`unitBlocks`), so a result maps straight onto the words it shows.
- Normalisation: harakat, Quranic marks, tatweel and hamza marks removed; alef forms, ؤ, ئ, ى, ة
  folded; the Uthmani dagger alef turned into the alef imla'i writes (and وٰ into ا, ىٰ into ى);
  the small waw/ya of a lengthened pronoun dropped; a sad under a small seen read as seen.
- Word match: a weighted edit distance in which long-vowel letters (ا و ي) and a doubled letter cost
  0.25 and any other letter 1; two words are the same at ≤ 0.5 (≤ 0.25 for one- or two-letter
  words). So a reciter's mistake that changes only a long vowel (قال/قل) is not flagged; that is the
  price of comparing Uthmani with imla'i spelling.
- Alignment: dynamic programming over expected words × heard words with skip, insert, substitute,
  and "one word heard as two" / "two words heard as one" (يَٰٓأَيُّهَا vs يا أيها). Cost O(n·m);
  meant for one hafalan unit (half a page) at a time.
- Jumps: a run of at least `minJumpWords` heard words that match nothing expected is looked up in
  the expected ayat and `context`. Found before the current position in the range it is a `repeat`
  (going back, not a mistake); anywhere else a `jump`, and the expected words it displaced are
  reported as skipped.

Checks run while building it (development only, not in CI):

- Whole Quran against Tanzil's own imla'i texts (`simple-clean` and `simple`, downloaded from
  tanzil.net on 2026-10-25, not committed): each of the 6236 ayat aligned to its Uthmani text gives
  **0 skipped flags and 1 substitution out of 77,433 words** (72:16 وَأَلَّوِ, written وأن لو in
  imla'i). Word by word, all 70,798 words of the ayat whose word counts match are judged the same word.
- Synthetic mistakes on random ranges of 1–4 ayat with the imla'i text (1,000 draws, kept when the
  imla'i and Uthmani word counts agree; about 5% of words skipped and 2% replaced by a random Quran
  word, never two mistakes in a row; in 20% of them a 4–6 word piece of another ayah inserted, that
  ayah given as context): skip recall 98.6% (209/212), false skip flags 0.17% (7 of 4,101 clean words), substitution
  recall 96%, and 63 of the 64 inserted pieces reported as jumps.
- Speed (Apple Silicon Mac, Bun): one mushaf page (134 words) against all of Al-Baqarah as context
  19 ms; five pages (630 words) 108 ms. [UNVERIFIED] on a mid-range Android under Hermes.

The committed tests (`packages/core/test/recitation.test.ts`) cover the normaliser on real ayat,
splits/joins, the optional Bismillah, formulas, skips (word, repeated word, whole ayah),
substitutions, insertions, repeats, wrong-ayah jumps, every 7th ayah of the Quran recited exactly,
and a seeded synthetic run over 300 random ranges (skip recall ≥ 95%, false flags ≤ 1%).

## Acceptance harness (`packages/core/scripts/recitation-eval.ts`)

```sh
bun run --filter @waqtu/core eval:recitation path/to/manifest.json          # report
bun run --filter @waqtu/core eval:recitation path/to/manifest.json --json   # machine-readable
bun packages/core/scripts/recitation-eval.ts path/to/manifest.json --check  # exit 1 unless accepted
```

The manifest lists recitations with the ASR output (a whisper.rn result JSON, `{ text }`,
`segments[].text`, a `.txt`, or inline `text`), the expected range (`"67:1-5"`, `"113:5-114:2"`) and
the labelled mistakes (`skip` of a word `S:A:W` with W 1-based, or of a whole ayah `S:A`;
`substitution`; `jump` at the expected ayah). The format is documented at the top of the script;
`packages/core/test/fixtures/recitation/manifest.json` is a working example.

It reports per recitation and in total: skipped-word recall (labelled skips reported as skipped),
the false-flag rate (words without a labelled mistake reported as skipped, over all such words),
the same rate counting substitutions too, substitution recall and wrong-ayah jumps found. `--check`
passes only with ≥ 50 recitations, recall ≥ 90% and false flags ≤ 5%.

## What is still missing for the acceptance criteria

1. **Labelled test set**: 50 murojaah recordings (several reciters, Indonesian memorisers rather
   than professional qaris, phone microphones) with their expected ranges and every skipped,
   replaced and jumped word labelled by someone who knows the text, plus written consent from the
   reciters. Recordings stay off the repository.
2. **Model files**: the ggml q8_0 conversion of `tarteel-ai/whisper-base-ar-quran` (and tiny),
   with SHA-256, hosting for the on-demand download (e.g. R2) and the Apache-2.0 notice in the app's
   licences screen.
3. **Transcripts**: the 50 recordings transcribed by that model through whisper.cpp with the
   settings the app will use (language `ar`, temperature 0, no prompt), saved as whisper.rn JSON;
   then the harness run with `--check`.
4. **Device test**: whisper.rn in a development build on a mid-range Android (e.g. 4 GB RAM,
   Snapdragon 6-series) in airplane mode: transcription time per half-page unit, peak memory, and
   the same 50-recording result. Not done here: no model is integrated in the app in this change.
