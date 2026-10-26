import { useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { adminErrorKey, Badge } from "@/admin/components";
import type { CirclesApi } from "@/circles/api";
import { circlesApi } from "@/circles/client";
import { useLoad } from "@/circles/useLoad";
import { Card } from "@/components/ui";
import type { ErrorGroup } from "@/errors/report";
import { useTranslation } from "@/i18n";
import { Button, Hint } from "@/ramadhan/components/fields";
import { spacing, tabular, typography, useTheme } from "@/theme";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** Anonymous crash reports of the last 7 days (`GET /v1/admin/errors`), grouped by error, latest first. */
export default function CrashReportsScreen() {
  if (!circlesApi) return null;
  return <CrashReports api={circlesApi} />;
}

function CrashReports({ api }: { api: CirclesApi }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const state = useLoad(async () => (await api.adminErrors()).groups);
  const groups = state.data;

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
      {state.error && !groups ? (
        <Card>
          <Hint>{t(adminErrorKey(state.error))}</Hint>
          <Button tone="plain" label={t("circles.retry")} onPress={() => void state.reload()} />
        </Card>
      ) : null}
      {groups && groups.length === 0 ? (
        <Card>
          <Hint>{t("admin.crashes.empty")}</Hint>
        </Card>
      ) : null}
      {groups?.map((group) => (
        <GroupCard
          key={`${group.name}\n${group.message}\n${group.topFrame}`}
          group={group}
        />
      ))}
    </ScrollView>
  );
}

function GroupCard({ group }: { group: ErrorGroup }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const lastSeen = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(group.lastSeen);

  return (
    <Card>
      <View style={styles.head}>
        {group.fatal ? (
          <Badge
            label={t("admin.crashes.fatal")}
            color={theme.danger}
            background={theme.dangerSoft}
          />
        ) : (
          <Badge
            label={t("admin.crashes.error")}
            color={theme.warning}
            background={theme.warningSoft}
          />
        )}
        <Text style={[typography.caption, tabular, styles.grow, { color: theme.muted }]}>
          {t("admin.crashes.lastSeen", { time: lastSeen })}
        </Text>
      </View>
      <Text style={[typography.subhead, styles.strong, { color: theme.text }]} selectable>
        {`${group.name}: ${group.message}`}
      </Text>
      {group.topFrame ? (
        <Text
          style={[typography.caption, { color: theme.muted, fontFamily: MONO }]}
          numberOfLines={2}
          selectable
        >
          {group.topFrame}
        </Text>
      ) : null}
      <Text style={[typography.footnote, tabular, { color: theme.muted }]}>
        {t("admin.crashes.counts", { reports: group.reports, occurrences: group.occurrences })}
      </Text>
      <Text style={[typography.footnote, { color: theme.muted }]}>
        {`${group.platforms.join(", ")} · ${t("admin.crashes.versions", { list: group.appVersions.join(", ") })}`}
      </Text>
      {group.screens.length > 0 ? (
        <Text style={[typography.footnote, { color: theme.muted }]}>
          {t("admin.crashes.screens", { list: group.screens.join(", ") })}
        </Text>
      ) : null}
      {group.stack ? (
        <>
          <Button
            tone="plain"
            label={t(open ? "admin.crashes.hideStack" : "admin.crashes.showStack")}
            onPress={() => setOpen((v) => !v)}
          />
          {open ? (
            <Text
              style={[styles.stack, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
              selectable
            >
              {group.stack}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md + 4, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  grow: { flex: 1 },
  strong: { fontWeight: "600" },
  stack: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 15,
    padding: spacing.sm,
    borderRadius: 8,
  },
});
