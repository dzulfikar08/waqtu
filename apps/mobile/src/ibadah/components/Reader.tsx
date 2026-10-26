import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { itemLabel } from "@/components/itemLabel";
import { Card, Pill, PressableScale, ProgressTrack } from "@/components/ui";
import { setEntry } from "@/db/entries";
import type { MutabaahModel } from "@/db/model";
import { getSetting } from "@/db/settings";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/i18n";
import { Button } from "@/ramadhan/components/fields";
import { hueColors, radius, spacing, tabular, typography, useTheme, type Hue } from "@/theme";

import type { ReaderItem, ReaderSession, ReaderTime } from "../content";
import {
  isItemDone,
  mutabaahItemFor,
  nextOpenItem,
  parseProgress,
  progressKey,
  remaining,
  resetItem,
  serializeProgress,
  sessionProgress,
  tapItem,
  type Counts,
} from "../reader";
import { writeLocal } from "../local";
import { useLocalValue } from "../store";

import { ArabicText } from "./ArabicText";

interface ReaderView {
  latin: boolean;
  translation: boolean;
}

const VIEW_KEY = "ibadah.readerView";

function parseView(raw: string | null): ReaderView {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data === "object" && data !== null && "latin" in data && "translation" in data) {
      return { latin: data.latin !== false, translation: data.translation !== false };
    }
  } catch {
    // fall through to the default
  }
  return { latin: true, translation: true };
}

const serializeView = (view: ReaderView) => JSON.stringify(view);

/**
 * A morning or evening session read top to bottom: per text a counter that counts down with each tap (long-press puts it
 * back), the session's progress, and at the end the offer to tick the matching mutabaah item for today. Progress is kept
 * on the phone for the rest of the day, so leaving the app mid-way loses nothing.
 */
