import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

type AnimatedIconProps = {
  compact?: boolean;
};

export function AnimatedIcon({ compact = false }: AnimatedIconProps) {
  const size = compact ? 140 : 190;

  return (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <Animated.View style={styles.imageContainer}>
        <Image
          style={[styles.image, compact && styles.imageCompact]}
          contentFit="contain"
          source={require('../../assets/images/pcred_logo.webp')}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 150,
    height: 150,
    zIndex: 100,
  },
  image: {
    width: 180,
    height: 150,
  },
  imageCompact: {
    width: 130,
    height: 110,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
