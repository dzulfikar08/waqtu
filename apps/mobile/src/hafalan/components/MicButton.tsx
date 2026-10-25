import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui";
import { spacing, typography, useTheme } from "@/theme";

const SIZE = 68;
const HALO = 12;

/**
 * Big round record button with its label underneath: an accent disc with a microphone, or, while
 * `recording`, a danger disc with a stop square. Used by the hafalan recording and the recitation check.
 */
export function MicButton({
  label,
  recording,
  disabled,
  onPress,
}: {
  label: string;
  recording?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const fill = recording ? theme.danger : theme.accent;
  return (
    <View style={styles.box}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={0.92}
        style={[styles.halo, { backgroundColor: recording ? theme.dangerSoft : theme.accentSoft }]}
      >
        <View style={[styles.disc, { backgroundColor: fill }]}>
          <Ionicons name={recording ? "stop" : "mic"} size={30} color={theme.accentText} />
        </View>
      </PressableScale>
      <Text
        style={[typography.callout, styles.label, { color: recording ? theme.danger : theme.text }]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  halo: {
    width: SIZE + HALO * 2,
    height: SIZE + HALO * 2,
    borderRadius: (SIZE + HALO * 2) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontWeight: "600", textAlign: "center" },
});
