import { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface BotanicalPetal {
  id: number;
  startX: number;
  startY: number;
  speedY: number;
  swaySpeed: number;
  swayAmp: number;
  tumbleSpeed: number;
  size: number;
  color: string;
  baseAngle: number;
  isBackground: boolean;
  opacity: number;
}

// Delicate painterly wisteria & garden blossom tones
const NATURAL_PETAL_COLORS = [
  'rgba(216, 190, 222, 0.52)', // Soft wisteria lavender
  'rgba(234, 215, 238, 0.48)', // Pale lilac cream
  'rgba(225, 196, 218, 0.46)', // Delicate blossom blush
  'rgba(204, 175, 212, 0.44)', // Muted wisteria violet
  'rgba(240, 224, 236, 0.40)', // Ethereal translucent petal
];

export const FloatingPetalsOverlay = memo(function FloatingPetalsOverlay() {
  // Sparse, intentional petals (only 5 in total across the entire screen)
  // Positioned predominantly along the periphery to keep the central letter unobstructed
  const petalsRef = useRef<BotanicalPetal[]>([
    {
      id: 0,
      startX: 40, // Left terrace edge near wisteria post
      startY: 60,
      speedY: 13,
      swaySpeed: 0.8,
      swayAmp: 16,
      tumbleSpeed: 1.2,
      size: 15,
      color: NATURAL_PETAL_COLORS[0],
      baseAngle: -22,
      isBackground: false,
      opacity: 0.50,
    },
    {
      id: 1,
      startX: 340, // Right edge overlooking the lake
      startY: 180,
      speedY: 15,
      swaySpeed: 0.9,
      swayAmp: 18,
      tumbleSpeed: 1.4,
      size: 13,
      color: NATURAL_PETAL_COLORS[1],
      baseAngle: 18,
      isBackground: false,
      opacity: 0.46,
    },
    {
      id: 2,
      startX: 85, // Mid-left background
      startY: 340,
      speedY: 11,
      swaySpeed: 0.65,
      swayAmp: 12,
      tumbleSpeed: 0.9,
      size: 10,
      color: NATURAL_PETAL_COLORS[2],
      baseAngle: -10,
      isBackground: true,
      opacity: 0.32,
    },
    {
      id: 3,
      startX: 310, // Mid-right background over water
      startY: 490,
      speedY: 12,
      swaySpeed: 0.75,
      swayAmp: 14,
      tumbleSpeed: 1.1,
      size: 11,
      color: NATURAL_PETAL_COLORS[3],
      baseAngle: 26,
      isBackground: true,
      opacity: 0.30,
    },
    {
      id: 4,
      startX: 130, // Lower drift past fairy sleeve
      startY: 620,
      speedY: 14,
      swaySpeed: 0.85,
      swayAmp: 16,
      tumbleSpeed: 1.3,
      size: 14,
      color: NATURAL_PETAL_COLORS[4],
      baseAngle: -14,
      isBackground: false,
      opacity: 0.44,
    },
  ]);

  const [time, setTime] = useState(0);

  useEffect(() => {
    let animId: number;
    let last = Date.now();

    const loop = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      setTime((t) => t + dt);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {petalsRef.current.map((p) => {
        // Continuous, seamless vertical fall loop
        const cycleHeight = 780;
        const y = (p.startY + time * p.speedY) % cycleHeight;
        // Natural gentle sinusoidal breeze sway
        const sway = Math.sin(time * p.swaySpeed + p.id) * p.swayAmp;
        const x = p.startX + sway;

        // 3D tumbling in breeze: scaleX oscillates between 0.30 and 1.0
        // giving the natural illusion of a cupped petal flipping edge-on as it catches the wind
        const tumbleProgress = time * p.tumbleSpeed + p.id;
        const scaleX = Math.cos(tumbleProgress) * 0.38 + 0.62;

        // Gentle tilt wobble around base resting angle (no rapid spinning)
        const tiltWobble = Math.sin(time * 0.7 + p.id) * 14;
        const currentRot = p.baseAngle + tiltWobble;

        const petalWidth = p.size;
        const petalHeight = p.size * 1.48;

        return (
          <View
            key={p.id}
            style={[
              styles.organicPetal,
              {
                left: x,
                top: y,
                width: petalWidth,
                height: petalHeight,
                backgroundColor: p.color,
                opacity: p.opacity,
                borderTopLeftRadius: petalWidth * 0.88,
                borderTopRightRadius: petalWidth * 0.36,
                borderBottomLeftRadius: petalWidth * 0.38,
                borderBottomRightRadius: petalWidth * 0.82,
                transform: [
                  { rotate: `${currentRot}deg` },
                  { scaleX: scaleX },
                ],
                ...(p.isBackground && Platform.OS === 'web'
                  ? { filter: 'blur(1.2px)' }
                  : {}),
              },
            ]}
          >
            {/* Subtle inner translucent vein highlight streak */}
            <View style={styles.petalVeinHighlight} />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  organicPetal: {
    position: 'absolute',
    borderWidth: 0.6,
    borderColor: 'rgba(165, 125, 175, 0.26)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#2A1828',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.22,
        shadowRadius: 2.5,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1.5px 4px rgba(42, 24, 40, 0.18)',
      },
    }),
  },
  petalVeinHighlight: {
    position: 'absolute',
    top: 2,
    left: '32%',
    width: 1.2,
    height: '62%',
    borderRadius: 0.6,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
    transform: [{ rotate: '8deg' }],
  },
});

export default FloatingPetalsOverlay;
