import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { ClosenessSummary } from '../../services/fairyCloseness';

const HEART = require('@/assets/fairy-entry/bond-heart.webp');
const BOOK = require('@/assets/fairy-entry/moments-book.webp');

const COPY = {
  en: { heading: 'A little world, just for the two of you.', close: 'Close', bond: 'Our Bond', checkIn: ', check in today',
    moments: 'Fairy Moments', newMoments: ', new posts',
    bondSoon: (s: ClosenessSummary | null) => s ? `Lv ${s.level} · ${s.title}. The full Our Bond page is coming soon.` : 'Our Bond is coming soon.' },
  'zh-Hans': { heading: '这里，有属于我们的一片小小的世界。', close: '关闭', bond: '亲密度', checkIn: '，今天还没签到',
    moments: '朋友圈', newMoments: '，有新动态',
    bondSoon: (s: ClosenessSummary | null) => s ? `Lv ${s.level} · ${s.title}。完整的亲密度页面马上就来。` : '亲密度页面马上就来。' },
};

// What the Fairy icon opens: her two rooms, closeness (Our Bond · 亲密度) and her Moments
// (Fairy Moments · 朋友圈). Each shows a dot when something waits: today's check-in, new posts.
// Labels are English; zh-Hans owners also see the Chinese name underneath.
export function FairyEntryCard({ visible, locale, closeness, closenessOn, momentsOn, momentsUnread, onOpenMoments, onOpenBond, onClose }: {
  visible: boolean; locale: 'en' | 'zh-Hans';
  closeness: ClosenessSummary | null; closenessOn: boolean; momentsOn: boolean; momentsUnread: boolean;
  onOpenMoments: () => void; onOpenBond?: () => void; onClose: () => void;
}) {
  const copy = COPY[locale];
  const [note, setNote] = useState('');
  const bondDot = Boolean(closeness && !closeness.checkIn.checkedInToday);
  const close = () => { setNote(''); onClose(); };
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
    <Pressable accessibilityLabel={copy.close} onPress={close} style={styles.backdrop}>
      <Pressable accessibilityViewIsModal onPress={() => undefined} style={styles.frame}>
        {/* English leads; Chinese is the quieter second line, only for zh-Hans owners. */}
        <Text style={styles.heading}>{COPY.en.heading}</Text>
        {locale === 'zh-Hans' ? <Text style={styles.subheading}>{COPY['zh-Hans'].heading}</Text> : null}
        <View style={styles.row}>
          {closenessOn ? <Tile image={HEART} en="Our Bond" zh={locale === 'zh-Hans' ? '亲密度' : undefined} dot={bondDot}
            label={copy.bond + (bondDot ? copy.checkIn : '')}
            onPress={() => { if (onOpenBond) onOpenBond(); else setNote(copy.bondSoon(closeness)); }} /> : null}
          {momentsOn ? <Tile image={BOOK} en="Fairy Moments" zh={locale === 'zh-Hans' ? '朋友圈' : undefined} dot={momentsUnread}
            label={copy.moments + (momentsUnread ? copy.newMoments : '')} onPress={() => { setNote(''); onOpenMoments(); }} /> : null}
        </View>
        {note ? <Text accessibilityLiveRegion="polite" style={styles.note}>{note}</Text> : null}
      </Pressable>
    </Pressable>
  </Modal>;
}

function Tile({ image, en, zh, dot, label, onPress }: {
  image: ImageSourcePropType; en: string; zh?: string; dot: boolean; label: string; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
    <Image source={image} style={styles.art} resizeMode="contain" accessibilityIgnoresInvertColors />
    <View style={styles.labelRow}>
      <Text style={styles.spark}>✦</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.en}>{en}</Text><Text style={styles.spark}>✦</Text>
    </View>
    {zh ? <Text style={styles.zh}>{zh}</Text> : null}
    {dot ? <View style={styles.dot} /> : null}
  </Pressable>;
}

const GOLD = '#C9A55C', INK = '#2E5A4A';
const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#00000040' },
  frame: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 14, paddingTop: 16, gap: 12,
    backgroundColor: '#123D37', borderWidth: 2, borderColor: GOLD },
  heading: { fontFamily: 'serif', fontSize: 16, lineHeight: 23, color: '#F3EBD3', textAlign: 'center' },
  subheading: { fontFamily: 'serif', fontSize: 12, color: '#D8CDA9', textAlign: 'center', marginTop: -8 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  tile: { flex: 1, maxWidth: 190, aspectRatio: 0.92, borderRadius: 18, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 10,
    alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#F7F0E3', borderWidth: 2, borderColor: '#D8C38A' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  art: { flex: 1, width: '100%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  spark: { fontSize: 10, color: GOLD },
  en: { fontFamily: 'serif', fontSize: 19, lineHeight: 25, color: INK, flexShrink: 1 },
  zh: { fontFamily: 'serif', fontSize: 13, color: INK },
  dot: { position: 'absolute', top: 8, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: '#E2554B', borderWidth: 2, borderColor: '#FBE3D6' },
  note: { fontFamily: 'serif', fontSize: 13, lineHeight: 19, color: '#F3EBD3', textAlign: 'center' },
});
