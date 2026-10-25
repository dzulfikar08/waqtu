import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { View } from "react-native";

import { CirclesHttpError, isUnauthorized, type CirclesApi } from "@/circles/api";
import { circlesApi } from "@/circles/client";
import type { Circle } from "@/circles/types";
import { VOICE_MIME } from "@/circles/useVoiceRecorder";
import { useTranslation } from "@/i18n";
import { Button, Hint } from "@/ramadhan/components/fields";
import { spacing } from "@/theme";
import { getReflection, getVoiceReflection } from "../db";
import { halaqahRef } from "../program";
import { reflectionVoiceUri } from "../recordings";

type State =
  | { step: "idle" }
  | { step: "busy" }
  | { step: "choose"; circles: Circle[]; maxText: number }
  | { step: "sent"; circle: Circle }
  | { step: "problem"; message: string };

/**
 * Optional, explicit sharing of the day's reflection (text and/or voice) to one of the user's
 * circles. Nothing leaves the phone until a circle is picked; the voice note then uploads through
 * the circle media route (R2) and plays back in the circle feed like any other voice post.
 */
export function ShareToCircle({ programId, day }: { programId: string; day: number }) {
  if (!circlesApi) return null;
  return <ShareFlow api={circlesApi} programId={programId} day={day} />;
}

function ShareFlow({ api, programId, day }: { api: CirclesApi; programId: string; day: number }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ step: "idle" });

  const fail = (e: unknown) =>
    setState({
      step: "problem",
      message: isUnauthorized(e)
        ? t("halaqah.share.signIn")
        : t(`circles.errors.${e instanceof CirclesHttpError ? e.key : "generic"}`),
    });

  const open = async () => {
    setState({ step: "busy" });
    try {
      const [config, circles] = await Promise.all([api.config(), api.list()]);
      if (config.requiresPremium) {
        setState({ step: "problem", message: t("circles.premium.title") });
        return;
      }
      const active = circles.filter((c) => c.myStatus === "active");
      setState(
        active.length === 0
          ? { step: "problem", message: t("halaqah.share.noCircle") }
          : { step: "choose", circles: active, maxText: config.maxTextLength },
      );
    } catch (e) {
      fail(e);
    }
  };

  const share = async (circle: Circle, maxText: number) => {
    setState({ step: "busy" });
    try {
      const text = await getReflection(db, programId, day);
      const voice = await getVoiceReflection(db, programId, day);
      if (text === "" && voice === null) {
        setState({ step: "problem", message: t("halaqah.share.empty") });
        return;
      }
      if (text.length > maxText) {
        setState({ step: "problem", message: t("halaqah.share.tooLong", { max: maxText }) });
        return;
      }
      const mediaId = voice
        ? (
            await api.uploadVoice(
              circle.id,
              reflectionVoiceUri(voice.file),
              VOICE_MIME,
              voice.seconds,
            )
          ).mediaId
        : undefined;
      await api.post(circle.id, {
        ...(text ? { text } : {}),
        ...(mediaId ? { mediaId } : {}),
        halaqahDayId: halaqahRef(programId, day),
      });
      setState({ step: "sent", circle });
    } catch (e) {
      fail(e);
    }
  };

  const name = (circle: Circle) => circle.name ?? t("circles.circle.defaultName");

  switch (state.step) {
    case "idle":
    case "busy":
      return (
        <Button
          tone="plain"
          label={state.step === "busy" ? t("halaqah.share.busy") : t("halaqah.share.button")}
          disabled={state.step === "busy"}
          onPress={() => void open()}
        />
      );
    case "choose":
      return (
        <View style={{ gap: spacing.sm }}>
          <Hint>{t("halaqah.share.warning")}</Hint>
          {state.circles.map((circle) => (
            <Button
              key={circle.id}
              label={t("halaqah.share.to", { name: name(circle) })}
              onPress={() => void share(circle, state.maxText)}
            />
          ))}
          <Button
            tone="plain"
            label={t("halaqah.share.cancel")}
            onPress={() => setState({ step: "idle" })}
          />
        </View>
      );
    case "sent":
      return (
        <View style={{ gap: spacing.sm }}>
          <Hint>{t("halaqah.share.sent", { name: name(state.circle) })}</Hint>
          <Button
            tone="plain"
            label={t("halaqah.share.openCircle")}
            onPress={() =>
              router.push({ pathname: "/circle/[id]", params: { id: state.circle.id } })
            }
          />
        </View>
      );
    case "problem":
      return (
        <View style={{ gap: spacing.sm }}>
          <Hint>{state.message}</Hint>
          <Button tone="plain" label={t("halaqah.share.button")} onPress={() => void open()} />
        </View>
      );
  }
}
