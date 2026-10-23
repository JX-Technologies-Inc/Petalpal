import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions } from 'react-native';
import { drawPetalCard, type PetalCardFace, type PetalToday } from '../../services/petalCardDraw';
import { PETAL_CARD_ART } from './petalCardArt';

const BACKS = {
  lilac: require('@/assets/petal-card-backs/lilac.webp'),
  violet: require('@/assets/petal-card-backs/violet.webp'),
};

const COPY = {
  en: { title: 'THE PETAL RING', sub: "Spin through today's whole deck and choose one", hint: 'Drag to spin · tap the glowing card',
    no: 'No.', round: 'Round', turnOver: 'Turn it over', close: 'Close', today: "Today's petal card", drawing: 'Drawing…',
    failed: "The draw didn't go through. Try again.", chosen: (n: number) => `You chose No. ${n} of today's deck` },
  'zh-Hans': { title: 'THE PETAL RING', sub: '转动花环，翻遍今天的整副牌，选一张', hint: '拖动转圈 · 点发光的那张',
    no: '第', round: '轮次', turnOver: '翻开它', close: '关闭', today: '今日花语卡', drawing: '正在抽牌…',
    failed: '抽牌没有成功，再试一次。', chosen: (n: number) => `你选了今天的第 ${n} 张` },
};

const mod = (n: number, m: number) => ((n % m) + m) % m;
const wrap = (a: number) => mod(a + 180, 360) - 180;

