import { qiblaBearing } from "@waqtu/core";
import { useRouter, type Href } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  GlowHero,
  HeroButton,
  IBADAH_PAGI_HERO,
  IBADAH_PETANG_HERO,
} from "@/components/GlowHero";
import { IconChip, PressableScale, Screen, SectionTitle, type IconName } from "@/components/ui";
import { onDataChanged } from "@/db/events";
import { useMutabaah, useNow } from "@/hooks/useMutabaah";
import { useTranslation } from "@/i18n";
import { loadDuas } from "@/ibadah/content";
import { getMuhasabah } from "@/ibadah/muhasabah";
import { mutabaahItemFor } from "@/ibadah/reader";
import { useLocalValue } from "@/ibadah/store";
import { suggestTimeAt } from "@/ibadah/suggest";
import { TASBIH_KEY, parseTasbih, serializeTasbih } from "@/ibadah/tasbih";
import {
  hueColors,
  hueWash,
  radius,
  spacing,
  tintedCard,
  typography,
  useTheme,
  type Hue,
} from "@/theme";

interface Tool {
  key: string;
  hue: Hue;
  icon: IconName;
  title: string;
  detail: string;
  href: Href;
}

/**
 * The Ibadah tab: a hero for the morning or evening adhkar of this part of the day, then one tinted card per tool
 * (qibla, Al-Ma'tsurat, dzikir, doa, tasbih, muhasabah). Everything here is free and works offline.
 */
export default function IbadahScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const model = useMutabaah();
  const now = useNow(60_000);
  const [tasbih] = useLocalValue(TASBIH_KEY, parseTasbih, serializeTasbih);
  const [reflected, setReflected] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);
  const today = model?.today;

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    void getMuhasabah(db, today).then((entry) => {
      if (!cancelled) setReflected(entry !== null);
    });
    return () => {
      cancelled = true;
    };
  }, [db, today, version]);

  const time = suggestTimeAt(model?.settings ?? null, now);
  const timeWord = t(`ibadah.time.${time}`);
  const dzikirDone = (model?.todayEntries.get(mutabaahItemFor(time)) ?? 0) > 0;
  const location = model?.settings.location ?? null;
  const palette = time === "pagi" ? IBADAH_PAGI_HERO : IBADAH_PETANG_HERO;
  const duaCount = loadDuas().reduce((sum, category) => sum + category.duas.length, 0);

  const tools: Tool[] = [
    {
      key: "qibla",
      hue: "qibla",
      icon: "compass",
      title: t("ibadah.qibla.title"),
      detail: location
        ? t("ibadah.qibla.cardBearing", {
            deg: Math.round(qiblaBearing(location.latitude, location.longitude)),
          })
        : t("ibadah.qibla.cardNoLocation"),
      href: "/qibla",
    },
    {
      key: "matsurat",
      hue: "matsurat",
      icon: "book",
      title: t("ibadah.matsurat.title"),
      detail: t("ibadah.matsurat.card"),
      href: { pathname: "/matsurat", params: { time } },
    },
    {
      key: "dzikir",
      hue: "dzikir",
      icon: time === "pagi" ? "sunny" : "moon",
      title: t("ibadah.dzikir.title"),
      detail: dzikirDone
        ? t("ibadah.dzikir.cardDone", { time: t(`ibadah.timeTitle.${time}`) })
        : t("ibadah.dzikir.card"),
      href: { pathname: "/dzikir", params: { time } },
    },
    {
      key: "doa",
      hue: "doa",
      icon: "heart",
      title: t("ibadah.doa.title"),
      detail: t("ibadah.doa.count", { count: duaCount }),
      href: "/doa",
    },
    {
      key: "tasbih",
      hue: "tasbih",
      icon: "radio-button-on",
      title: t("ibadah.tasbih.title"),
      detail:
        tasbih && tasbih.count > 0
          ? t("ibadah.tasbih.cardCount", { count: tasbih.count })
          : t("ibadah.tasbih.card"),
      href: "/tasbih",
    },
    {
      key: "muhasabah",
      hue: "muhasabah",
      icon: "journal",
      title: t("ibadah.muhasabah.title"),
      detail:
        reflected === null
          ? t("ibadah.muhasabah.card")
          : reflected
            ? t("ibadah.muhasabah.cardDone")
            : t("ibadah.muhasabah.cardTodo"),
      href: "/muhasabah",
    },
  ];

  return (
    <Screen
      title={t("ibadah.tab")}
      backdrop={hueWash(theme, "ibadah")}
      caption={
        <Text style={[typography.subhead, { color: theme.muted }]}>{t("ibadah.hubSubtitle")}</Text>
      }
    >
      <GlowHero
        palette={palette}
        icon={time === "pagi" ? "sunny" : "moon"}
        title={time === "pagi" ? t("ibadah.heroPagi") : t("ibadah.heroPetang")}
        body={dzikirDone ? t("ibadah.heroDone", { time: timeWord }) : t("ibadah.heroBody")}
      >
        <View style={styles.heroButtons}>
          <View style={styles.grow}>
            <HeroButton
              primary
              palette={palette}
              icon="book"
              label={t("ibadah.matsurat.title")}
              onPress={() => router.push({ pathname: "/matsurat", params: { time } })}
            />
          </View>
          <View style={styles.grow}>
            <HeroButton
              palette={palette}
              icon={time === "pagi" ? "sunny" : "moon"}
              label={t(`ibadah.timeTitle.${time}`)}
              onPress={() => router.push({ pathname: "/dzikir", params: { time } })}
            />
          </View>
        </View>
      </GlowHero>
      <View style={styles.block}>
        <SectionTitle title={t("ibadah.tools")} icon="sparkles" hue="ibadah" />
        <View style={styles.grid}>
          {tools.map((tool) => (
            <ToolCard key={tool.key} tool={tool} onPress={() => router.push(tool.href)} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function ToolCard({ tool, onPress }: { tool: Tool; onPress: () => void }) {
  const theme = useTheme();
  const colors = hueColors(theme, tool.hue);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${tool.title}. ${tool.detail}`}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.card, tintedCard(theme, tool.hue)]}
    >
      <IconChip icon={tool.icon} size={40} color={colors.base} background={colors.soft} />
      <View style={styles.cardText}>
        <Text numberOfLines={2} style={[typography.headline, { color: theme.text }]}>
          {tool.title}
        </Text>
        <Text numberOfLines={2} style={[typography.footnote, { color: theme.muted }]}>
          {tool.detail}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  heroButtons: { flexDirection: "row", gap: spacing.sm },
  grow: { flex: 1 },
  block: { gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 4 },
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 136,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm + 2,
    justifyContent: "space-between",
  },
  cardText: { gap: 2 },
});
