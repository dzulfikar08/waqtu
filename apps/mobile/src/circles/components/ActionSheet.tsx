import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";

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
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t("circles.circle.cancel")}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
        {message ? <Text style={[styles.message, { color: theme.muted }]}>{message}</Text> : null}
        {actions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              action.onPress();
            }}
            style={[styles.action, { borderColor: theme.border }]}
          >
            <Text
              style={[styles.actionLabel, { color: action.destructive ? "#C0392B" : theme.text }]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.action}>
          <Text style={[styles.actionLabel, { color: theme.muted }]}>
            {t("circles.circle.cancel")}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: { fontSize: 16, fontWeight: "700", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  action: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 16 },
});
