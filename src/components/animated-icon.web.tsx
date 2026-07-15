import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

const DURATION = 300;
const LOGO_ASPECT = 180 / 71;

type AnimatedIconProps = {
  compact?: boolean;
};

export function AnimatedSplashOverlay() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return null;
}

const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.1 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
    opacity: 0,
  },
  [DURATION / 1000]: {
    transform: [{ rotateZ: '0deg' }, { scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(0.7),
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon({ compact = false }: AnimatedIconProps) {
  const { width } = useWindowDimensions();
  const logoWidth = Math.min(compact ? 160 : 220, width * 0.55);
  const logoHeight = logoWidth / LOGO_ASPECT;
  const glowSize = logoWidth * 0.9;

  return (
    <View style={[styles.iconContainer, { width: logoWidth, height: Math.max(logoHeight, glowSize * 0.55) }]}>
      <Animated.View
        entering={glowKeyframe.duration(60 * 1000 * 4)}
        style={[styles.glow, { width: glowSize, height: glowSize }]}>
        <Image
          style={{ width: glowSize, height: glowSize }}
          source={require('@/assets/images/logo-glow.png')}
        />
      </Animated.View>

      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image
          style={{ width: logoWidth, height: logoHeight }}
          contentFit="contain"
          source={require('@/assets/images/pcred_logo.webp')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  glow: {
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    alignSelf: 'center',
  },
});