// The petal ring (design: the owner's loop ring): a few card places on a tilted ring with the
// whole of today's deck flowing through them. One step brings the next card to the front, a
// full turn the next batch, and after the last card the first comes round again. The deck order
// stays on the server; tapping the front card sends its place and the server reveals the card.
export function PetalRing({ visible, today, onClose }: { visible: boolean; today: PetalToday | null; onClose: () => void }) {
  const { width: vw, height: vh } = useWindowDimensions();
  const locale = today?.locale ?? 'en';
  const copy = COPY[locale];
  const size = useMemo(() => {
    const cw = Math.round(Math.max(58, Math.min(112, Math.min(vw * 0.19, vh * 0.12))));
    const r = Math.round(Math.max(140, Math.min(420, vw * 0.42)));
    const n = Math.max(8, Math.floor((2 * Math.PI * r) / (cw * 1.5)));
    return { cw, ch: Math.round(cw * 1.55), r, n, step: 360 / n };
  }, [vw, vh]);
  const deckSize = today?.deckSize ?? 69;
  const [angle, setAngle] = useState(0);
  const motion = useRef({ angle: 0, velocity: 0, dragging: false, start: 0, last: 0, lastT: 0 });
  const [phase, setPhase] = useState<'spin' | 'drawing' | 'chosen' | 'revealed'>('spin');
  const [face, setFace] = useState<PetalCardFace | null>(null);
  const [chosenNo, setChosenNo] = useState(0);
  const [error, setError] = useState('');
  const lift = useRef(new Animated.Value(0)).current, flip = useRef(new Animated.Value(0)).current;

  // Opening: show today's card straight away if it was drawn already, else spin in.
  useEffect(() => {
    if (!visible) return;
    lift.setValue(0); flip.setValue(0); setError('');
    if (today?.drawn?.card) {
      setFace(today.drawn.card); setChosenNo(mod(today.drawn.position, deckSize) + 1); setPhase('revealed');
      lift.setValue(1); flip.setValue(1);
    } else {
      setFace(null); setPhase('spin');
      motion.current.angle = 0; motion.current.velocity = -1.4; setAngle(0);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inertia and snapping, one frame at a time while spinning.
  useEffect(() => {
    if (!visible || phase !== 'spin') return;
    let frame = 0;
    const tick = () => {
      const m = motion.current;
      if (!m.dragging) {
        if (Math.abs(m.velocity) > 0.03) { m.angle += m.velocity; m.velocity *= 0.955; }
        else { const target = Math.round(m.angle / size.step) * size.step; m.angle += (target - m.angle) * 0.14; m.velocity = 0; }
      }
      setAngle(m.angle);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, phase, size.step]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (_, g) => { const m = motion.current; m.dragging = true; m.velocity = 0; m.start = m.angle; m.last = g.dx; m.lastT = Date.now(); },
    onPanResponderMove: (_, g) => {
      const m = motion.current, now = Date.now();
      const turn = (g.dx - m.last) * (180 / (Math.PI * size.r));
      m.angle += turn; m.velocity = turn / Math.max(1, (now - m.lastT) / 16); m.last = g.dx; m.lastT = now;
    },
    onPanResponderRelease: () => { motion.current.dragging = false; },
    onPanResponderTerminate: () => { motion.current.dragging = false; },
  }), [size.r]);

  const position = -angle / size.step;
  const front = Math.round(position);
  const placeOf = (i: number) => i + size.n * Math.round((position - i) / size.n);
  const frontNo = mod(front, deckSize) + 1;

  async function choose(place: number) {
    if (phase !== 'spin') return;
    if (place !== front) { motion.current.angle = -place * size.step; motion.current.velocity = 0; return; }
    setPhase('drawing'); setError('');
    try {
      const result = await drawPetalCard(mod(place, deckSize));
      if (!result?.card) throw new Error('No card');
      setFace(result.card); setChosenNo(mod(result.position, deckSize) + 1); setPhase('chosen');
      Animated.timing(lift, { toValue: 1, duration: 750, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
    } catch { setError(copy.failed); setPhase('spin'); }
  }
  function turnOver() {
    Animated.timing(flip, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
      .start(() => setPhase('revealed'));
  }

  const back = BACKS[today?.back ?? 'lilac'];
  const P = size.r * 4.2, tilt = 0.3;
  const bigW = Math.min(vw * 0.6, vh * 0.34 / 1.55, 260), bigH = bigW * 1.55;
  const showRing = phase === 'spin' || phase === 'drawing';
  const backFace = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const frontFace = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const turn = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] });
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.sky} {...(showRing ? pan.panHandlers : {})}>
      {STARS.map(([x, y, s], i) => <View key={i} pointerEvents="none" style={[styles.star, { left: `${x}%`, top: `${y}%`, width: s, height: s }]} />)}
      <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={onClose} style={styles.close}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      {showRing ? <View pointerEvents="none" style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{copy.no} <Text style={styles.counterValue}>{frontNo}</Text> / {deckSize}</Text>
          <Text style={styles.counterText}>{copy.round} <Text style={styles.counterValue}>{Math.floor((frontNo - 1) / size.n) + 1}</Text> / {Math.ceil(deckSize / size.n)}</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${(frontNo / deckSize) * 100}%` }]} /></View>
      </View> : null}

      {showRing ? <View style={[styles.ringCenter, { top: vh * 0.47 }]}>
        {Array.from({ length: size.n }, (_, i) => {
          const deg = i * size.step + angle, rad = (deg * Math.PI) / 180;
          const z = size.r * Math.cos(rad), x = size.r * Math.sin(rad);
          const s = P / (P - z), facing = (Math.cos(rad) + 1) / 2;
          const place = placeOf(i), isFront = place === front;
          return <Pressable key={i} onPress={() => void choose(place)} accessibilityRole="button"
            accessibilityLabel={`${copy.no} ${mod(place, deckSize) + 1}`}
            style={{ position: 'absolute', left: -size.cw / 2, top: -size.ch / 2, width: size.cw, zIndex: Math.round(facing * 100),
              opacity: 0.3 + 0.7 * facing,
              transform: [{ translateX: x * s }, { translateY: z * tilt * s }, { perspective: 900 }, { rotateY: `${wrap(deg)}deg` }, { scale: s }] }}>
            <Image source={back} style={[{ width: size.cw, height: size.ch, borderRadius: size.cw * 0.07 }, isFront && styles.glow]} />
            <Text style={[styles.no, { fontSize: size.cw * 0.15 }]}>{mod(place, deckSize) + 1}</Text>
          </Pressable>;
        })}
      </View> : null}

      {!showRing ? <Animated.View style={[styles.big, { width: bigW, height: bigH, top: vh * 0.1,
        transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [vh * 0.25, 0] }) },
          { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }, { perspective: 1200 }, { rotateY: turn }] }]}>
        <Animated.Image source={back} style={[styles.bigImage, { opacity: backFace }]} />
        {face && PETAL_CARD_ART[face.id] ? <Animated.Image source={PETAL_CARD_ART[face.id]} style={[styles.bigImage, { opacity: frontFace }]} /> : null}
      </Animated.View> : null}

      {phase === 'drawing' ? <ActivityIndicator style={styles.drawing} color="#E9CF8A" accessibilityLabel={copy.drawing} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {showRing ? <Text pointerEvents="none" style={styles.hint}>{copy.hint}</Text> : null}

      {phase === 'chosen' ? <View style={styles.panel}>
        <Text style={styles.panelTitle}>{copy.chosen(chosenNo)}</Text>
        <Pressable accessibilityRole="button" onPress={turnOver} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{copy.turnOver}</Text>
        </Pressable>
      </View> : null}

      {phase === 'revealed' && face ? <ScrollView style={[styles.reveal, { top: vh * 0.1 + bigH + 12 }]} contentContainerStyle={styles.revealContent}>
        <Text style={styles.kicker}>{copy.today}</Text>
        <Text style={styles.cardName}>{face.name}</Text>
        <Text style={styles.line}>{face.line}</Text>
        <Text style={styles.text}>{face.text}</Text>
        <Text style={styles.disclaimer}>{face.disclaimer}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>{copy.close}</Text>
        </Pressable>
      </ScrollView> : null}
    </View>
  </Modal>;
}

// A fixed scatter of faint stars over the night background.
const STARS: [number, number, number][] = Array.from({ length: 36 }, (_, i) => [((i * 37) % 97) + 1.5, ((i * 53) % 89) + 4, i % 5 === 0 ? 3 : 2]);

const styles = StyleSheet.create({
  sky: { flex: 1, backgroundColor: '#17123A', overflow: 'hidden' },
  star: { position: 'absolute', borderRadius: 2, backgroundColor: '#FFFFFF55' },
  close: { position: 'absolute', top: 44, right: 16, zIndex: 300, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF14' },
  closeText: { fontSize: 26, lineHeight: 30, color: '#F6EDDB' },
  header: { position: 'absolute', top: 40, left: 16, right: 16, alignItems: 'center', zIndex: 200 },
  title: { fontFamily: 'serif', fontSize: 15, letterSpacing: 6, color: '#E9CF8A' },
  sub: { marginTop: 8, fontFamily: 'serif', fontSize: 12, color: '#C9C0E8', textAlign: 'center' },
  counter: { marginTop: 12, flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: '#E9CF8A55', backgroundColor: '#1B154088' },
  counterText: { fontFamily: 'serif', fontSize: 12, color: '#E9CF8A' },
  counterValue: { color: '#FFF3CF' },
  track: { marginTop: 10, width: 240, maxWidth: '70%', height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: '#FFFFFF22' },
  fill: { height: '100%', backgroundColor: '#E9CF8A' },
  ringCenter: { position: 'absolute', left: '50%', width: 0, height: 0 },
  glow: { boxShadow: '0 0 18px 4px #F3DFA8CC', borderWidth: 1.5, borderColor: '#F3DFA8' },
  no: { textAlign: 'center', marginTop: 4, fontFamily: 'serif', color: '#E9CF8A' },
  big: { position: 'absolute', alignSelf: 'center', zIndex: 250 },
  bigImage: { position: 'absolute', width: '100%', height: '100%', borderRadius: 14 },
  drawing: { position: 'absolute', alignSelf: 'center', bottom: 120 },
  error: { position: 'absolute', alignSelf: 'center', bottom: 90, color: '#F4B9C2', fontSize: 13 },
  hint: { position: 'absolute', bottom: 40, alignSelf: 'center', fontFamily: 'serif', fontSize: 12, color: '#9F96C8' },
  panel: { position: 'absolute', left: 20, right: 20, bottom: 36, alignItems: 'center', gap: 14 },
  panelTitle: { fontFamily: 'serif', fontSize: 18, color: '#F3DFA8', textAlign: 'center' },
  primary: { alignSelf: 'stretch', paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: '#E9CF8A' },
  primaryText: { fontFamily: 'serif', fontSize: 16, color: '#2B2457' },
  pressed: { opacity: 0.8 },
  reveal: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  revealContent: { paddingHorizontal: 24, paddingBottom: 30, alignItems: 'center', gap: 8 },
  kicker: { fontFamily: 'serif', fontSize: 12, letterSpacing: 2, color: '#C9C0E8' },
  cardName: { fontFamily: 'serif', fontSize: 22, color: '#F3DFA8', textAlign: 'center' },
  line: { fontFamily: 'serif', fontSize: 17, color: '#F6EDDB', textAlign: 'center' },
  text: { fontFamily: 'serif', fontSize: 14, lineHeight: 22, color: '#D8D0F0', textAlign: 'center' },
  disclaimer: { fontSize: 11, color: '#9F96C8', textAlign: 'center', marginVertical: 4 },
});
