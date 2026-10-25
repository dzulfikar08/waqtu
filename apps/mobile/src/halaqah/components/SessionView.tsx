import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { Section } from "@/components/ui";
import { useTranslation } from "@/i18n";
import type { DayKey } from "@/mutabaah/dates";
import { Button, Hint, Panel } from "@/ramadhan/components/fields";
import { radius, spacing, useTheme } from "@/theme";
import { completeDay, getReflection, MAX_REFLECTION, saveReflection, uncompleteDay } from "../db";
import { watchUrl } from "../embed";
import type { Program, ProgramDay } from "../program";
import { ShareToCircle } from "./ShareToCircle";
import { VideoEmbed } from "./VideoEmbed";
import { VoiceReflection } from "./VoiceReflection";

export function useLang(): "id" | "en" {
  return useTranslation().i18n.language === "en" ? "en" : "id";
}

interface Props {
  program: Program;
  day: ProgramDay;
  done: boolean;
  /** Today's civil day: the mutabaah entry is written here, which for catch-up differs from the program day. */
  todayKey: DayKey;
}

/**
 * One day's session: video, summary, madhhab note, private reflection (text and voice, optionally
 * shared to a circle), optional amalan, and the Selesai button.
 */
export function SessionView({ program, day, done, todayKey }: Props) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const lang = useLang();
  const { video } = day;
  const phase = program.phases.find((p) => p.id === day.phase);

  const toggleDone = () => {
    const run = done
      ? uncompleteDay(db, program.id, day.day)
      : completeDay(db, program.id, day.day, todayKey);
    void run.catch(() => {});
  };

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={{ color: theme.accent, fontWeight: "600" }}>
          {t("halaqah.dayN", { day: day.day })}
          {phase ? ` · ${phase.title[lang]}` : ""}
        </Text>
        <Text style={[styles.title, { color: theme.text }]}>{day.title[lang]}</Text>
      </View>

      <VideoEmbed key={video.youtubeId} youtubeId={video.youtubeId} />
      <View style={styles.meta}>
        <Text style={{ color: theme.muted }}>
          {t("halaqah.speakerLine", {
            speaker: video.speaker,
            channel: video.channelName,
            minutes: video.durationMin,
          })}
        </Text>
        <Hint>{t("halaqah.videoNote")}</Hint>
        <Button
          tone="plain"
          label={t("halaqah.openYoutube")}
          onPress={() => void Linking.openURL(watchUrl(video.youtubeId)).catch(() => {})}
        />
        {lang === "en" ? <Hint>{t("halaqah.contentNote")}</Hint> : null}
      </View>

      <Section title={t("halaqah.summary")}>
        <Panel>
          <Text style={[styles.body, { color: theme.text }]}>{day.summary}</Text>
        </Panel>
      </Section>

      {day.madhhabNote ? (
        <Section title={t("halaqah.madhhab")}>
          <Panel>
            <Text style={[styles.body, { color: theme.text }]}>{day.madhhabNote}</Text>
          </Panel>
        </Section>
      ) : null}

      <Section title={t("halaqah.reflection")}>
        <Panel>
          <Text style={[styles.body, { color: theme.text }]}>{day.reflectionPrompt}</Text>
          <ReflectionField programId={program.id} day={day.day} />
          <VoiceReflection programId={program.id} day={day.day} />
          <Hint>{t("halaqah.reflectionPrivate")}</Hint>
          <ShareToCircle programId={program.id} day={day.day} />
        </Panel>
      </Section>

      {day.amalan ? (
        <Section title={t("halaqah.amalan")}>
          <Panel>
            <Text style={[styles.body, { color: theme.text }]}>{day.amalan}</Text>
          </Panel>
        </Section>
      ) : null}

      {day.sources.length > 0 ? (
        <Section title={t("halaqah.sources")}>
          <Panel>
            {day.sources.map((source) => (
              <Hint key={source}>{source}</Hint>
            ))}
          </Panel>
        </Section>
      ) : null}

      {done ? (
        <Text style={{ color: theme.accent, fontWeight: "600" }}>{t("halaqah.markedDone")}</Text>
      ) : null}
      <Button
        tone={done ? "plain" : "primary"}
        label={done ? t("halaqah.undo") : t("halaqah.markDone")}
        onPress={toggleDone}
      />
    </View>
  );
}

const SAVE_DELAY_MS = 800;

/** Multiline reflection; saves shortly after typing stops, on blur, and when the screen closes. */
function ReflectionField({ programId, day }: { programId: string; day: number }) {
  const db = useSQLiteContext();
  const { t } = useTranslation();
  const theme = useTheme();
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    void saveReflection(db, programId, day, value)
      .then(() => setSaved(true))
      .catch(() => {});
  }, [db, programId, day]);

  useEffect(() => {
    let cancelled = false;
    void getReflection(db, programId, day).then((body) => {
      if (cancelled) return;
      setText(body);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      flush();
    };
  }, [db, programId, day, flush]);

  if (!loaded) return null;
  return (
    <View style={styles.reflection}>
      <TextInput
        accessibilityLabel={t("halaqah.reflection")}
        multiline
        maxLength={MAX_REFLECTION}
        placeholder={t("halaqah.reflectionPlaceholder")}
        placeholderTextColor={theme.muted}
        value={text}
        onChangeText={(next) => {
          setText(next);
          setSaved(false);
          pending.current = next;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, SAVE_DELAY_MS);
        }}
        onBlur={flush}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
        ]}
        textAlignVertical="top"
      />
      {saved ? <Hint>{t("halaqah.reflectionSaved")}</Hint> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  head: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  title: { fontSize: 22, fontWeight: "700" },
  meta: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  body: { fontSize: 16, lineHeight: 24 },
  reflection: { gap: spacing.xs },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
});
