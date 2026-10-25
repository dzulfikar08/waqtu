import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { radius } from "@/theme";
import { embedHtml, isEmbedNavigation } from "../embed";

/** YouTube embed on the privacy-enhanced domain. Nothing plays until the user taps play. */
export function VideoEmbed({ youtubeId }: { youtubeId: string }) {
  const source = useMemo(() => embedHtml(youtubeId), [youtubeId]);
  return (
    <View style={styles.frame}>
      <WebView
        source={source}
        style={styles.web}
        originWhitelist={["https://www.youtube-nocookie.com", "about:blank"]}
        onShouldStartLoadWithRequest={(request) =>
          isEmbedNavigation(request.url, request.isTopFrame)
        }
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        javaScriptEnabled
        domStorageEnabled={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  web: { flex: 1, backgroundColor: "#000" },
});
