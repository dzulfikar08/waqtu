import { StyleSheet, useColorScheme, type TextStyle, type ViewStyle } from "react-native";

import type { DayPeriod } from "@/prayer/period";

/**
 * Design tokens, taken from apps/apple. Dark mode is the macOS menu bar popover (`MenuBarView.swift`): a near-black
 * page, one slightly lighter card per section with hairline separators, light text, muted green labels and gold for
 * the live countdown. Light mode is the iOS companion (`WaqtuColors.swift`, `TodayView.swift`): #F7F7FA page, white cards
 * with a soft shadow, teal accent and slate secondary.
 */
export const palette = {
  primary: "#4A8B6F",
  primaryLight: "#6BA888",
  primaryDark: "#2D5F4C",
  teal: "#12877D",
  gold: "#D4A574",
  secondary: "#6B8FAD",
  secondaryDark: "#5A7D9A",
} as const;

export interface Theme {
  dark: boolean;
  /** The page behind the cards. */
  background: string;
  /** Card fill. */
  surface: string;
  /** Fill inside a card: stepper buttons, an inset list, a selected segment. */
  surfaceAlt: string;
  /** Primary text. */
  text: string;
  /** Secondary text: labels, captions, section titles. */
  muted: string;
  /** Tertiary text: passed prayer times, disabled rows, hints. */
  faint: string;
  accent: string;
  /** Text and glyphs on an `accent` fill. */
  accentText: string;
  /** Soft accent wash: the next prayer's row, an icon chip, the active tab. */
  accentSoft: string;
  /** Outline of a control: checkbox ring, an unselected chip, a secondary button. Always visible on `surface`. */
  border: string;
  /** Hairline between rows and around cards. */
  separator: string;
  secondary: string;
  secondarySoft: string;
  /** The live countdown and other highlights: gold on the dark popover, teal on iOS. */
  countdown: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  /** Second-level alert, e.g. a replaced word in the recitation check. */
  warning: string;
  warningSoft: string;
  /** Dim layer behind a sheet or a dialog. */
  scrim: string;
  /** Floating tab bar fill. */
  tabBar: string;
}

export const lightTheme: Theme = {
  dark: false,
  background: "#F7F7FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F2F4",
  text: "#14221C",
  muted: "#5E6E68",
  faint: "#98A39F",
  accent: palette.teal,
  accentText: "#FFFFFF",
  accentSoft: "rgba(18,135,125,0.10)",
  border: "#C9D0D4",
  separator: "#E6E8EC",
  secondary: palette.secondary,
  secondarySoft: "rgba(107,143,173,0.14)",
  countdown: palette.teal,
  gold: "#A8743F",
  goldSoft: "rgba(212,165,116,0.20)",
  danger: "#B3261E",
  dangerSoft: "rgba(179,38,30,0.10)",
  warning: "#B45309",
  warningSoft: "rgba(180,83,9,0.12)",
  scrim: "rgba(0,0,0,0.40)",
  tabBar: "#FFFFFF",
};

