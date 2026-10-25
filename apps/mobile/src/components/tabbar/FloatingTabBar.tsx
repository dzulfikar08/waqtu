import type { BottomTabBarProps } from "expo-router/js-tabs";
import { CommonActions } from "expo-router/react-navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { PressableScale } from "@/components/ui";
import { HIT, useTheme } from "@/theme";

import { useReportTabBarInset } from "./tabBarInset";
import {
  TAB_BAR_BORDER,
  TAB_BAR_MARGIN_X,
  TAB_BAR_PADDING,
  TAB_ICON_BOX,
  TAB_ITEM_PADDING,
  TAB_LABEL_LINE,
  TAB_LABEL_MAX_SCALE,
  TAB_LABEL_MIN_SHRINK,
  TAB_LABEL_SIZE,
  tabBarBottomOffset,
  tabBarContentHeight,
  tabBarPillHeight,
  tabItemRadius,
} from "./tabBarMetrics";

/** Glyph size handed to `tabBarIcon`; the icon box in `tabBarMetrics` is built for it. */
const ICON_SIZE = 23;
const INDICATOR_MS = 140;

/** True while the Android keyboard is up: the window resizes with it, so the bar would ride above the keyboard. */
function useAndroidKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => live && setReduced(value));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** One tab: the active wash fades and settles in behind the icon and label. */
function TabItem({
  focused,
  radius,
  height,
  accessibilityLabel,
  onPress,
  onLongPress,
  testID,
  children,
}: {
  focused: boolean;
  radius: number;
  height: number;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(focused ? 1 : 0);
      return;
    }
    const run = Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: INDICATOR_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [focused, progress, reduced]);

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      scaleTo={0.96}
      style={[styles.item, { height, minHeight: HIT, borderRadius: radius }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: theme.accentSoft,
            borderRadius: radius,
            opacity: progress,
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          },
        ]}
      />
      {children}
    </PressableScale>
  );
}

/**
 * The floating tab bar: a solid rounded pill inset from the screen edges and lifted above the bottom inset. It is
 * absolutely positioned over the screens, so content scrolls behind it; it measures the height it covers and publishes
 * it (`tabBarInset`), and every tab screen pads the end of its content by that. Only the visible tabs are drawn (a
 * route hidden with `href: null` carries `tabBarItemStyle.display === 'none'`). Draws nothing where the focused route
 * hides the bar (`tabBarStyle.display === 'none'`) and, on Android, while the keyboard is open.
 */
export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const keyboardOpen = useAndroidKeyboardOpen();
  const report = useReportTabBarInset();

  const focusedRoute = state.routes[state.index];
  const hiddenByRoute =
    StyleSheet.flatten(descriptors[focusedRoute.key].options.tabBarStyle as StyleProp<ViewStyle>)
      ?.display === "none";
  const hidden = hiddenByRoute || keyboardOpen;

  useEffect(() => () => report(0), [report]);
  useEffect(() => {
    if (hidden) report(0);
  }, [hidden, report]);
  if (hidden) return null;

  const itemHeight = tabBarContentHeight(fontScale);
  const pillHeight = tabBarPillHeight(fontScale);
  const itemRadius = tabItemRadius(pillHeight, itemHeight);

  const visible = state.routes.filter(
    (route) =>
      StyleSheet.flatten(descriptors[route.key].options.tabBarItemStyle as StyleProp<ViewStyle>)
        ?.display !== "none",
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.strip, { paddingBottom: tabBarBottomOffset(insets.bottom, Platform.OS) }]}
      onLayout={(event) => report(Math.ceil(event.nativeEvent.layout.height))}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.pill,
          {
            height: pillHeight,
            borderRadius: pillHeight / 2,
            backgroundColor: theme.tabBar,
            borderColor: theme.separator,
          },
        ]}
      >
        {visible.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === focusedRoute.key;
          const color = focused ? theme.accent : theme.muted;
          const title = options.title ?? route.name;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.dispatch({ ...CommonActions.navigate(route), target: state.key });
            }
          };
          const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });
          return (
            <TabItem
              key={route.key}
              focused={focused}
              radius={itemRadius}
              height={itemHeight}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
            >
              {options.tabBarIcon ? (
                <View style={styles.icon}>
                  {options.tabBarIcon({ focused, color, size: ICON_SIZE })}
                </View>
              ) : null}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={TAB_LABEL_MIN_SHRINK}
                maxFontSizeMultiplier={TAB_LABEL_MAX_SCALE}
                style={[styles.label, { color, fontWeight: focused ? "700" : "500" }]}
              >
                {title}
              </Text>
            </TabItem>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: TAB_BAR_MARGIN_X,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    padding: TAB_BAR_PADDING,
    borderWidth: TAB_BAR_BORDER,
    // One restrained lift: the pill floats over the content, so it needs it.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: TAB_ITEM_PADDING,
  },
  icon: { height: TAB_ICON_BOX, alignItems: "center", justifyContent: "center" },
  label: { fontSize: TAB_LABEL_SIZE, lineHeight: TAB_LABEL_LINE },
});