export function Reader({
  session,
  time,
  hue,
  header,
}: {
  session: ReaderSession;
  time: ReaderTime;
  hue: Hue;
  /** Choices above the progress (morning/evening, kubro/sughro). */
  header: ReactNode;
}) {
  const db = useSQLiteContext();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const model = useMutabaah();
  const today = model?.today;
  const colors = hueColors(theme, hue);
  const [view, saveView] = useLocalValue(VIEW_KEY, parseView, serializeView);
  const [counts, setCounts] = useState<Counts | null>(null);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<number, number>());
  const listTop = useRef(0);

  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    setCounts(null);
    void getSetting(db, progressKey(session.id)).then((raw) => {
      if (!cancelled) setCounts(parseProgress(raw, today));
    });
    return () => {
      cancelled = true;
    };
  }, [db, session.id, today]);

  const update = useCallback(
    (next: Counts) => {
      setCounts(next);
      if (today) void writeLocal(db, progressKey(session.id), serializeProgress(next, today));
    },
    [db, session.id, today],
  );

  const progress = useMemo(
    () => (counts ? sessionProgress(session, counts) : null),
    [session, counts],
  );

  const onTap = (index: number) => {
    if (!counts) return;
    const item = session.items[index];
    const next = tapItem(counts, item);
    if (next === counts) return;
    update(next);
    if (isItemDone(next, item)) {
      Vibration.vibrate(30);
      const following = nextOpenItem(session, next, index);
      const y =
        following !== null && following > index ? offsets.current.get(following) : undefined;
      if (y !== undefined) {
        scroll.current?.scrollTo({ y: listTop.current + y - spacing.sm, animated: !reduced });
      }
    }
  };

  const onReset = (index: number) => {
    if (!counts) return;
    update(resetItem(counts, session.items[index]));
  };

  const restart = () =>
    Alert.alert(t("ibadah.reader.restartTitle"), t("ibadah.reader.restartBody"), [
      { text: t("ibadah.reader.cancel"), style: "cancel" },
      { text: t("ibadah.reader.confirmRestart"), style: "destructive", onPress: () => update({}) },
    ]);

  const uiLang = i18n.language === "en" ? "en" : "id";
  const translationNote =
    session.translationLang !== uiLang
      ? t(session.translationLang === "en" ? "ibadah.reader.translationEn" : "ibadah.reader.translationId")
      : null;

  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      {header}
      {progress ? (
        <Card hue={hue}>
          <View style={styles.progressHead}>
            <Text style={[typography.headline, { color: theme.text, flex: 1 }]}>
              {t("ibadah.reader.progress", { done: progress.itemsDone, total: progress.itemsTotal })}
            </Text>
            <Text style={[typography.subhead, tabular, { color: colors.base, fontWeight: "700" }]}>
              {Math.round(progress.fraction * 100)}%
            </Text>
          </View>
          <ProgressTrack value={progress.fraction} fill={colors.base} track={theme.surfaceAlt} />
          <View style={styles.progressFoot}>
            <Text style={[typography.footnote, tabular, { color: theme.muted, flex: 1 }]}>
              {t("ibadah.reader.reps", { done: progress.done, total: progress.total })}
            </Text>
            {progress.done > 0 ? (
              <PressableScale
                accessibilityRole="button"
                onPress={restart}
                hitSlop={8}
                style={styles.restart}
              >
                <Ionicons name="refresh" size={15} color={theme.muted} />
                <Text style={[typography.footnote, { color: theme.muted, fontWeight: "600" }]}>
                  {t("ibadah.reader.restart")}
                </Text>
              </PressableScale>
            ) : null}
          </View>
          <View style={styles.pills}>
            <Pill
              label={t("ibadah.reader.showLatin")}
              on={view?.latin ?? true}
              onPress={() => view && saveView({ ...view, latin: !view.latin })}
            />
            <Pill
              label={t("ibadah.reader.showTranslation")}
              on={view?.translation ?? true}
              onPress={() => view && saveView({ ...view, translation: !view.translation })}
            />
          </View>
          {translationNote ? (
            <Text style={[typography.footnote, { color: theme.muted }]}>{translationNote}</Text>
          ) : null}
        </Card>
      ) : null}
      {counts ? (
        <View
          style={styles.items}
          onLayout={(event) => {
            listTop.current = event.nativeEvent.layout.y;
          }}
        >
          {session.items.map((item, index) => (
            <View
              key={item.key}
              onLayout={(event) => offsets.current.set(index, event.nativeEvent.layout.y)}
            >
              <ItemCard
                item={item}
                index={index}
                left={remaining(counts, item)}
                hue={hue}
                showLatin={view?.latin ?? true}
                showTranslation={view?.translation ?? true}
                onTap={() => onTap(index)}
                onReset={() => onReset(index)}
              />
            </View>
          ))}
        </View>
      ) : null}
      {progress?.complete && model ? <Complete time={time} hue={hue} model={model} /> : null}
    </ScrollView>
  );
}

