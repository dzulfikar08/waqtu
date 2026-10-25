import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Divider, IconChip, Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel, ToggleRow } from "@/ramadhan/components/fields";
import { hueColors, radius, spacing, typography, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { CirclesHttpError } from "../api";
import { displayInviteCode, groupCircles, handleProblem, isInviteCode } from "../logic";
import type { Block, Circle, CircleProfile } from "../types";
import { TextField } from "./TextField";

function circleTitle(circle: Circle, fallback: string): string {
  return circle.name ?? fallback;
}

/** Signed in, profile set: the circles you are in, plus ways to join another. */
export function CirclesHome({
  api,
  profile,
  circles,
  reload,
}: {
  api: CirclesApi;
  profile: CircleProfile;
  circles: Circle[];
  reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rose = hueColors(theme, "circles");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState(profile.handle);
  const handleIssue = handleProblem(handle);
  const handleChanged = handle.trim() !== profile.handle;
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const { publicCircle, privateCircles } = groupCircles(circles);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setNotice(t(`circles.errors.${e instanceof CirclesHttpError ? e.key : "generic"}`));
    } finally {
      setBusy(false);
    }
  };

  const open = (circle: Circle) => router.push(`/circle/${circle.id}`);

  const describe = (circle: Circle) =>
    [
      t("circles.home.members", { count: circle.memberCount }),
      circle.ready ? null : t("circles.home.waiting"),
      circle.myStatus === "paused" ? t("circles.home.pausedBadge") : null,
      circle.inviteCode
        ? t("circles.home.inviteCode", { code: displayInviteCode(circle.inviteCode) })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <View style={styles.root}>
      <Text style={[typography.subhead, styles.intro, { color: theme.muted }]}>
        {t("circles.intro")}
      </Text>

      <Section title={t("circles.home.yourCircle")} icon="globe-outline" hue="circles">
        {publicCircle ? (
          <Row
            icon="people"
            hue="circles"
            label={circleTitle(publicCircle, t("circles.circle.defaultName"))}
            detail={describe(publicCircle)}
            chevron
            onPress={() => open(publicCircle)}
          />
        ) : (
          <Panel>
            <View style={styles.empty}>
              <IconChip icon="people-outline" size={44} color={rose.base} background={rose.soft} />
              <Text style={[typography.headline, styles.grow, { color: theme.text }]}>
                {t("circles.home.noCircle")}
              </Text>
            </View>
            <Hint>{t("circles.home.noCircleBody")}</Hint>
            <Button
              label={busy ? t("circles.loading") : t("circles.home.joinPublic")}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const joined = await api.joinPublic();
                  await reload();
                  open(joined.circle);
                })
              }
            />
          </Panel>
        )}
      </Section>

      <Section title={t("circles.home.privateTitle")} icon="lock-closed-outline" hue="circles">
        {privateCircles.map((circle) => (
          <Row
            key={circle.id}
            icon="lock-closed"
            hue="circles"
            label={circleTitle(circle, t("circles.home.privateTitle"))}
            detail={describe(circle)}
            chevron
            onPress={() => open(circle)}
          />
        ))}
        <Panel>
          <Hint>{t("circles.home.privateBody")}</Hint>
          <TextField
            accessibilityLabel={t("circles.home.codeLabel")}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t("circles.home.codePlaceholder")}
            maxLength={12}
            value={code}
            onChangeText={setCode}
          />
          <Button
            label={t("circles.home.joinWithCode")}
            disabled={busy || !isInviteCode(code)}
            onPress={() =>
              void run(async () => {
                const joined = await api.joinPrivate(code);
                setCode("");
                await reload();
                open(joined.circle);
              })
            }
          />
        </Panel>
        <Divider />
        <Panel>
          <TextField
            accessibilityLabel={t("circles.home.privateName")}
            placeholder={t("circles.home.privateName")}
            maxLength={40}
            value={name}
            onChangeText={setName}
          />
          <Button
            tone="plain"
            label={t("circles.home.createPrivate")}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const created = await api.createPrivate(name.trim() || null);
                setName("");
                await reload();
                open(created);
              })
            }
          />
        </Panel>
      </Section>

      <Section title={t("circles.home.myProfile")} icon="person-circle-outline" hue="circles">
        <Panel>
          <TextField
            accessibilityLabel={t("circles.onboarding.handle")}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
            value={handle}
            onChangeText={setHandle}
          />
          {handleIssue ? <Hint>{t(`circles.handleProblem.${handleIssue}`)}</Hint> : null}
          <Button
            tone="plain"
            label={t("circles.home.saveHandle")}
            disabled={busy || !handleChanged || handleIssue !== null}
            onPress={() =>
              void run(async () => {
                const saved = await api.saveProfile({
                  handle: handle.trim(),
                  language: profile.language,
                  tzOffsetHours: profile.tzOffsetHours,
                });
                setHandle(saved.handle);
                await reload();
                setNotice(t("circles.home.saved"));
              })
            }
          />
        </Panel>
        <ToggleRow
          label={t("circles.home.summaryOptIn")}
          hint={t("circles.home.summaryOptInHint")}
          value={profile.summaryOptIn}
          disabled={busy}
          onValueChange={(next) =>
            void run(async () => {
              await api.saveProfile({
                handle: profile.handle,
                language: profile.language,
                tzOffsetHours: profile.tzOffsetHours,
                summaryOptIn: next,
              });
              await reload();
              setNotice(t("circles.home.saved"));
            })
          }
        />
        <Row
          icon="ban-outline"
          hue="circles"
          label={t("circles.home.blocked")}
          onPress={() =>
            void run(async () => {
              setBlocks(blocks ? null : await api.blocks());
            })
          }
        />
        {blocks ? (
          blocks.length === 0 ? (
            <Panel>
              <Hint>{t("circles.blocks.empty")}</Hint>
            </Panel>
          ) : (
            blocks.map((block) => (
              <Row
                key={block.id}
                icon="person-remove-outline"
                hue="circles"
                label={`${block.handle} · ${t("circles.blocks.unblock")}`}
                onPress={() =>
                  void run(async () => {
                    await api.unblock(block.id);
                    setBlocks((current) => current?.filter((b) => b.id !== block.id) ?? null);
                  })
                }
              />
            ))
          )
        ) : null}
      </Section>

      {notice ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.notice, { backgroundColor: rose.soft }]}
        >
          <Ionicons
            name="information-circle"
            size={18}
            color={rose.base}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[typography.subhead, styles.grow, { color: theme.text }]}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  intro: { lineHeight: 20, paddingHorizontal: spacing.xs },
  grow: { flex: 1 },
  empty: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md - 4,
    borderRadius: radius.md,
  },
});
