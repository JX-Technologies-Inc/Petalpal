import { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const TWINKLE_KEYFRAMES = `
@keyframes petalpalTwinkle {
  0% {
    transform: scale(0.94) rotate(0deg);
    opacity: 0.88;
    filter: drop-shadow(0 0 3px #FFFFFF) drop-shadow(0 0 6px rgba(243, 212, 138, 0.85)) drop-shadow(0 0 12px rgba(243, 212, 138, 0.45));
  }
  22% {
    transform: scale(0.97) rotate(1deg);
    opacity: 0.90;
  }
  44% {
    transform: scale(1.15) rotate(3deg);
    opacity: 1;
    filter: drop-shadow(0 0 4.5px #FFFFFF) drop-shadow(0 0 9px rgba(243, 212, 138, 1)) drop-shadow(0 0 16px rgba(228, 180, 70, 0.70));
  }
  64% {
    transform: scale(0.98) rotate(-1deg);
    opacity: 0.92;
  }
  78% {
    transform: scale(1.08) rotate(1.5deg);
    opacity: 0.96;
    filter: drop-shadow(0 0 3.5px #FFFFFF) drop-shadow(0 0 7.5px rgba(243, 212, 138, 0.90));
  }
  100% {
    transform: scale(0.94) rotate(0deg);
    opacity: 0.88;
    filter: drop-shadow(0 0 3px #FFFFFF) drop-shadow(0 0 6px rgba(243, 212, 138, 0.85)) drop-shadow(0 0 12px rgba(243, 212, 138, 0.45));
  }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('petalpal-star-twinkle')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'petalpal-star-twinkle';
  styleEl.textContent = TWINKLE_KEYFRAMES;
  document.head.appendChild(styleEl);
}

interface SparklingMagicStarProps {
  size?: number;
  isFadingOut?: boolean;
  style?: any;
}

/**
 * SparklingMagicStar:
 * Prominent, radiant fairy starlight indicator for unread mail.
 * Features a refined 4-point astroid starburst in pale champagne-gold (#F3D48A),
 * delicate micro-rays, luminous diamond core, starlight halo, and gentle
 * irregular twinkling every 3-4 seconds.
 * Fades out smoothly when mail is opened.
 */
export const SparklingMagicStar = memo(function SparklingMagicStar({
  size = 22,
  isFadingOut = false,
  style,
}: SparklingMagicStarProps) {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          opacity: isFadingOut ? 0 : 1,
          ...Platform.select({
            web: {
              animation: isFadingOut
                ? 'none'
                : 'petalpalTwinkle 3.6s ease-in-out infinite',
              transition:
                'opacity 0.38s ease-out, transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)',
              transform: isFadingOut ? 'scale(0.3)' : 'scale(1)',
            },
          }),
        },
        style,
      ]}
      pointerEvents="none"
      accessibilityLabel="Unread letter magic sparkle"
    >
      {Platform.OS === 'web' ? (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          style={
            {
              overflow: 'visible',
              filter:
                'drop-shadow(0 0 3px #FFFFFF) drop-shadow(0 0 7px rgba(243, 212, 138, 0.95)) drop-shadow(0 0 14px rgba(228, 180, 70, 0.65))',
            } as any
          }
        >
          <defs>
            <radialGradient id="champagneGoldGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#FFF8E2" />
              <stop offset="65%" stopColor="#F3D48A" />
              <stop offset="100%" stopColor="#E5B842" />
            </radialGradient>
            <radialGradient id="champagneCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="100%" stopColor="#FFEAA0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="starHaloGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF2B8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#F3D48A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#E5B842" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient luminous starlight aura halo */}
          <circle cx="16" cy="16" r="14" fill="url(#starHaloGrad)" />

          {/* Delicate diagonal secondary micro-rays (8-point starlight flair) */}
          <path
            d="M16 11 L19 13 L24 8 L21 16 L26 21 L19 19 L16 24 L13 19 L6 21 L11 16 L8 8 L13 13 Z"
            fill="url(#champagneGoldGrad)"
            opacity="0.82"
          />

          {/* Primary 4-Point Astroid Diamond Star */}
          <path
            d="M16 2 Q16 16 2 16 Q16 16 16 30 Q16 16 30 16 Q16 16 16 2 Z"
            fill="url(#champagneGoldGrad)"
          />

          {/* Radiant white starlight diamond core */}
          <circle cx="16" cy="16" r="3.0" fill="#FFFFFF" />
          <circle cx="16" cy="16" r="5.5" fill="url(#champagneCore)" />
        </svg>
      ) : (
        <View style={[styles.nativeCore, { width: size, height: size }]}>
          <View style={styles.nativeRayVertical} />
          <View style={styles.nativeRayHorizontal} />
          <View style={styles.nativeCenterGleam} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  nativeCore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeRayVertical: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#F3D48A',
    borderRadius: 1,
  },
  nativeRayHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#F3D48A',
    borderRadius: 1,
  },
  nativeCenterGleam: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: '#FFFFFF',
  },
});
