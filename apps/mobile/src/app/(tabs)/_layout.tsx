import { Tabs } from "expo-router";

import { useTranslation } from "@/i18n";
import { useRamadhanTabVisible } from "@/ramadhan/visibility";
import { useTheme } from "@/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const showRamadhan = useRamadhanTabVisible();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.today") }} />
      <Tabs.Screen name="week" options={{ title: t("tabs.week") }} />
      <Tabs.Screen
        name="ramadhan"
        options={{ title: t("ramadhan.tab"), href: showRamadhan ? undefined : null }}
      />
      <Tabs.Screen name="circles" options={{ title: t("circles.tab") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings") }} />
    </Tabs>
  );
}
