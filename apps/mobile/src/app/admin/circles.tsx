import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { adminErrorKey, Badge, Notice } from "@/admin/components";
import type { CirclesApi } from "@/circles/api";
import { circlesApi } from "@/circles/client";
import type { PostAction, QueuePost, QueueUser, ReportReason, UserAction } from "@/circles/types";
import { useLoad } from "@/circles/useLoad";
import { Card, SectionTitle } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, ButtonRow, Hint } from "@/ramadhan/components/fields";
import { hueColors, spacing, tabular, typography, useTheme } from "@/theme";

/**
 * Circle moderation for admins: posts and people with pending reports. A post can be hidden (reports
 * stay open), unhidden or dismissed (reports closed) or removed; a person can be suspended, lifted or
 * dismissed. The server refuses all of it for anyone outside ADMIN_USER_IDS.
 */
export default function ModerationScreen() {
  if (!circlesApi) return null;
  return <Moderation api={circlesApi} />;
}

function Moderation({ api }: { api: CirclesApi }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const state = useLoad(() => api.adminQueue());
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setNotice(null);
    try {
      await action();
      setNotice(t("admin.moderation.done"));
      await state.reload();
    } catch (e) {
      setNotice(t(adminErrorKey(e)));
    } finally {
      setBusy(null);
    }
  };

  const confirm = (title: string, label: string, onConfirm: () => void) =>
    Alert.alert(title, undefined, [
      { text: t("admin.moderation.cancel"), style: "cancel" },
      { text: label, style: "destructive", onPress: onConfirm },
    ]);

  const onPost = (post: QueuePost, action: PostAction) => {
    const go = () => void run(post.id, () => api.adminPost(post.id, action));
    if (action === "remove") {
      confirm(t("admin.moderation.removeConfirm"), t("admin.moderation.remove"), go);
    } else go();
  };

  const onUser = (user: QueueUser, action: UserAction) => {
    const go = () => void run(user.userId, () => api.adminUser(user.userId, action));
    if (action === "suspend") {
      confirm(
        t("admin.moderation.suspendConfirm", { handle: user.handle }),
        t("admin.moderation.suspend"),
        go,
      );
    } else go();
  };

  const queue = state.data;
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
      refreshControl={
        <RefreshControl
          refreshing={state.loading}
          onRefresh={() => void state.reload()}
          tintColor={theme.accent}
        />
      }
    >
      {notice ? <Notice text={notice} /> : null}
      {state.error && !queue ? (
        <Card>
          <Hint>{t(adminErrorKey(state.error))}</Hint>
          <Button tone="plain" label={t("circles.retry")} onPress={() => void state.reload()} />
        </Card>
      ) : null}
      {queue && queue.posts.length === 0 && queue.users.length === 0 ? (
        <Card>
          <Hint>{t("admin.moderation.empty")}</Hint>
        </Card>
      ) : null}
      {queue && queue.posts.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle title={t("admin.moderation.posts")} icon="chatbubbles" hue="circles" />
          {queue.posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              busy={busy !== null}
              onAction={(action) => onPost(post, action)}
            />
          ))}
        </View>
      ) : null}
      {queue && queue.users.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle title={t("admin.moderation.users")} icon="people" hue="circles" />
          {queue.users.map((user) => (
            <UserItem
              key={user.userId}
              user={user}
              busy={busy !== null}
              onAction={(action) => onUser(user, action)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function useReasons(reasons: readonly ReportReason[]): string {
  const { t } = useTranslation();
  return reasons.map((r) => t(`circles.circle.reasons.${r}`)).join(", ");
}

function PostItem({
  post,
  busy,
  onAction,
}: {
  post: QueuePost;
  busy: boolean;
  onAction: (action: PostAction) => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const rose = hueColors(theme, "circles");
  const reasons = useReasons(post.reasons);
  const time = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(post.createdAt);
  const body =
    post.kind === "voice"
      ? t("admin.moderation.voice")
      : post.kind === "summary"
        ? t("admin.moderation.summary")
        : (post.text ?? "");

  return (
    <Card hue="circles">
      <View style={styles.head}>
        <View style={styles.grow}>
          <Text style={[typography.subhead, styles.strong, { color: theme.text }]}>
            {t("admin.moderation.author", { handle: post.authorHandle })}
          </Text>
          <Text style={[typography.caption, tabular, { color: theme.muted }]}>{time}</Text>
        </View>
        {post.hidden ? (
          <Badge
            label={t("admin.moderation.hidden")}
            color={theme.danger}
            background={theme.dangerSoft}
          />
        ) : (
          <Badge label={t("admin.moderation.visible")} color={rose.base} background={rose.soft} />
        )}
      </View>
      <Text
        style={[
          typography.body,
          { color: post.kind === "text" ? theme.text : theme.muted },
          post.kind === "text" ? null : styles.italic,
        ]}
        selectable
      >
        {body}
      </Text>
      <Text style={[typography.footnote, { color: theme.muted }]}>
        {`${t("admin.moderation.reports", { count: post.pendingReports })} · ${reasons}`}
      </Text>
      <ButtonRow>
        {post.hidden ? (
          <Button
            label={t("admin.moderation.unhide")}
            icon="eye-outline"
            disabled={busy}
            onPress={() => onAction("restore")}
          />
        ) : (
          <>
            <Button
              label={t("admin.moderation.hide")}
              icon="eye-off-outline"
              disabled={busy}
              onPress={() => onAction("hide")}
            />
            <Button
              tone="plain"
              label={t("admin.moderation.dismiss")}
              disabled={busy}
              onPress={() => onAction("restore")}
            />
          </>
        )}
        <Button
          tone="plain"
          label={t("admin.moderation.remove")}
          icon="trash-outline"
          disabled={busy}
          onPress={() => onAction("remove")}
        />
      </ButtonRow>
    </Card>
  );
}

function UserItem({
  user,
  busy,
  onAction,
}: {
  user: QueueUser;
  busy: boolean;
  onAction: (action: UserAction) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reasons = useReasons(user.reasons);
  return (
    <Card hue="circles">
      <View style={styles.head}>
        <Text style={[typography.subhead, styles.strong, styles.grow, { color: theme.text }]}>
          {user.handle}
        </Text>
        {user.suspended ? (
          <Badge
            label={t("admin.moderation.suspended")}
            color={theme.danger}
            background={theme.dangerSoft}
          />
        ) : null}
      </View>
      <Text style={[typography.footnote, { color: theme.muted }]}>
        {`${t("admin.moderation.reports", { count: user.pendingReports })} · ${reasons}`}
      </Text>
      <ButtonRow>
        {user.suspended ? (
          <Button
            label={t("admin.moderation.unsuspend")}
            disabled={busy}
            onPress={() => onAction("unsuspend")}
          />
        ) : (
          <Button
            label={t("admin.moderation.suspend")}
            icon="ban-outline"
            disabled={busy}
            onPress={() => onAction("suspend")}
          />
        )}
        <Button
          tone="plain"
          label={t("admin.moderation.dismiss")}
          disabled={busy}
          onPress={() => onAction("dismiss")}
        />
      </ButtonRow>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md + 4, gap: spacing.lg },
  group: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  strong: { fontWeight: "600" },
  italic: { fontStyle: "italic" },
});
