import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import { Button, Hint, Panel, ToggleRow } from "@/ramadhan/components/fields";
import { radius, spacing, useTheme } from "@/theme";

import type { CirclesApi } from "../api";
import { CirclesHttpError } from "../api";
import { displayInviteCode, groupCircles } from "../logic";
import type { Block, Circle, CircleProfile } from "../types";

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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
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
      <Text style={{ color: theme.muted }}>{t("circles.intro")}</Text>

      <Section title={t("circles.home.yourCircle")}>
        {publicCircle ? (
          <Row
            label={`${circleTitle(publicCircle, t("circles.circle.defaultName"))}\n${describe(publicCircle)}`}
            onPress={() => open(publicCircle)}
          />
        ) : (
          <Panel>
            <Text style={[styles.heading, { color: theme.text }]}>
              {t("circles.home.noCircle")}
            </Text>
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

      <Section title={t("circles.home.privateTitle")}>
        {privateCircles.map((circle) => (
          <Row
            key={circle.id}
            label={`${circleTitle(circle, t("circles.home.privateTitle"))}\n${describe(circle)}`}
            onPress={() => open(circle)}
          />
        ))}
        <Panel>
          <Hint>{t("circles.home.privateBody")}</Hint>
          <TextInput
            accessibilityLabel={t("circles.home.codeLabel")}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t("circles.home.codePlaceholder")}
            placeholderTextColor={theme.muted}
            maxLength={12}
            value={code}
            onChangeText={setCode}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <Button
            label={t("circles.home.joinWithCode")}
            disabled={busy || code.replace(/[^A-Za-z0-9]/g, "").length < 6}
            onPress={() =>
              void run(async () => {
                const joined = await api.joinPrivate(code);
                setCode("");
                await reload();
                open(joined.circle);
              })
            }
          />
          <TextInput
            accessibilityLabel={t("circles.home.privateName")}
            placeholder={t("circles.home.privateName")}
            placeholderTextColor={theme.muted}
            maxLength={40}
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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

      <Section title={t("circles.home.myProfile")}>
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

      {notice ? <Text style={{ color: theme.text }}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  heading: { fontSize: 18, fontWeight: "700" },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
