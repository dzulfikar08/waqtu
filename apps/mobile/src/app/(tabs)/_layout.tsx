import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { FloatingTabBar } from "@/components/tabbar/FloatingTabBar";
import { TabBarInsetProvider } from "@/components/tabbar/tabBarInset";
import type { IconName } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { useRamadhanTabVisible } from "@/ramadhan/visibility";
import { useTheme, type Hue } from "@/theme";

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

/** Each tab lights up in its section's colour. */
const TAB_HUES: Readonly<Record<string, Hue>> = {
  index: "prayer",
  week: "week",
  ramadhan: "ramadhan",
  circles: "circles",
  settings: "neutral",
};

/**
 * The tab roots. The bar floats over them (`FloatingTabBar`): each screen draws its own title (`Screen`) and pads its
 * content by the height the bar covers. Hafalan, Halaqah and the other detail screens are pushed on the root stack.
 */
export default function TabsLayout() {
  const theme = useTheme();
  return (
    <TabBarInsetProvider>
      <TabsNavigator background={theme.background} />
    </TabBarInsetProvider>
  );
}

function TabsNavigator({ background }: { background: string }) {
  const { t } = useTranslation();
  const showRamadhan = useRamadhanTabVisible();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} hues={TAB_HUES} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: background } }}
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
