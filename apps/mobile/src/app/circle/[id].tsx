import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CirclesHttpError } from "@/circles/api";
import { circlesApi } from "@/circles/client";
import { ActionSheet } from "@/circles/components/ActionSheet";
import { Composer } from "@/circles/components/Composer";
import { PostCard } from "@/circles/components/PostCard";
import {
  appendPage,
  canPost,
  MAX_VOICE_SECONDS,
  refreshFeed,
  summaryFromWeek,
} from "@/circles/logic";
import type { Circle, CircleProfile, CirclesConfig, Post } from "@/circles/types";
import { useLoad } from "@/circles/useLoad";
import { Card, IconChip, PressableScale } from "@/components/ui";
import { useMutabaah } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { Button, Hint } from "@/ramadhan/components/fields";
import { HIT, radius, spacing, typography, useTheme } from "@/theme";

interface Screen {
  circle: Circle;
  profile: CircleProfile;
  config: CirclesConfig;
}

export default function CircleScreen() {
  const { id, halaqahDay } = useLocalSearchParams<{ id: string; halaqahDay?: string }>();
  if (!circlesApi || !id) return null;
  return <CircleFeed api={circlesApi} circleId={id} halaqahDayId={halaqahDay} />;
}

function CircleFeed({
  api,
  circleId,
  halaqahDayId,
}: {
  api: NonNullable<typeof circlesApi>;
  circleId: string;
  halaqahDayId?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mutabaah = useMutabaah();
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<"none" | "circle" | "leave">("none");

  const state = useLoad<Screen>(async () => {
    const [circle, profile, config, feed] = await Promise.all([
      api.get(circleId),
      api.getProfile(),
      api.config(),
      api.feed(circleId),
    ]);
    if (!profile) throw new CirclesHttpError(409, "profile_required");
    setPosts((shown) => refreshFeed(shown, feed.posts));
    setNextBefore((current) =>
      current !== null && feed.nextBefore !== null ? current : feed.nextBefore,
    );
    return { circle, profile, config };
  });

  const fail = useCallback(
    (e: unknown) =>
      setNotice(t(`circles.errors.${e instanceof CirclesHttpError ? e.key : "generic"}`)),
    [t],
  );

  const replace = useCallback(
    (next: Post) => setPosts((shown) => shown.map((p) => (p.id === next.id ? next : p))),
    [],
  );

  const loadOlder = async () => {
    if (!nextBefore) return;
    try {
      const page = await api.feed(circleId, nextBefore);
      setPosts((shown) => appendPage(shown, page.posts));
      setNextBefore(page.nextBefore);
    } catch (e) {
      fail(e);
    }
  };

  const change = async (to: "pause" | "resume" | "leave") => {
    try {
      await api.changeState(circleId, to);
      if (to === "leave") router.back();
      else await state.reload();
    } catch (e) {
      fail(e);
    }
  };

  const shareSummary = async () => {
    if (!mutabaah) return;
    try {
      const post = await api.shareSummary(circleId, summaryFromWeek(mutabaah.week, mutabaah.today));
      setPosts((shown) => [post, ...shown.filter((p) => p.id !== post.id)]);
      setNotice(t("circles.circle.summary.shared"));
    } catch (e) {
      fail(e);
    }
  };

  const enableSummary = async (profile: CircleProfile) => {
    try {
      await api.saveProfile({
        handle: profile.handle,
        language: profile.language,
        tzOffsetHours: profile.tzOffsetHours,
        summaryOptIn: true,
      });
      await state.reload();
    } catch (e) {
      fail(e);
    }
  };

  const header = useMemo(() => {
    if (!state.data) return null;
    const { circle, profile } = state.data;
    return (
      <View style={styles.header}>
        {circle.myStatus === "paused" ? (
          <View style={[styles.banner, { backgroundColor: theme.goldSoft }]}>
            <Ionicons
              name="pause-circle"
              size={18}
              color={theme.gold}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[typography.subhead, styles.grow, { color: theme.text }]}>
              {t("circles.circle.menu.pausedBanner")}
            </Text>
          </View>
        ) : null}
        {canPost(circle) ? (
          <Card>
            <View style={styles.summaryHead}>
              <IconChip icon="stats-chart" />
              <View style={styles.grow}>
                <Hint>{t("circles.circle.summary.shareHint")}</Hint>
              </View>
            </View>
            {profile.summaryOptIn ? (
              <Button
                tone="plain"
                label={t("circles.circle.summary.share")}
                disabled={!mutabaah}
                onPress={() => void shareSummary()}
              />
            ) : (
              <Button
                tone="plain"
                label={t("circles.circle.summary.enable")}
                onPress={() => void enableSummary(profile)}
              />
            )}
          </Card>
        ) : null}
        {notice ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.banner, { backgroundColor: theme.accentSoft }]}
          >
            <Ionicons
              name="information-circle"
              size={18}
              color={theme.accent}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[typography.subhead, styles.grow, { color: theme.text }]}>{notice}</Text>
          </View>
        ) : null}
      </View>
    );
    // shareSummary/enableSummary close over stable api/state methods.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data, mutabaah, notice, theme, t]);

  if (state.error && !state.data) {
    const key = state.error instanceof CirclesHttpError ? state.error.key : "generic";
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <IconChip
          icon="alert-circle-outline"
          size={48}
          color={theme.danger}
          background={theme.dangerSoft}
        />
        <Text style={[typography.callout, styles.centerText, { color: theme.text }]}>
          {t(`circles.errors.${key}`)}
        </Text>
        <Button label={t("circles.retry")} onPress={() => void state.reload()} />
      </View>
    );
  }
  if (!state.data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <IconChip icon="hourglass-outline" size={48} />
        <Text style={[typography.callout, { color: theme.muted }]}>{t("circles.loading")}</Text>
      </View>
    );
  }

  const { circle, config } = state.data;
  const title = circle.name ?? t("circles.circle.defaultName");
  const paused = circle.myStatus === "paused";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t("circles.circle.menu.title")}
              onPress={() => setMenu("circle")}
              scaleTo={0.9}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-horizontal-circle" size={26} color={theme.accent} />
            </PressableScale>
          ),
        }}
      />
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: spacing.lg + (canPost(circle) ? 0 : insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={state.loading}
            onRefresh={() => void state.reload()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <IconChip icon="chatbubbles-outline" size={56} />
            <Text style={[typography.callout, styles.centerText, { color: theme.muted }]}>
              {t("circles.circle.empty")}
            </Text>
          </View>
        }
        ListFooterComponent={
          nextBefore ? (
            <Button
              tone="plain"
              label={t("circles.circle.loadOlder")}
              onPress={() => void loadOlder()}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard
            api={api}
            circleId={circleId}
            post={item}
            reactions={config.reactions}
            canReact={!paused}
            onChange={replace}
            onDeleted={(postId) => setPosts((shown) => shown.filter((p) => p.id !== postId))}
            onBlocked={(handle) => setPosts((shown) => shown.filter((p) => p.handle !== handle))}
            onNotice={setNotice}
          />
        )}
      />
      {canPost(circle) ? (
        <Composer
          api={api}
          circleId={circleId}
          maxText={config.maxTextLength}
          maxVoiceSeconds={Math.min(MAX_VOICE_SECONDS, config.maxAudioSeconds)}
          halaqahDayId={halaqahDayId}
          onPosted={(post) => {
            setPosts((shown) => [post, ...shown]);
            setNotice(null);
          }}
          onNotice={setNotice}
        />
      ) : null}

      <ActionSheet
        visible={menu === "circle"}
        title={t("circles.circle.menu.title")}
        message={paused ? undefined : t("circles.circle.menu.pauseBody")}
        onClose={() => setMenu("none")}
        actions={[
          paused
            ? { label: t("circles.circle.menu.resume"), onPress: () => void change("resume") }
            : { label: t("circles.circle.menu.pause"), onPress: () => void change("pause") },
          { label: t("circles.circle.menu.leave"), onPress: () => setMenu("leave") },
        ]}
      />
      <ActionSheet
        visible={menu === "leave"}
        title={t("circles.circle.menu.leave")}
        message={t("circles.circle.menu.leaveBody")}
        onClose={() => setMenu("none")}
        actions={[
          {
            label: t("circles.circle.menu.leaveConfirm"),
            destructive: true,
            onPress: () => void change("leave"),
          },
        ]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.md },
  header: { gap: spacing.md },
  grow: { flex: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md - 4,
    borderRadius: radius.md,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  menuButton: { width: HIT, height: HIT, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  centerText: { textAlign: "center" },
});
