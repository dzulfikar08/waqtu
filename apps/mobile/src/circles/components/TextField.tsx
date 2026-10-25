import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { HIT, radius, spacing, useTheme } from "@/theme";

/** Single-line input inside a card: filled with `surfaceAlt` and outlined so it reads on both themes. */
export function TextField({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.muted}
      selectionColor={theme.accent}
      {...rest}
      style={[
        styles.input,
        { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: HIT,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
});