function ItemCard({
  item,
  index,
  left,
  hue,
  showLatin,
  showTranslation,
  onTap,
  onReset,
}: {
  item: ReaderItem;
  index: number;
  left: number;
  hue: Hue;
  showLatin: boolean;
  showTranslation: boolean;
  onTap: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = hueColors(theme, hue);
  const done = left === 0;
  const title = item.title ?? t("ibadah.reader.item", { n: index + 1 });
  return (
    <Card hue={done ? undefined : hue} style={done ? styles.doneCard : null}>
      <View style={styles.itemHead}>
        <View style={[styles.repeat, { backgroundColor: colors.soft }]}>
          <Text style={[typography.caption, tabular, { color: colors.base, fontWeight: "800" }]}>
            {t("ibadah.reader.times", { count: item.repeat })}
          </Text>
        </View>
        <Text style={[typography.headline, styles.grow, { color: theme.text }]}>{title}</Text>
        {done ? <Ionicons name="checkmark-circle" size={22} color={colors.base} /> : null}
      </View>
      {item.heading ? (
        <View style={[styles.heading, { backgroundColor: colors.wash, borderColor: theme.separator }]}>
          <ArabicText size={24} color={colors.base} center>
            {item.heading.arabic}
          </ArabicText>
          {item.heading.translation ? (
            <Text style={[typography.footnote, { color: theme.muted, textAlign: "center" }]}>
              {item.heading.translation}
            </Text>
          ) : null}
        </View>
      ) : null}
      {item.lines.map((line, i) => (
        <View key={i} style={styles.line}>
          {line.label ? (
            <Text style={[typography.overline, { color: theme.faint }]}>{line.label}</Text>
          ) : null}
          <ArabicText size={26}>{line.arabic}</ArabicText>
          {showLatin && line.latin ? (
            <Text style={[typography.callout, styles.latin, { color: colors.base }]}>
              {line.latin}
            </Text>
          ) : null}
          {showTranslation && line.translation ? (
            <Text style={[typography.subhead, styles.translation, { color: theme.muted }]}>
              {line.translation}
            </Text>
          ) : null}
        </View>
      ))}
      {item.reference ? (
        <Text style={[typography.caption, { color: theme.faint }]}>
          {t("ibadah.reader.reference", { ref: item.reference })}
        </Text>
      ) : null}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          done
            ? t("ibadah.reader.doneLabel", { title })
            : t("ibadah.reader.countLabel", { title, left, total: item.repeat })
        }
        accessibilityHint={t("ibadah.reader.resetItem")}
        onPress={onTap}
        onLongPress={onReset}
        scaleTo={0.97}
        style={[
          styles.counter,
          done
            ? { backgroundColor: theme.surfaceAlt, borderColor: theme.separator }
            : { backgroundColor: colors.soft, borderColor: colors.base },
        ]}
      >
        <Text
          style={[
            typography.subhead,
            styles.grow,
            { color: done ? theme.muted : theme.text, fontWeight: "600" },
          ]}
        >
          {done ? t("ibadah.reader.itemDone") : t("ibadah.reader.tapToCount")}
        </Text>
        {done ? (
          <Ionicons name="checkmark" size={24} color={colors.base} />
        ) : (
          <Text style={[styles.left, tabular, { color: colors.base }]}>{left}</Text>
        )}
      </PressableScale>
    </Card>
  );
}

/** The end of the session: a short du'a-like close and the mutabaah tick for this morning or evening. */
function Complete({
  time,
  hue,
  model,
}: {
  time: ReaderTime;
  hue: Hue;
  model: MutabaahModel;
}) {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = hueColors(theme, hue);
  const itemId = mutabaahItemFor(time);
  const item = model.items.find((i) => i.id === itemId) ?? null;
  const name = t(`items.${itemId}`);
  const ticked = (model.todayEntries.get(itemId) ?? 0) > 0;
  return (
    <Card hue={hue}>
      <View style={styles.itemHead}>
        <Ionicons name="sparkles" size={22} color={colors.base} />
        <Text style={[typography.title, styles.grow, { color: theme.text }]}>
          {t("ibadah.reader.completeTitle")}
        </Text>
      </View>
      <Text style={[typography.body, { color: theme.muted }]}>{t("ibadah.reader.completeBody")}</Text>
      {!item ? (
        <Text style={[typography.footnote, { color: theme.muted }]}>
          {t("ibadah.reader.notInChecklist", { item: name })}
        </Text>
      ) : ticked ? (
        <View style={styles.itemHead}>
          <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
          <Text style={[typography.subhead, styles.grow, { color: theme.text }]}>
            {t("ibadah.reader.marked", { item: itemLabel(item, t) })}
          </Text>
        </View>
      ) : (
        <Button
          label={t("ibadah.reader.markMutabaah", { item: itemLabel(item, t) })}
          icon="checkmark-circle-outline"
          block
          onPress={() => void setEntry(db, model.today, itemId, 1)}
        />
      )}
      {!item ? (
        <Button label={t("items.manage")} tone="plain" onPress={() => router.push("/items")} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.md, gap: spacing.md },
  progressHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressFoot: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  restart: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  pills: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  items: { gap: spacing.md },
  doneCard: { opacity: 0.78 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  repeat: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  grow: { flex: 1 },
  heading: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  line: { gap: spacing.xs },
  latin: { fontStyle: "italic", lineHeight: 22 },
  translation: { lineHeight: 21 },
  counter: {
    marginTop: spacing.xs,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  left: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
});
