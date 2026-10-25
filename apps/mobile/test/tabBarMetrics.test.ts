import { describe, expect, test } from "bun:test";

import {
  TAB_BAR_GAP_BOTTOM,
  tabBarBottomOffset,
  tabBarContentHeight,
  tabBarPillHeight,
  tabItemRadius,
  tabLabelScale,
} from "../src/components/tabbar/tabBarMetrics";

describe("floating tab bar metrics", () => {
  test("label scale follows the system within [1, 1.3]", () => {
    expect(tabLabelScale(0.85)).toBe(1);
    expect(tabLabelScale(1.15)).toBe(1.15);
    expect(tabLabelScale(2)).toBe(1.3);
    expect(tabLabelScale(Number.NaN)).toBe(1);
  });

  test("the pill grows with the label and wraps the item", () => {
    expect(tabBarContentHeight(2)).toBeGreaterThan(tabBarContentHeight(1));
    expect(tabBarPillHeight(1)).toBeGreaterThan(tabBarContentHeight(1));
    expect(tabBarContentHeight(1)).toBeGreaterThanOrEqual(44);
  });

  test("Android sits above the inset, iOS tucks into the home indicator", () => {
    expect(tabBarBottomOffset(24, "android")).toBe(24 + TAB_BAR_GAP_BOTTOM);
    expect(tabBarBottomOffset(34, "ios")).toBe(22);
    expect(tabBarBottomOffset(0, "ios")).toBe(TAB_BAR_GAP_BOTTOM);
    expect(tabBarBottomOffset(Number.NaN, "android")).toBe(TAB_BAR_GAP_BOTTOM);
  });

  test("item wash is concentric with the pill and never more than round", () => {
    const pill = tabBarPillHeight(1);
    const item = tabBarContentHeight(1);
    expect(tabItemRadius(pill, item)).toBeLessThanOrEqual(item / 2);
    expect(tabItemRadius(0, item)).toBe(0);
  });
});
