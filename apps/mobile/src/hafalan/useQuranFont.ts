import { useFonts } from "expo-font";

const QURAN_FONT = "AmiriQuran";

/**
 * Amiri Quran (SIL OFL 1.1), bundled in assets/fonts. `family` is undefined until it has loaded
 * (or if it fails), when the system's Arabic font draws the text instead.
 */
export function useQuranFont(): { family: string | undefined } {
  const [loaded] = useFonts({
    [QURAN_FONT]: require("../../assets/fonts/AmiriQuran-Regular.ttf"),
  });
  return { family: loaded ? QURAN_FONT : undefined };
}
