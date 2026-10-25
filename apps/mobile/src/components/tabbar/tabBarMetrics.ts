/**
 * Size budget of the floating bottom tab bar, in dp. Pure, so it is unit tested.
 *
 * The bar is a solid rounded pill inset from the screen edges and lifted above the bottom inset (gesture area, 3-button
 * bar, iOS home indicator). It floats over the screens: content scrolls underneath, and each scrolling screen pads the end
 * of its content by what the bar covers (`tabBarInset`). The pill is sized from what is drawn: item padding, icon box,
 * label line, the pill's own padding and border; the label line grows with the system font size up to a cap.
 */

/** Padding of an item's content inside the item. */
export const TAB_ITEM_PADDING = 5;
/** Box for a 24 dp glyph. */
export const TAB_ICON_BOX = 26;
export const TAB_LABEL_SIZE = 11;
/** Fixed, so the budget does not depend on the font's own metrics. */
export const TAB_LABEL_LINE = 14;
/** Above this five labels no longer fit a phone's width; the bar stays readable rather than growing with the setting. */
export const TAB_LABEL_MAX_SCALE = 1.3;
/** How far a long label ("Pengaturan") may shrink so it stays whole on a narrow screen. */
export const TAB_LABEL_MIN_SHRINK = 0.7;
/** Space between the pill's border and the items. */
export const TAB_BAR_PADDING = 6;
export const TAB_BAR_BORDER = 1;
/** Gap between the pill and each side of the screen. */
export const TAB_BAR_MARGIN_X = 16;
/** Gap between the pill and the bottom inset (Android), and the least distance from the bottom edge on iOS. */
export const TAB_BAR_GAP_BOTTOM = 8;
/** iOS: how far the pill dips into the home indicator's safe area; the full inset would leave an empty band. */
export const TAB_BAR_IOS_INSET_TUCK = 12;

/** The scale the label is drawn at: the system's, within [1, max]. */
export function tabLabelScale(fontScale: number): number {
  if (!Number.isFinite(fontScale)) return 1;
  return Math.min(Math.max(fontScale, 1), TAB_LABEL_MAX_SCALE);
}

/** Height of one item: padding, icon box, label line, padding. */
export function tabBarContentHeight(fontScale: number): number {
  return Math.ceil(TAB_ITEM_PADDING * 2 + TAB_ICON_BOX + TAB_LABEL_LINE * tabLabelScale(fontScale));
}

/** Height of the pill: its border and padding around one item. */
export function tabBarPillHeight(fontScale: number): number {
  return tabBarContentHeight(fontScale) + (TAB_BAR_PADDING + TAB_BAR_BORDER) * 2;
}

/**
 * Distance from the screen's bottom edge to the pill. Android: the inset plus the gap. iOS: the inset minus a tuck so the
 * pill sits close to the home indicator, never nearer the edge than the gap.
 */
export function tabBarBottomOffset(bottomInset: number, os: string): number {
  const inset = Math.max(0, Number.isFinite(bottomInset) ? bottomInset : 0);
  if (os === "ios") return Math.max(inset - TAB_BAR_IOS_INSET_TUCK, TAB_BAR_GAP_BOTTOM);
  return inset + TAB_BAR_GAP_BOTTOM;
}

/** Radius of an item's active background: concentric with the full-round pill. */
export function tabItemRadius(pillHeight: number, itemHeight: number): number {
  return Math.min(Math.max(pillHeight / 2 - TAB_BAR_PADDING - TAB_BAR_BORDER, 0), itemHeight / 2);
}
