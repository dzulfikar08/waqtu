import type { TFunction } from "i18next";

import type { ItemDef } from "@/mutabaah/items";

/** Custom items carry their own label; built-ins are translated (prayers by prayer name). */
export function itemLabel(item: ItemDef, t: TFunction): string {
  if (item.label) return item.label;
  return item.kind === "fardh" ? t(`prayers.${item.id}`) : t(`items.${item.id}`);
}
