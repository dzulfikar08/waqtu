import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import type { AuthClient } from "@/auth/client";
import { circlesApi } from "@/circles/client";
import { Row, Section } from "@/components/ui";
import { useTranslation } from "@/i18n";

/**
 * Settings entry to the moderation queue and crash reports. Rendered only when `/v1/circles/config`
 * says the signed-in account is in ADMIN_USER_IDS; the server checks again on every admin call.
 */
export function AdminSection({ client }: { client: AuthClient }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = client.useSession();
  const userId = session?.user.id;
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(false);
    if (!userId || !circlesApi) return;
    let live = true;
    circlesApi
      .config()
      .then((config) => {
        if (live) setIsAdmin(config.isAdmin);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!isAdmin) return null;
  return (
    <Section title={t("admin.section")} icon="shield-checkmark" hue="circles">
      <Row
        label={t("admin.moderationRow")}
        detail={t("admin.moderationDetail")}
        icon="flag-outline"
        hue="circles"
        chevron
        onPress={() => router.push("/admin/circles")}
      />
      <Row
        label={t("admin.crashesRow")}
        detail={t("admin.crashesDetail")}
        icon="bug-outline"
        hue="neutral"
        chevron
        onPress={() => router.push("/admin/errors")}
      />
    </Section>
  );
}
