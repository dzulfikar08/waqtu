import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { Component, useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/i18n";
import { Button } from "@/ramadhan/components/fields";
import { radius, spacing, typography, useTheme } from "@/theme";

import { recordError, REPORTING_ENABLED } from "./reporter";

/**
 * Root error boundary: a render error anywhere below shows a calm screen with a restart button instead
 * of a blank app, and is queued as a fatal crash report.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    recordError(error, true);
  }

  render(): ReactNode {
    if (this.state.failed) return <CrashScreen onRetry={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}

function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  // A crash before the first screen would otherwise stay hidden behind the splash.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Reloads the JS bundle (the latest downloaded update, if any). Development builds cannot, so they
  // just render the tree again.
  const restart = () => {
    Updates.reloadAsync().catch(onRetry);
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background }]}>
      <View style={[styles.icon, { backgroundColor: theme.dangerSoft }]}>
        <Ionicons name="alert-circle" size={36} color={theme.danger} />
      </View>
      <Text style={[typography.title, styles.center, { color: theme.text }]}>
        {t("errors.title")}
      </Text>
      <Text style={[typography.body, styles.center, { color: theme.muted }]}>
        {t("errors.body")}
      </Text>
      {REPORTING_ENABLED ? (
        <Text style={[typography.footnote, styles.center, { color: theme.faint }]}>
          {t("errors.reported")}
        </Text>
      ) : null}
      <Button label={t("errors.restart")} icon="refresh" onPress={restart} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
});
