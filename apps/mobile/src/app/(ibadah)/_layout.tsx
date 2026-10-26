import { Stack } from "expo-router";

import { useTranslation } from "@/i18n";
import { useTheme } from "@/theme";

/** The Ibadah tools, pushed from the Ibadah tab (and the dzikir rows of the checklist) with a back button. */
export default function IbadahLayout() {
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
      <Stack.Screen name="qibla" options={{ title: t("ibadah.qibla.title") }} />
      <Stack.Screen name="matsurat" options={{ title: t("ibadah.matsurat.title") }} />
      <Stack.Screen name="dzikir" options={{ title: t("ibadah.dzikir.title") }} />
      <Stack.Screen name="doa/index" options={{ title: t("ibadah.doa.title") }} />
      <Stack.Screen name="doa/[id]" options={{ title: t("ibadah.doa.title") }} />
      <Stack.Screen name="tasbih" options={{ title: t("ibadah.tasbih.title") }} />
      <Stack.Screen name="muhasabah/index" options={{ title: t("ibadah.muhasabah.title") }} />
      <Stack.Screen name="muhasabah/[date]" options={{ title: t("ibadah.muhasabah.title") }} />
    </Stack>
  );
}
