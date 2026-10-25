import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Divider } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { radius, spacing, typography, useTheme } from "@/theme";

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** Bottom sheet of actions. Unlike Alert it has no three-button limit on Android. */
export function ActionSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t("circles.circle.cancel")}
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            borderColor: theme.separator,
            paddingBottom: spacing.md + insets.bottom,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        {title || message ? (
          <View style={styles.head}>
            {title ? (
              <Text style={[typography.headline, styles.center, { color: theme.text }]}>
                {title}
              </Text>
            ) : null}
            {message ? (
              <Text style={[typography.subhead, styles.message, { color: theme.muted }]}>
                {message}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.group, { backgroundColor: theme.surfaceAlt }]}>
          {actions.map((action, index) => (
            <View key={action.label}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.action,
                  pressed ? { backgroundColor: theme.accentSoft } : null,
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    styles.actionLabel,
                    { color: action.destructive ? theme.danger : theme.text },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.group,
            styles.action,
            { backgroundColor: pressed ? theme.accentSoft : theme.surfaceAlt },
          ]}
        >
          <Text style={[typography.body, styles.cancelLabel, { color: theme.accent }]}>
            {t("circles.circle.cancel")}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm + 4,
  },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3 },
  head: { gap: spacing.xs, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  center: { textAlign: "center" },
  message: { lineHeight: 20, textAlign: "center" },
  group: { borderRadius: radius.md, overflow: "hidden" },
  action: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  actionLabel: { textAlign: "center", fontWeight: "500" },
  cancelLabel: { textAlign: "center", fontWeight: "700" },
});
