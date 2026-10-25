import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { parseHalaqahRef } from "@/halaqah/program";
import { useTranslation } from "@/i18n";
import { radius, spacing, useTheme } from "@/theme";

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
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.handle, { color: theme.text }]}>
          {post.handle}
          {post.mine ? ` · ${t("circles.circle.mine")}` : ""}
        </Text>
        <Text style={[styles.time, { color: theme.muted }]}>{time}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("circles.circle.post.more")}
          hitSlop={8}
          onPress={() => setMenu("options")}
        >
          <Text style={[styles.more, { color: theme.muted }]}>⋯</Text>
        </Pressable>
      </View>

      {post.halaqahDayId ? (
        <Text style={[styles.meta, { color: theme.secondary }]}>
          {halaqah
            ? t("halaqah.linkedDay", { day: halaqah.day })
            : t("circles.circle.halaqahLinked", { day: post.halaqahDayId })}
        </Text>
      ) : null}
      {post.text ? <Text style={[styles.text, { color: theme.text }]}>{post.text}</Text> : null}
      {post.media ? <VoiceNote api={api} circleId={circleId} media={post.media} /> : null}
      {post.summary ? (
        <View style={[styles.summary, { borderColor: theme.border }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>
            {t("circles.circle.summary.title")}
          </Text>
          <Text style={{ color: theme.text }}>
            {t("circles.circle.summary.days", { n: post.summary.countedDays })}
          </Text>
          <Text style={{ color: theme.text }}>
            {t("circles.circle.summary.fardh", {
              onTime: post.summary.fardhOnTime,
              jamaah: post.summary.fardhJamaah,
            })}
          </Text>
          {post.summary.pages > 0 ? (
            <Text style={{ color: theme.text }}>
              {t("circles.circle.summary.pages", { n: post.summary.pages })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.reactions}>
        {reactions.map((emoji) => {
          const selected = post.myReaction === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={t("circles.circle.reactionLabel", { emoji })}
              accessibilityState={{ selected, disabled: !canReact }}
              disabled={!canReact}
              onPress={() => void react(emoji)}
              style={[
                styles.reaction,
                {
                  borderColor: selected ? theme.accent : theme.border,
                  backgroundColor: selected ? theme.background : "transparent",
                  opacity: canReact ? 1 : 0.5,
                },
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
              <Text style={{ color: theme.muted }}>{post.reactions[emoji] ?? 0}</Text>
            </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  handle: { flex: 1, fontSize: 15, fontWeight: "700" },
  time: { fontSize: 12 },
  more: { fontSize: 22, paddingHorizontal: spacing.xs },
  meta: { fontSize: 13 },
  text: { fontSize: 16, lineHeight: 23 },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  summaryTitle: { fontWeight: "700" },
  reactions: { flexDirection: "row", gap: spacing.sm },
  reaction: {
    minHeight: 40,
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  emoji: { fontSize: 18 },
});
