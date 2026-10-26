import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";
import { useTheme } from "@/theme";

export default function AdminLayout() {
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
      <Stack.Screen name="circles" options={{ title: t("admin.moderation.title") }} />
      <Stack.Screen name="errors" options={{ title: t("admin.crashes.title") }} />
    </Stack>
  );
}