export const darkTheme: Theme = {
  dark: true,
  background: "#0C1412",
  surface: "#16211E",
  surfaceAlt: "#21302B",
  text: "#E8F0ED",
  muted: "#A9BDB5",
  faint: "#6C8079",
  accent: palette.primaryLight,
  accentText: "#0E1A15",
  accentSoft: "rgba(107,168,136,0.16)",
  border: "#4C6B5D",
  separator: "rgba(232,240,237,0.09)",
  secondary: palette.secondary,
  secondarySoft: "rgba(107,143,173,0.18)",
  countdown: palette.gold,
  gold: palette.gold,
  goldSoft: "rgba(212,165,116,0.16)",
  danger: "#FFB4AB",
  dangerSoft: "rgba(255,180,171,0.14)",
  warning: "#FCD34D",
  warningSoft: "rgba(252,211,77,0.14)",
  scrim: "rgba(0,0,0,0.60)",
  tabBar: "#1B2925",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Least size of anything tappable (iOS 44 pt, Android 48 dp is met with hitSlop). */
export const HIT = 44;

/** Clock times and counters: digits of one width, so a column of times lines up. */
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

/** Text sizes, so every screen uses the same scale. */
export const typography = {
  largeTitle: { fontSize: 30, fontWeight: "700", letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.2 },
  headline: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 16 },
  callout: { fontSize: 15 },
  subhead: { fontSize: 14 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
  /** Uppercase label above a section or a figure. */
  overline: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

/**
 * Card chrome. Light: a hairline plus a very soft two-layer `boxShadow` (drawn the same on Android and iOS; Android's
 * `elevation` left dark blobs at the rounded corners). Dark: a hairline only, where a shadow does not read.
 */
export function cardChrome(theme: Theme): ViewStyle {
  return theme.dark
    ? { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.separator }
    : {
        backgroundColor: theme.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(16,24,40,0.08)",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 6px 16px -4px rgba(16,24,40,0.08)",
      };
}

/** A section's own colour, so each part of the app is recognisable at a glance and not all green. */
export type Hue =
  | "brand"
  | "prayer"
  | "streak"
  | "hafalan"
  | "halaqah"
  | "ramadhan"
  | "circles"
  | "week"
  | "neutral";

/** [light, dark] base colour per hue, as r,g,b. */
const HUES: Record<Hue, readonly [string, string]> = {
  brand: ["18,135,125", "107,168,136"],
  prayer: ["43,123,216", "125,183,245"],
  streak: ["217,119,6", "242,180,92"],
  hafalan: ["14,116,144", "92,198,217"],
  halaqah: ["124,77,204", "183,154,242"],
  ramadhan: ["176,120,40", "212,165,116"],
  circles: ["209,65,106", "242,139,168"],
  week: ["79,91,213", "155,164,245"],
  neutral: ["90,125,154", "168,184,200"],
};

export interface HueColors {
  /** Icons, figures and progress fills. */
  base: string;
  /** Icon badge fill. */
  soft: string;
  /** Barely-there card tint. */
  wash: string;
}

export function hueColors(theme: Theme, hue: Hue): HueColors {
  const rgb = HUES[hue][theme.dark ? 1 : 0];
  return {
    base: `rgb(${rgb})`,
    soft: `rgba(${rgb},${theme.dark ? 0.18 : 0.12})`,
    wash: `rgba(${rgb},${theme.dark ? 0.09 : 0.06})`,
  };
}

/** A wash of the section's hue behind a screen's header, fading out downwards (`Screen` `backdrop`). */
export function hueWash(theme: Theme, hue: Hue): string {
  const rgb = HUES[hue][theme.dark ? 1 : 0];
  const top = theme.dark ? 0.4 : 0.22;
  return `linear-gradient(180deg, rgba(${rgb},${top}) 0%, rgba(${rgb},0) 100%)`;
}

/** A card tinted by its section's hue: a soft wash in the top-left corner fading into the card colour. */
export function tintedCard(theme: Theme, hue: Hue): ViewStyle {
  const { wash } = hueColors(theme, hue);
  return {
    ...cardChrome(theme),
    experimental_backgroundImage: `linear-gradient(135deg, ${wash} 0%, ${theme.surface} 70%)`,
  };
}

/** Sky colours per part of the day, top-left to bottom-right: [light, dark]; dark is the same sky, dimmed. */
const SKIES: Record<DayPeriod, readonly [readonly string[], readonly string[]]> = {
  fajr: [
    ["#3B4A9E", "#7A6BC4", "#D99BB0"],
    ["#262F66", "#433A7A", "#6A4870"],
  ],
  sunrise: [
    ["#2F7FC9", "#5DAEE3", "#F2C57C"],
    ["#18406A", "#245A85", "#6A5C3E"],
  ],
  dhuhr: [
    ["#1A72C7", "#3B9EEB", "#7CCBF7"],
    ["#123A63", "#1C5788", "#2672A6"],
  ],
  asr: [
    ["#C9702A", "#E39A3E", "#F2C46B"],
    ["#5A3313", "#7E4A1B", "#9C6524"],
  ],
  maghrib: [
    ["#B23A5B", "#DD5F4B", "#F29C58"],
    ["#5A2034", "#813041", "#9E4F38"],
  ],
  isha: [
    ["#171B47", "#2A2B72", "#47398A"],
    ["#11163A", "#1D2257", "#2E2B6E"],
  ],
};

/** The sky of `period` as a CSS gradient for `experimental_backgroundImage`. */
export function skyGradient(period: DayPeriod, dark: boolean, angle = 150): string {
  const stops = SKIES[period][dark ? 1 : 0];
  return `linear-gradient(${angle}deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;
}

/** A wash of `period`'s sky behind the Today header, fading out downwards (`Screen` `backdrop`). */
export function skyWash(period: DayPeriod, dark: boolean): string {
  const tone = SKIES[period][dark ? 1 : 0][1];
  return `linear-gradient(180deg, ${tone}${dark ? "73" : "40"} 0%, ${tone}00 100%)`;
}

/** The middle colour of `period`'s sky, for the hero's coloured shadow and a sky-coloured glyph. */
export function skyTone(period: DayPeriod, dark: boolean): string {
  return SKIES[period][dark ? 1 : 0][1];
}

/** One colour per prayer for its glyph in the times list: [light, dark]. */
const PRAYER_TONES: Record<DayPeriod, readonly [string, string]> = {
  fajr: ["#6E5FC0", "#A99BF0"],
  sunrise: ["#D18A1F", "#F2C063"],
  dhuhr: ["#2B7BD8", "#7DB7F5"],
  asr: ["#D9772B", "#F2A65C"],
  maghrib: ["#CC4A5E", "#F28C8C"],
  isha: ["#4A4FB0", "#9BA4F5"],
};

export function prayerTone(period: DayPeriod, dark: boolean): string {
  return PRAYER_TONES[period][dark ? 1 : 0];
}

/** Text and glyphs drawn on a sky gradient. */
export const onSky = {
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.78)",
  faint: "rgba(255,255,255,0.55)",
  glass: "rgba(255,255,255,0.18)",
  glassStrong: "rgba(255,255,255,0.28)",
  line: "rgba(255,255,255,0.22)",
} as const;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}
