import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";
import { useTheme } from "@/theme";

export default function HalaqahLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: t("halaqah.title") }} />
      <Stack.Screen name="[day]" options={{ title: t("halaqah.title") }} />
    </Stack>
  );
}
