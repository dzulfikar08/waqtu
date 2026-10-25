import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The corner art of a gradient hero card: a soft glow and two glass rings in the top-right corner, gently breathing
 * with `breathe` (still under reduced motion), and `children` (a sun, a glyph disc, stars) drawn over them. Fills the card, which must clip
 * (`overflow: "hidden"`). Hidden from screen readers.
 */
export function HeroGlow({
  glow = "rgba(255,255,255,0.34)",
  breathe = false,
  children,
}: {
  /** Colour at the centre of the glow. */
  glow?: string;
  breathe?: boolean;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [breath] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!breathe || reduced) return;
    const step = (toValue: number) =>
      Animated.timing(breath, {
        toValue,
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([step(1), step(0)]));
    loop.start();
    return () => loop.stop();
  }, [breathe, reduced, breath]);
  const ring = (from: number, to: number) => ({
    transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }],
  });
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          styles.glow,
          {
            experimental_backgroundImage: `radial-gradient(circle at center, ${glow} 0%, rgba(255,255,255,0) 68%)`,
          },
        ]}
      />
      <Animated.View style={[styles.ring, styles.ringOuter, ring(1, 1.06)]} />
      <Animated.View style={[styles.ring, styles.ringInner, ring(1.04, 0.98)]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    width: 250,
    height: 250,
    top: -110,
    right: -90,
    borderRadius: 125,
  },
  ring: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  ringOuter: { width: 206, height: 206, borderRadius: 103, top: -86, right: -64 },
  ringInner: { width: 146, height: 146, borderRadius: 73, top: -56, right: -34 },
});
