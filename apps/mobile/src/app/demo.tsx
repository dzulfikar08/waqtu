import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";

import { DEMO_MODE } from "@/demo/mode";
import { seedDemo } from "@/demo/seed";
import { isLocale } from "@/i18n/locale";

const TARGETS = {
  today: "/",
  week: "/week",
  ramadhan: "/ramadhan",
  settings: "/settings",
} as const;

/**
 * `waqtu://demo?lang=id|en&to=today|week|ramadhan|settings`: loads the demo data and opens a tab. Only the screenshot build
 * (EXPO_PUBLIC_DEMO_MODE=1) does this; every other build bounces to the home tab.
 */
export default function DemoRoute() {
  if (!DEMO_MODE) return <Redirect href="/" />;
  return <DemoSeed />;
}

function DemoSeed() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { lang, to } = useLocalSearchParams<{ lang?: string; to?: string }>();

  useEffect(() => {
    const locale = isLocale(lang) ? lang : "id";
    const target = TARGETS[to as keyof typeof TARGETS] ?? "/";
    void seedDemo(db, locale)
      .catch((error: unknown) => console.error("demo seed failed", error))
      .then(() => router.replace(target));
  }, [db, router, lang, to]);

  return null;
}
