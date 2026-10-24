import { useColorScheme } from "react-native";

/**
 * Design tokens, taken from apps/apple: the iOS/watch palette (`WaqtuColors.swift`) and the
 * macOS green palette plus `waqtuSecondary` (#6B8FAD) from `MenuBarView.swift`.
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
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
  secondary: string;
}

export const lightTheme: Theme = {
  dark: false,
  background: "#F7F7FA",
  surface: "#FFFFFF",
  text: "#1A2E25",
  muted: "#5A7D9A",
  accent: palette.teal,
  accentText: "#FFFFFF",
  border: "#E1E5EA",
  secondary: palette.secondary,
};

export const darkTheme: Theme = {
  dark: true,
  background: "#1A2E25",
  surface: "#2D5F4C",
  text: "#E8F0ED",
  muted: "#A8C9B8",
  accent: palette.primaryLight,
  accentText: "#1A2E25",
  border: "#2D5F4C",
  secondary: palette.secondary,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { md: 12, lg: 20 } as const;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}
