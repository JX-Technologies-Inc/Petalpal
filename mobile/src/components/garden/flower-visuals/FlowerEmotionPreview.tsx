import { Pressable, Text, View } from 'react-native';
import { FLOWER_CATALOG, resolveFlowerVisual } from './flowerVisualResolver';
import { COMPOSITIONS, PRIMARY_BLOOMS, SECONDARY_EMOTIONS, type PrimaryBloomCode,
  type SecondaryEmotion, type Composition } from './flowerVisualTypes';
import { GARDEN_ART_BINDINGS } from './gardenArtBindings.generated';
export interface PreviewSettings {
  primaryBloom: PrimaryBloomCode; speciesCode: string; composition: Composition | 'auto';
  main: SecondaryEmotion | ''; accent: SecondaryEmotion | ''; selected: boolean;
  anchorOffsetX: number; anchorOffsetY: number; scaleMultiplier: number;
}
export const DEFAULT_PREVIEW: PreviewSettings = { primaryBloom: 'SUNNY_BLOOM', speciesCode: 'TULIP',
  composition: 'auto', main: '', accent: '', selected: false,
  anchorOffsetX: 0, anchorOffsetY: 0, scaleMultiplier: 1 };
export function previewVisual(settings: PreviewSettings, id: string) {
  return resolveFlowerVisual({ flowerId: id, primaryBloom: settings.primaryBloom, speciesCode: settings.speciesCode,
    secondaryEmotions: settings.main ? (settings.accent ? [settings.main, settings.accent] : [settings.main]) : [] },
  { devPreview: true, composition: settings.composition === 'auto' ? undefined : settings.composition,
    state: settings.selected ? 'SELECTED' : 'OVERVIEW' });
}
function Choice({ value, selected, onPress }: { value: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={{ padding: 8, borderRadius: 5, backgroundColor: selected ? '#365b42' : '#edf2e7' }}>
    <Text style={{ color: selected ? '#fff' : '#365b42', fontSize: 11 }}>{value}</Text>
  </Pressable>;
}
export function FlowerEmotionPreview({ settings, onChange, firstId, baseArtOnly = false, sandboxRadius, compositionScales }: {
  settings: PreviewSettings; onChange: (value: PreviewSettings) => void; firstId: string;
  baseArtOnly?: boolean; sandboxRadius?: number;
  compositionScales?: Record<Composition, number>;
}) {
  if (!__DEV__) return null;
  const v = previewVisual(settings, firstId);
  const set = (patch: Partial<PreviewSettings>) => onChange({ ...settings, ...patch });
  const choices = <T extends string,>(label: string, values: readonly T[], selected: string, select: (value: T) => void) =>
    <View style={{ gap: 5 }}><Text>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {values.map(value => <Choice key={value} value={value || 'None'} selected={selected === value} onPress={() => select(value)} />)}
    </View></View>;
  const binding = v.gardenAsset && GARDEN_ART_BINDINGS[v.gardenAsset.asset];
  return <View style={{ gap: 10 }}>
    <Text style={{ fontWeight: '700' }}>{baseArtOnly ? 'Garden base art review' : 'Garden art / Emotion Preview'}</Text>
    <Text>Brown rings are DEV missing-art markers. They are not flowers. No LLM or saved data is used.</Text>
    {choices('Primary Bloom', PRIMARY_BLOOMS, settings.primaryBloom, primaryBloom => set({ primaryBloom }))}
    {choices('Species (canonical family mapping unresolved)', FLOWER_CATALOG.map(s => s.speciesCode), settings.speciesCode,
      speciesCode => set({ speciesCode, anchorOffsetX: 0, anchorOffsetY: 0, scaleMultiplier: 1 }))}
    {choices('Composition', ['auto', ...COMPOSITIONS], settings.composition, composition => set({ composition: composition as PreviewSettings['composition'] }))}
    {baseArtOnly && <Text>BASE ART REVIEW · Secondary #1 NONE · Secondary #2 NONE · Emotion effects OFF. Sandbox footprint radius: {sandboxRadius} world px.</Text>}
    {!baseArtOnly && choices('Secondary #1 — main', ['', ...SECONDARY_EMOTIONS], settings.main, main => set({ main: main as PreviewSettings['main'], ...(!main || main === settings.accent ? { accent: '' as const } : {}) }))}
    {!baseArtOnly && settings.main && choices('Secondary #2 — accent', ['', ...SECONDARY_EMOTIONS.filter(e => e !== settings.main)], settings.accent,
      accent => set({ accent: accent as PreviewSettings['accent'] }))}
    {!baseArtOnly && <Choice value={settings.selected ? 'First flower SELECTED · STANDARD' : 'All flowers OVERVIEW · SUBTLE'} selected={settings.selected}
      onPress={() => set({ selected: !settings.selected })} />}
    <Text selectable>{`Primary: ${v.primaryBloom}\nSpecies: ${v.speciesCode}\nComposition (first): ${v.compositionVariant}\nSecondary #1: ${v.secondaryEmotions[0] ?? 'none'}\nSecondary #2: ${v.secondaryEmotions[1] ?? 'none'}\nColor Accent: ${v.colorAccent}\nBackend visualEffect: ${v.backendVisualEffect}\nAccent token: ${v.visualEffect}\nPrimitive: ${v.accentEffect}\nArt status: ${v.gardenAsset?.status ?? 'MISSING'}\nBundled: ${binding ? 'yes' : 'no'}\nFootprint: ${v.footprintRadius} world px (existing production config)\nPosture: ${v.mainEmotionStyle.postureIntent} (not applied without dedicated support)\n${v.issues.join('\n')}`}</Text>
    {!baseArtOnly && <Text>Static effects only. Pulse, tremble and flash motion are reserved for a future shared clock. Three PNGs per species; no emotion PNGs.</Text>}
    <Text>{baseArtOnly ? 'Only visualScale is adjustable during base-art review. Ground anchors use the candidate manifest; collision radius remains unchanged.' : 'Temporary visual tuning — copy reviewed values to the manifest; never adjust collision radius to fit PNG bounds.'}</Text>
    {compositionScales && <Text selectable>{COMPOSITIONS.map(composition => {
      const asset = v.species?.gardenAssets[composition];
      return `${composition.toUpperCase()} visualScale: ${((asset?.visualScale ?? 1) * settings.scaleMultiplier * compositionScales[composition]).toFixed(4)}`;
    }).join('\n')}</Text>}
    {((baseArtOnly ? ['scaleMultiplier'] : ['anchorOffsetX', 'anchorOffsetY', 'scaleMultiplier']) as (keyof Pick<PreviewSettings, 'anchorOffsetX' | 'anchorOffsetY' | 'scaleMultiplier'>)[]).map(key => <View key={key} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      <Text>{key}: {settings[key].toFixed(2)}</Text>
      {[-1, 1].map(direction => <Choice key={direction} value={direction < 0 ? '−' : '+'} selected={false} onPress={() => {
        const step = key === 'scaleMultiplier' ? .05 : .01;
        set({ [key]: Math.max(key === 'scaleMultiplier' ? .2 : -.8, Math.min(key === 'scaleMultiplier' ? 3 : .8, settings[key] + direction * step)) });
      }} />)}
    </View>)}
    <Text>{v.gardenAsset ? `Tuned anchor: ${Math.max(0, Math.min(1, v.gardenAsset.anchorX + settings.anchorOffsetX)).toFixed(6)}, ${Math.max(0, Math.min(1, v.gardenAsset.anchorY + settings.anchorOffsetY)).toFixed(6)}; scale: ${(v.gardenAsset.visualScale * settings.scaleMultiplier * (compositionScales?.[v.compositionVariant] ?? 1)).toFixed(4)}` : ''}</Text>
    <Choice value="Reset temporary visual tuning" selected={false} onPress={() => set({ anchorOffsetX: 0, anchorOffsetY: 0, scaleMultiplier: 1 })} />
  </View>;
}
