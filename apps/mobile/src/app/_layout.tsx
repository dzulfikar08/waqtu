import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { initLocale } from "@/db/settings";
import { DATABASE_NAME, migrate } from "@/db/migrations";
import { setupNotificationChannels } from "@/notifications/setup";
import { useTheme } from "@/theme";
import "@/i18n";

void SplashScreen.preventAutoHideAsync().catch(() => {});

async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await migrate(db);
  await initLocale(db);
}

export default function RootLayout() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void setupNotificationChannels().catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
      <ReadyProbe onReady={() => setReady(true)} />
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </SQLiteProvider>
  );
}

// SQLiteProvider only renders children after onInit finished, so mounting means the database and language are ready.
function ReadyProbe({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}
