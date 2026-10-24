import { describe, expect, test } from "bun:test";

import {
  addBuiltinItem,
  addCustomItem,
  BUILTIN_ITEMS,
  FLAG,
  isDone,
  markedFromNotification,
  missingBuiltins,
  parseItems,
  removeItem,
  serializeItems,
  toggleFardh,
} from "../src/mutabaah/items";

describe("fardh flags", () => {
  test("done means on time; tapping again clears everything", () => {
    const done = toggleFardh(0, "done");
    expect(done).toBe(FLAG.DONE | FLAG.ONTIME);
    expect(toggleFardh(done | FLAG.JAMAAH, "done")).toBe(0);
  });

  test("jamaah on an empty prayer records it done on time with jamaah", () => {
    expect(toggleFardh(0, "jamaah")).toBe(FLAG.DONE | FLAG.ONTIME | FLAG.JAMAAH);
    expect(toggleFardh(FLAG.DONE | FLAG.ONTIME | FLAG.JAMAAH, "jamaah")).toBe(
      FLAG.DONE | FLAG.ONTIME,
    );
  });

  test("qadha replaces on time and toggles back off", () => {
    const qadha = toggleFardh(FLAG.DONE | FLAG.ONTIME, "qadha");
    expect(qadha).toBe(FLAG.DONE | FLAG.QADHA);
    expect(toggleFardh(qadha, "qadha")).toBe(FLAG.DONE);
    expect(toggleFardh(0, "qadha")).toBe(FLAG.DONE | FLAG.QADHA);
  });

  test("on time clears qadha and toggles", () => {
    expect(toggleFardh(FLAG.DONE | FLAG.QADHA, "ontime")).toBe(FLAG.DONE | FLAG.ONTIME);
    expect(toggleFardh(FLAG.DONE | FLAG.ONTIME, "ontime")).toBe(FLAG.DONE);
  });

  test("notification action keeps what is already recorded", () => {
    expect(markedFromNotification(0, true)).toBe(FLAG.DONE | FLAG.ONTIME);
    expect(markedFromNotification(0, false)).toBe(FLAG.DONE);
    const rich = FLAG.DONE | FLAG.JAMAAH | FLAG.ONTIME;
    expect(markedFromNotification(rich, false)).toBe(rich);
  });

  test("isDone by kind", () => {
    expect(isDone("fardh", FLAG.DONE)).toBe(true);
    expect(isDone("fardh", FLAG.JAMAAH)).toBe(false);
    expect(isDone("count", 0)).toBe(false);
    expect(isDone("count", 2)).toBe(true);
    expect(isDone("check", 1)).toBe(true);
  });
});

describe("checklist items", () => {
  test("defaults to the built-ins", () => {
    expect(parseItems(null)).toEqual([...BUILTIN_ITEMS]);
    expect(parseItems("garbage")).toEqual([...BUILTIN_ITEMS]);
    expect(parseItems("{}")).toEqual([...BUILTIN_ITEMS]);
  });

  test("add custom, remove, add built-in back, round trip", () => {
    let items = [...BUILTIN_ITEMS];
    items = addCustomItem(items, "  Baca Al-Mulk  ", "check", () => "abcd1234");
    expect(items.at(-1)).toEqual({ id: "c.abcd1234", kind: "check", label: "Baca Al-Mulk" });
    items = removeItem(items, "tahajjud");
    expect(missingBuiltins(items).map((i) => i.id)).toEqual(["tahajjud"]);
    items = addBuiltinItem(items, "tahajjud");
    expect(items.at(-1)?.id).toBe("tahajjud");
    expect(parseItems(serializeItems(items))).toEqual(items);
  });

  test("custom ids never collide and blank labels are ignored", () => {
    const base = addCustomItem([...BUILTIN_ITEMS], "A", "count", () => "same0000");
    const seq = ["same0000", "other111"];
    const next = addCustomItem(base, "B", "check", () => seq.shift() as string);
    expect(next.map((i) => i.id).slice(-2)).toEqual(["c.same0000", "c.other111"]);
    expect(addCustomItem(base, "   ", "check", () => "zzzz0000")).toEqual(base);
  });

  test("parse drops invalid, duplicate and fardh-kind custom entries", () => {
    const raw = JSON.stringify([
      { id: "fajr", kind: "fardh" },
      { id: "fajr", kind: "fardh" },
      { id: "c.abcd1234", kind: "check", label: "Ok" },
      { id: "c.bad", kind: "check", label: "short id" },
      { id: "c.abcd5678", kind: "fardh", label: "fake fardh" },
      { id: "c.abcd9999", kind: "count" },
      42,
    ]);
    expect(parseItems(raw).map((i) => i.id)).toEqual(["fajr", "c.abcd1234"]);
  });
});
