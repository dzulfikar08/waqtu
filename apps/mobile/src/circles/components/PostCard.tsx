import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Card, PressableScale, type IconName } from "@/components/ui";
import { parseHalaqahRef } from "@/halaqah/program";
import { useTranslation } from "@/i18n";
import { HIT, radius, spacing, tabular, typography, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import type { Post, ReportReason } from "../types";
import { ActionSheet } from "./ActionSheet";
import { VoiceNote } from "./VoiceNote";

const REASONS: ReportReason[] = ["spam", "harassment", "inappropriate", "other"];

export function PostCard({
  api,
  circleId,
  post,
  reactions,
  canReact,
  onChange,
  onDeleted,
  onBlocked,
  onNotice,
}: {
  api: CirclesApi;
  circleId: string;
  post: Post;
  reactions: readonly string[];
  canReact: boolean;
  onChange: (next: Post) => void;
  onDeleted: (postId: string) => void;
  onBlocked: (handle: string) => void;
  onNotice: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [menu, setMenu] = useState<"none" | "options" | "reason">("none");
  const [reportTarget, setReportTarget] = useState<"post" | "user">("post");

  const time = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(post.createdAt);
  const halaqah = post.halaqahDayId ? parseHalaqahRef(post.halaqahDayId) : null;

  const fail = (e: unknown) => {
    const key =
      typeof e === "object" && e !== null && "key" in e
        ? String((e as { key: unknown }).key)
        : "generic";
    onNotice(t(`circles.errors.${key}`));
  };

  const react = async (emoji: string) => {
    try {
      const next = await api.react(circleId, post.id, post.myReaction === emoji ? null : emoji);
      onChange({ ...post, reactions: next.reactions, myReaction: next.myReaction });
    } catch (e) {
      fail(e);
    }
  };

  const report = async (reason: ReportReason) => {
    try {
      await api.report(circleId, post.id, { target: reportTarget, reason });
      onNotice(t("circles.circle.post.reportDone"));
    } catch (e) {
      fail(e);
    }
  };

  const confirmBlock = () =>
    Alert.alert(t("circles.circle.post.blockConfirm", { handle: post.handle }), undefined, [
      { text: t("circles.circle.cancel"), style: "cancel" },
      {
        text: t("circles.circle.post.block"),
        style: "destructive",
        onPress: () => {
          api
            .block(circleId, post.id)
            .then(() => {
              onBlocked(post.handle);
              onNotice(t("circles.circle.post.blockDone"));
            })
            .catch(fail);
        },
      },
    ]);

  const confirmDelete = () =>
    Alert.alert(t("circles.circle.deleteConfirm"), undefined, [
      { text: t("circles.circle.cancel"), style: "cancel" },
      {
        text: t("circles.circle.delete"),
        style: "destructive",
        onPress: () => {
          api
            .deletePost(circleId, post.id)
            .then(() => onDeleted(post.id))
            .catch(fail);
        },
      },
    ]);

  return (
    <Card>
      <View style={styles.header}>
        <Avatar handle={post.handle} />
        <View style={styles.grow}>
          <Text
            style={[typography.subhead, styles.handle, { color: theme.text }]}
            numberOfLines={1}
          >
            {post.handle}
            {post.mine ? (
              <Text style={{ color: theme.accent }}>{` · ${t("circles.circle.mine")}`}</Text>
            ) : null}
          </Text>
          <Text style={[typography.caption, tabular, { color: theme.muted }]}>{time}</Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t("circles.circle.post.more")}
          onPress={() => setMenu("options")}
          scaleTo={0.9}
          style={styles.more}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
        </PressableScale>
      </View>

      {post.halaqahDayId ? (
        <View style={[styles.meta, { backgroundColor: theme.secondarySoft }]}>
          <Ionicons
            name="link"
            size={14}
            color={theme.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[typography.footnote, styles.metaText, { color: theme.secondary }]}>
            {halaqah
              ? t("halaqah.linkedDay", { day: halaqah.day })
              : t("circles.circle.halaqahLinked", { day: post.halaqahDayId })}
          </Text>
        </View>
      ) : null}
      {post.text ? <Text style={[styles.text, { color: theme.text }]}>{post.text}</Text> : null}
      {post.media ? <VoiceNote api={api} circleId={circleId} media={post.media} /> : null}
      {post.summary ? (
        <View style={[styles.summary, { backgroundColor: theme.surfaceAlt }]}>
          <View style={styles.summaryHead}>
            <Ionicons
              name="stats-chart"
              size={14}
              color={theme.accent}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[typography.overline, { color: theme.muted }]}>
              {t("circles.circle.summary.title")}
            </Text>
          </View>
          <SummaryLine icon="calendar-outline">
            {t("circles.circle.summary.days", { n: post.summary.countedDays })}
          </SummaryLine>
          <SummaryLine icon="moon-outline">
            {t("circles.circle.summary.fardh", {
              onTime: post.summary.fardhOnTime,
              jamaah: post.summary.fardhJamaah,
            })}
          </SummaryLine>
          {post.summary.pages > 0 ? (
            <SummaryLine icon="book-outline">
              {t("circles.circle.summary.pages", { n: post.summary.pages })}
            </SummaryLine>
          ) : null}
        </View>
      ) : null}

      <View style={styles.reactions}>
        {reactions.map((emoji) => {
          const selected = post.myReaction === emoji;
          return (
            <PressableScale
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={t("circles.circle.reactionLabel", { emoji })}
              accessibilityState={{ selected, disabled: !canReact }}
              disabled={!canReact}
              onPress={() => void react(emoji)}
              scaleTo={0.92}
              style={[
                styles.reaction,
                {
                  borderColor: selected ? theme.accent : theme.border,
                  backgroundColor: selected ? theme.accentSoft : "transparent",
                },
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
              <Text
                style={[
                  typography.footnote,
                  tabular,
                  styles.count,
                  { color: selected ? theme.accent : theme.muted },
                ]}
              >
                {post.reactions[emoji] ?? 0}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <ActionSheet
        visible={menu === "options"}
        onClose={() => setMenu("none")}
        actions={
          post.mine
            ? [
                {
                  label: t("circles.circle.delete"),
                  destructive: true,
                  onPress: confirmDelete,
                },
              ]
            : [
                {
                  label: t("circles.circle.post.report"),
                  onPress: () => {
                    setReportTarget("post");
                    setMenu("reason");
                  },
                },
                {
                  label: t("circles.circle.post.reportUser"),
                  onPress: () => {
                    setReportTarget("user");
                    setMenu("reason");
                  },
                },
                {
                  label: t("circles.circle.post.block"),
                  destructive: true,
                  onPress: confirmBlock,
                },
              ]
        }
      />
      <ActionSheet
        visible={menu === "reason"}
        title={t("circles.circle.post.reportTitle")}
        onClose={() => setMenu("none")}
        actions={REASONS.map((reason) => ({
          label: t(`circles.circle.reasons.${reason}`),
          onPress: () => void report(reason),
        }))}
      />
    </Card>
  );
}

/** Round initial of a handle on the soft accent wash. Decorative: the handle is read next to it. */
function Avatar({ handle }: { handle: string }) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { backgroundColor: theme.accentSoft }]}
    >
      <Text style={[styles.initial, { color: theme.accent }]}>
        {handle.replace(/^@/, "").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** One line of a shared weekly summary with its glyph. */
function SummaryLine({ icon, children }: { icon: IconName; children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.summaryLine}>
      <Ionicons
        name={icon}
        size={15}
        color={theme.muted}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[typography.subhead, tabular, styles.grow, { color: theme.text }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  grow: { flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 17, fontWeight: "700" },
  handle: { fontWeight: "700" },
  more: {
    width: HIT,
    height: HIT,
    marginRight: -spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  metaText: { fontWeight: "600" },
  text: { fontSize: 16, lineHeight: 23 },
  summary: { borderRadius: radius.md, padding: spacing.md - 4, gap: spacing.xs + 2 },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  reaction: {
    minHeight: 40,
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  emoji: { fontSize: 18 },
  count: { fontWeight: "600" },
});
