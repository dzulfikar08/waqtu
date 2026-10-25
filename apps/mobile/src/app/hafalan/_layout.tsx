import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";
import { useTheme } from "@/theme";

export default function HafalanLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("hafalan.title") }} />
      <Stack.Screen name="[unit]" options={{ title: t("hafalan.title") }} />
    </Stack>
  );
}
