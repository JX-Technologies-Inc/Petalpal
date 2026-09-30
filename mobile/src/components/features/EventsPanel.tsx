import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEventJournal } from '../../hooks/useEventJournal';
import { emotionMessage, memoryMessage, PRIMARY_MOODS } from '../../services/events';
import { sourceFlowerImageUri } from '../garden/planting/flowerDetailApi';
import { FEATURE_COLORS as colors, FeatureActionButton, FeatureSection, ui } from './FeatureUI';

export function EventsPanel({ onClose, onGardenChanged }: { onClose: () => void; onGardenChanged?: () => void }) {
  const journal = useEventJournal(onGardenChanged);
  return <View style={ui.body}>
    <Text style={ui.text}>A little moment, a new flower. Your Primary Mood is always your choice.</Text>
    <FeatureSection title="What happened?">
      <TextInput accessibilityLabel="Event" placeholder="A small moment from today…" placeholderTextColor={colors.muted}
        multiline maxLength={4000} value={journal.content} editable={!journal.busy}
        onChangeText={journal.setContent} style={styles.input} />
      <Text style={ui.caption}>{journal.content.length} / 4000</Text>
      <Text style={ui.sectionTitle}>Choose your Primary Mood</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Primary Mood" style={styles.moods}>
        {PRIMARY_MOODS.map(mood => {
          const selected = journal.mood === mood;
          const label = mood.replace('_BLOOM', '').toLowerCase();
          return <Pressable key={mood} accessibilityRole="radio" accessibilityLabel={label}
            accessibilityState={{ checked: selected, selected, disabled: journal.busy }} disabled={journal.busy}
            onPress={() => journal.setMood(mood)} style={[styles.mood, selected && styles.selected]}>
            <Text style={styles.moodText}>{label}</Text>
          </Pressable>;
        })}
      </View>
      <FeatureActionButton title={journal.busy ? 'Saving Event…' : 'Save Event'} onPress={() => void journal.saveEvent()}
        disabled={journal.busy || !journal.content.trim() || !journal.mood} />
      <Text style={ui.caption}>Emotion and memory processing follow your existing account consent.</Text>
    </FeatureSection>
    {journal.result ? <FeatureSection title="Your Event is saved">
      <Text style={ui.text}>{emotionMessage(journal.result.event.emotionStatus)}</Text>
      <Text style={ui.caption}>Secondary emotions: {journal.result.event.secondaryEmotions.join(', ') || 'None'}</Text>
      <Text style={ui.caption}>{memoryMessage(journal.result.memoryJob)}</Text>
      {journal.pollError ? <Text accessibilityRole="alert" style={ui.text}>{journal.pollError}</Text> : null}
      <FeatureActionButton secondary title="Refresh Event status" onPress={() => void journal.refreshEventStatus()} />
    </FeatureSection> : null}
    {journal.error ? <View style={ui.notice}><Text accessibilityRole="alert" style={ui.text}>{journal.error}</Text></View> : null}
    <View style={ui.row}>
      <Text style={[ui.sectionTitle, { flex: 1 }]}>Your flowers · {journal.flowers.length}</Text>
      {journal.loading ? <ActivityIndicator accessibilityLabel="Loading Event flowers" color={colors.primary} /> : null}
    </View>
    {!journal.loading && !journal.flowers.length ? <View style={ui.notice}>
      <Text style={ui.sectionTitle}>Your next bloom starts here</Text>
      <Text style={ui.text}>Save an Event to grow a flower in your Garden.</Text>
    </View> : null}
    {journal.flowers.map(flower => {
      const placed = journal.placements.some(item => item.flowerId === flower.id);
      const imageUri = sourceFlowerImageUri(flower.img);
      return <FeatureSection key={flower.id}>
        <View style={ui.row}>
          {imageUri
            ? <Image accessibilityLabel={flower.name} source={{ uri: imageUri }} style={styles.flowerImage} resizeMode="contain" />
            : <Text accessibilityLabel={flower.name} style={[styles.flowerImage, styles.flowerEmoji]}>{flower.img}</Text>}
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={ui.sectionTitle}>{flower.name}</Text>
            <Text style={ui.caption}>{flower.mood.replace('_BLOOM', '').toLowerCase()} · Primary Mood</Text>
          </View>
        </View>
        {flower.event ? <Text style={ui.text}>{flower.event}</Text> : null}
        <Text style={ui.caption}>Secondary emotions: {flower.sourceEvent?.secondaryEmotions.join(', ') || 'None'}</Text>
        <FeatureActionButton secondary title={placed ? 'Adjust position' : 'Plant flower'} onPress={() => {
          onClose(); journal.placeFlower(flower);
        }} />
      </FeatureSection>;
    })}
    <FeatureActionButton secondary title="Refresh flowers" onPress={() => void journal.refresh()} disabled={journal.loading} />
    <Text style={ui.caption}>Events stay with your account. Garden positions stay on this device.</Text>
  </View>;
}
const styles = StyleSheet.create({
  input: { minHeight: 100, padding: 13, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1,
    borderColor: colors.line, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top' },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mood: { paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, justifyContent: 'center',
    borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.tealWash },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', color: colors.ink },
  flowerImage: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.tealWash },
  flowerEmoji: { fontSize: 42, lineHeight: 64, textAlign: 'center' },
});
