import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { useTranslation } from "@/i18n";
import { useRamadhanTabVisible } from "@/ramadhan/visibility";
import { useTheme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** One filled glyph for the active tab, its outline for the rest. */
function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  };
}

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
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.today"),
          tabBarAccessibilityLabel: t("tabs.today"),
          tabBarIcon: tabIcon("sunny", "sunny-outline"),
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: t("tabs.week"),
          tabBarAccessibilityLabel: t("tabs.week"),
          tabBarIcon: tabIcon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="ramadhan"
        options={{
          title: t("ramadhan.tab"),
          tabBarAccessibilityLabel: t("ramadhan.tab"),
          tabBarIcon: tabIcon("moon", "moon-outline"),
          href: showRamadhan ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: t("circles.tab"),
          tabBarAccessibilityLabel: t("circles.tab"),
          tabBarIcon: tabIcon("people", "people-outline"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarAccessibilityLabel: t("tabs.settings"),
          tabBarIcon: tabIcon("settings", "settings-outline"),
        }}
      />
    </Tabs>
  );
}
