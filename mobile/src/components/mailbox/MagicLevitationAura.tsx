import { memo, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

interface MagicParticle {
  id: number;
  initialX: number;
  initialY: number;
  speedY: number;
  speedX: number;
  size: number;
  color: string;
  opacity: number;
}

const FAIRY_DUST_COLORS = [
  'rgba(247, 226, 179, 0.75)', // Warm golden glow
  'rgba(215, 238, 208, 0.70)', // Soft fairy leaf green
  'rgba(255, 245, 220, 0.85)', // Starlight white-gold
  'rgba(235, 205, 245, 0.65)', // Pale wisteria violet
];

export const MagicLevitationAura = memo(function MagicLevitationAura() {
  const particlesRef = useRef<MagicParticle[]>(
    Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      initialX: 30 + Math.random() * 200,
      initialY: 40 + Math.random() * 50,
      speedY: 12 + Math.random() * 16,
      speedX: (Math.random() - 0.5) * 8,
      size: 2.2 + Math.random() * 2.4,
      color: FAIRY_DUST_COLORS[i % FAIRY_DUST_COLORS.length],
      opacity: 0.35 + Math.random() * 0.45,
    }))
  );

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

  // Subtle breathing pulse for the levitation aura
  const auraPulse = 0.42 + Math.sin(time * 1.6) * 0.12;

  return (
    <View style={styles.auraContainer} pointerEvents="none">
      {/* ── Soft Ethereal Levitation Radiant Halo ── */}
      <View
        style={[
          styles.glowCore,
          {
            opacity: auraPulse,
          },
        ]}
      />
      <View
        style={[
          styles.glowOuter,
          {
            opacity: auraPulse * 0.65,
          },
        ]}
      />

      {/* ── Subtle Rising Fairy Dust Motes ── */}
      {particlesRef.current.map((p) => {
        // Particles rise upward from the palms towards the envelopes
        const y = 80 - ((p.initialY + time * p.speedY) % 75);
        const sway = Math.sin(time * 2.0 + p.id) * 8;
        const x = (p.initialX + sway) % 260;
        // Fade in as they rise, fade out at the top
        const lifeProgress = y / 80;
        const currentOpacity = p.opacity * Math.sin(lifeProgress * Math.PI);

        return (
          <View
            key={p.id}
            style={[
              styles.particle,
              {
                left: x,
                top: y,
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity: currentOpacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  auraContainer: {
    position: 'absolute',
    bottom: -15,
    alignSelf: 'center',
    width: 270,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  glowCore: {
    position: 'absolute',
    width: 190,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(250, 228, 170, 0.38)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFE5A3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 18,
      },
      android: {
        elevation: 4,
      },
      web: {
        filter: 'blur(14px)',
        boxShadow: '0 0 28px rgba(250, 228, 170, 0.55)',
      },
    }),
  },
  glowOuter: {
    position: 'absolute',
    width: 250,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(180, 230, 195, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#B4E6C3',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
      android: {
        elevation: 3,
      },
      web: {
        filter: 'blur(22px)',
        boxShadow: '0 0 40px rgba(180, 230, 195, 0.35)',
      },
    }),
  },
  particle: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
      },
    }),
  },
});

export default MagicLevitationAura;
