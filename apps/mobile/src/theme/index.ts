import { useColorScheme, type TextStyle, type ViewStyle } from "react-native";

/**
 * Design tokens, taken from apps/apple. Dark mode is the macOS menu bar popover (`MenuBarView.swift`): a near-black green
 * page, one slightly lighter green card per section with hairline separators, light text, muted green labels and gold for
 * the live countdown. Light mode is the iOS companion (`WaqtuColors.swift`, `TodayView.swift`): #F7F7FA page, white cards
 * with a soft shadow, teal accent and slate secondary.
 */
export const palette = {
  primary: "#4A8B6F",
  primaryLight: "#6BA888",
  primaryDark: "#2D5F4C",
  macBackground: "#1A2E25",
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
  background: "#0E1A15",
  surface: palette.macBackground,
  surfaceAlt: "#243B31",
  text: "#E8F0ED",
  muted: "#A8C9B8",
  faint: "#6E8A7D",
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
  tabBar: "#1E352B",
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
 * Card chrome: a soft shadow on light (iOS `.shadow(color: .black.opacity(0.05), radius: 10, y: 4)`), a hairline on dark
 * where a shadow does not read.
 */
export function cardChrome(theme: Theme): ViewStyle {
  return theme.dark
    ? { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.separator }
    : {
        backgroundColor: theme.surface,
        shadowColor: "#0B1F17",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      };
}

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}
