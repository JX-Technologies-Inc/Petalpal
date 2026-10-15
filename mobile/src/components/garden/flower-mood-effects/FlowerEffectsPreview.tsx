import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  DEFAULT_TIMEZONE,
  createDailyFlowerEffect,
  getLocalCalendarDate,
  getNextLocalMidnight,
  getSimulatedTimestamp,
  isFlowerEffectActive,
  type TimeSimulationMode,
} from './dateHelpers';
import { clampEffectConfig } from './effectConfig';
import { FlowerEffectsRenderer } from './FlowerEffectsRenderer';
import { MOOD_PRESETS, resolveMoodPreset } from './moodPresets';
import type { FlowerEffectConfig, MoodCategory } from './types';

export type BackgroundMode = 'checkerboard' | 'garden';
export type ClusterLayoutMode = 'single' | 'two_adjacent';

const COLOR_SWATCHES = [
  { label: 'Champagne', hex: '#FFF3C4' },
  { label: 'Ivory', hex: '#F9E8B0' },
  { label: 'Lavender', hex: '#E7D7FF' },
  { label: 'Rain Blue', hex: '#B9DADF' },
  { label: 'Mist', hex: '#9EBBC3' },
  { label: 'Droplet', hex: '#E1F0F5' },
  { label: 'Warm Glow', hex: '#FFF5D6' },
  { label: 'White', hex: '#FFFFFF' },
];

export function FlowerEffectsPreview() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWide = windowWidth >= 880;

  // 1. Mood State
  const [selectedMood, setSelectedMood] = useState<MoodCategory>('very_positive');

  // 2. Resolved Effect Configurations
  const initialPresets = useMemo(() => resolveMoodPreset('very_positive', { seed: 42 }), []);
  const [primaryConfig, setPrimaryConfig] = useState<FlowerEffectConfig>(initialPresets.primaryEffect);
  const [secondaryConfig, setSecondaryConfig] = useState<FlowerEffectConfig>(initialPresets.secondaryEffect);

  // 3. Visibility Toggles
  const [primaryEnabled, setPrimaryEnabled] = useState(true);
  const [secondaryEnabled, setSecondaryEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // 4. Preview Display Options
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('garden');
  const [clusterMode, setClusterMode] = useState<ClusterLayoutMode>('two_adjacent');
  const [showBoundaryDebug, setShowBoundaryDebug] = useState(false);
  const [showAnchorsDebug, setShowAnchorsDebug] = useState(false);

  // 5. Time & Expiration Simulation
  const todayDate = useMemo(() => getLocalCalendarDate(new Date(), DEFAULT_TIMEZONE), []);
  const [simMode, setSimMode] = useState<TimeSimulationMode>('normal');
  const [historicalReplay, setHistoricalReplay] = useState(false);

  // 6. Animation Clock (seconds)
  const [timeSeconds, setTimeSeconds] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Animation frame loop
  useEffect(() => {
    if (isPaused) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current !== null) {
        const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
        setTimeSeconds((prev) => prev + delta);
      }
      lastTimeRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
    };
  }, [isPaused]);

  // Handle Mood Selection
  const handleMoodSelect = useCallback((category: MoodCategory) => {
    setSelectedMood(category);
    const resolved = resolveMoodPreset(category, { seed: primaryConfig.seed });
    setPrimaryConfig(resolved.primaryEffect);
    setSecondaryConfig(resolved.secondaryEffect);
    setPrimaryEnabled(resolved.primaryEffect.effectType !== 'none');
    setSecondaryEnabled(resolved.secondaryEffect.effectType !== 'none');
  }, [primaryConfig.seed]);

  // Reset to Defaults for current mood
  const handleReset = useCallback(() => {
    const resolved = resolveMoodPreset(selectedMood, { seed: 42 });
    setPrimaryConfig(resolved.primaryEffect);
    setSecondaryConfig(resolved.secondaryEffect);
    setPrimaryEnabled(resolved.primaryEffect.effectType !== 'none');
    setSecondaryEnabled(resolved.secondaryEffect.effectType !== 'none');
  }, [selectedMood]);

  // Simulated Time & Expiration Verification
  const simulatedTimeIso = useMemo(
    () => getSimulatedTimestamp(todayDate, simMode, DEFAULT_TIMEZONE),
    [todayDate, simMode]
  );

  const dailyEffectRecord = useMemo(
    () => createDailyFlowerEffect('cluster-preview-1', todayDate, primaryConfig, secondaryConfig),
    [todayDate, primaryConfig, secondaryConfig]
  );

  const isActive = useMemo(
    () => isFlowerEffectActive(dailyEffectRecord, simulatedTimeIso, { historicalReplay }),
    [dailyEffectRecord, simulatedTimeIso, historicalReplay]
  );

  // Active configs passed to renderer (respecting enable toggles)
  const activePrimary = useMemo(
    () => (primaryEnabled ? primaryConfig : { ...primaryConfig, effectType: 'none' as const }),
    [primaryEnabled, primaryConfig]
  );

  const activeSecondary = useMemo(
    () => (secondaryEnabled ? secondaryConfig : { ...secondaryConfig, effectType: 'none' as const }),
    [secondaryEnabled, secondaryConfig]
  );

  // Neutral empty config for adjacent comparison cluster
  const emptyAdjacentConfig = useMemo(
    () => ({ ...primaryConfig, effectType: 'none' as const }),
    [primaryConfig]
  );

  // Slider update helper
  const updatePrimary = useCallback((patch: Partial<FlowerEffectConfig>) => {
    setPrimaryConfig((prev) => clampEffectConfig({ ...prev, ...patch }));
  }, []);

  // Canvas Geometry
  const canvasWidth = isWide ? Math.max(480, windowWidth - 420) : windowWidth;
  const canvasHeight = isWide ? windowHeight - 40 : 360;

  const cluster1X = clusterMode === 'two_adjacent' ? canvasWidth * 0.36 : canvasWidth * 0.5;
  const cluster2X = canvasWidth * 0.68;
  const clusterY = canvasHeight * 0.58;

  return (
    <View style={[styles.root, isWide ? styles.rootRow : styles.rootCol]}>
      {/* ── Left / Canvas Preview Area ── */}
      <View style={[styles.canvasWrapper, { width: canvasWidth, height: canvasHeight }]}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          {/* Background: Checkerboard or Garden Soil/Grass */}
          {backgroundMode === 'checkerboard' ? (
            <Group>
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#E8ECE9" />
              {Array.from({ length: Math.ceil(canvasWidth / 24) }).map((_, col) =>
                Array.from({ length: Math.ceil(canvasHeight / 24) }).map((_, row) =>
                  (col + row) % 2 === 0 ? (
                    <Rect
                      key={`${col}-${row}`}
                      x={col * 24}
                      y={row * 24}
                      width={24}
                      height={24}
                      color="#F4F6F4"
                    />
                  ) : null
                )
              )}
            </Group>
          ) : (
            <Group>
              {/* Soft Garden Meadow Tone */}
              <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color="#3F614C" />
              {/* Ground patch vignette */}
              <Rect x={0} y={clusterY - 12} width={canvasWidth} height={canvasHeight - clusterY + 12} color="#355240" />
            </Group>
          )}

          {/* Cluster 1: Target Flower Cluster with active Mood Effects */}
          <FlowerEffectsRenderer
            worldX={cluster1X}
            worldY={clusterY}
            primaryEffect={activePrimary}
            secondaryEffect={activeSecondary}
            timeSeconds={timeSeconds}
            isActive={isActive}
            renderFlower={true}
            showBoundaryDebug={showBoundaryDebug}
            showAnchorsDebug={showAnchorsDebug}
          />

          {/* Cluster 2: Adjacent Flower Cluster (demonstrating zero spillover) */}
          {clusterMode === 'two_adjacent' && (
            <FlowerEffectsRenderer
              worldX={cluster2X}
              worldY={clusterY}
              primaryEffect={emptyAdjacentConfig}
              timeSeconds={timeSeconds}
              isActive={true}
              renderFlower={true}
              showBoundaryDebug={showBoundaryDebug}
              showAnchorsDebug={false}
            />
          )}
        </Canvas>

        {/* HUD Overlay */}
        <View style={styles.hudOverlay} pointerEvents="none">
          <View style={styles.hudRow}>
            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusExpired]}>
              <Text style={styles.statusText}>
                {isActive ? '● EFFECT ACTIVE' : '○ EXPIRED (END OF DAY)'}
              </Text>
            </View>
            {historicalReplay && (
              <View style={[styles.statusBadge, styles.statusReplay]}>
                <Text style={styles.statusText}>HISTORICAL REPLAY</Text>
              </View>
            )}
          </View>
          {clusterMode === 'two_adjacent' && (
            <View style={styles.clusterLabelsRow}>
              <Text style={[styles.clusterLabel, { left: cluster1X - 70 }]}>
                [ Target Cluster: {primaryConfig.effectType} ]
              </Text>
              <Text style={[styles.clusterLabel, { left: cluster2X - 60 }]}>
                [ Neighbor: 100% Isolated ]
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Right / Bottom Control Panel ── */}
      <ScrollView
        style={[styles.controlsPanel, isWide ? styles.controlsSide : styles.controlsBottom]}
        contentContainerStyle={styles.controlsContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Flower Mood Effects Lab</Text>
          <Text style={styles.panelSubtitle}>
            Interactive visual effect design & tuning for daily mood flower clusters
          </Text>
        </View>

        {/* 1. Mood Presets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Daily Mood Preset</Text>
          <View style={styles.buttonRow}>
            {(Object.keys(MOOD_PRESETS) as MoodCategory[]).map((category) => {
              const preset = MOOD_PRESETS[category];
              const isSelected = selectedMood === category;
              return (
                <Pressable
                  key={category}
                  style={[styles.chipButton, isSelected && styles.chipButtonSelected]}
                  onPress={() => handleMoodSelect(category)}
                >
                  <Text style={[styles.chipButtonText, isSelected && styles.chipButtonTextSelected]}>
                    {preset.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.presetDesc}>{MOOD_PRESETS[selectedMood].description}</Text>
        </View>

        {/* 2. Effect Visibility & Playback */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Visibility & Animation</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.toggleButton, primaryEnabled && styles.toggleButtonActive]}
              onPress={() => setPrimaryEnabled(!primaryEnabled)}
            >
              <Text style={[styles.toggleButtonText, primaryEnabled && styles.toggleButtonTextActive]}>
                Primary: {primaryConfig.effectType} ({primaryEnabled ? 'ON' : 'OFF'})
              </Text>
            </Pressable>

            {secondaryConfig.effectType !== 'none' && (
              <Pressable
                style={[styles.toggleButton, secondaryEnabled && styles.toggleButtonActive]}
                onPress={() => setSecondaryEnabled(!secondaryEnabled)}
              >
                <Text style={[styles.toggleButtonText, secondaryEnabled && styles.toggleButtonTextActive]}>
                  Secondary: {secondaryConfig.effectType} ({secondaryEnabled ? 'ON' : 'OFF'})
                </Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.toggleButton, isPaused && styles.toggleButtonActive]}
              onPress={() => setIsPaused(!isPaused)}
            >
              <Text style={[styles.toggleButtonText, isPaused && styles.toggleButtonTextActive]}>
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </Text>
            </Pressable>

            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset Preset</Text>
            </Pressable>
          </View>
        </View>

        {/* 3. Preview Environment Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Preview Mode & Isolation</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.chipButton, clusterMode === 'single' && styles.chipButtonSelected]}
              onPress={() => setClusterMode('single')}
            >
              <Text style={[styles.chipButtonText, clusterMode === 'single' && styles.chipButtonTextSelected]}>
                Single Cluster
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chipButton, clusterMode === 'two_adjacent' && styles.chipButtonSelected]}
              onPress={() => setClusterMode('two_adjacent')}
            >
              <Text style={[styles.chipButtonText, clusterMode === 'two_adjacent' && styles.chipButtonTextSelected]}>
                Two Adjacent Clusters
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chipButton, backgroundMode === 'garden' && styles.chipButtonSelected]}
              onPress={() => setBackgroundMode('garden')}
            >
              <Text style={[styles.chipButtonText, backgroundMode === 'garden' && styles.chipButtonTextSelected]}>
                Garden Ground
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chipButton, backgroundMode === 'checkerboard' && styles.chipButtonSelected]}
              onPress={() => setBackgroundMode('checkerboard')}
            >
              <Text style={[styles.chipButtonText, backgroundMode === 'checkerboard' && styles.chipButtonTextSelected]}>
                Checkerboard
              </Text>
            </Pressable>
          </View>

          <View style={[styles.buttonRow, { marginTop: 6 }]}>
            <Pressable
              style={[styles.toggleButton, showBoundaryDebug && styles.toggleButtonActive]}
              onPress={() => setShowBoundaryDebug(!showBoundaryDebug)}
            >
              <Text style={[styles.toggleButtonText, showBoundaryDebug && styles.toggleButtonTextActive]}>
                Boundary Debug ({showBoundaryDebug ? 'ON' : 'OFF'})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, showAnchorsDebug && styles.toggleButtonActive]}
              onPress={() => setShowAnchorsDebug(!showAnchorsDebug)}
            >
              <Text style={[styles.toggleButtonText, showAnchorsDebug && styles.toggleButtonTextActive]}>
                Petal Anchors ({showAnchorsDebug ? 'ON' : 'OFF'})
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 4. Daily Expiration & Timezone Simulation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Daily Expiration Simulation ({DEFAULT_TIMEZONE})</Text>
          <Text style={styles.metaNote}>
            Date: {todayDate} · Next Local Midnight: {getNextLocalMidnight(todayDate, DEFAULT_TIMEZONE).slice(11, 19)} UTC
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.chipButton, simMode === 'normal' && styles.chipButtonSelected]}
              onPress={() => setSimMode('normal')}
            >
              <Text style={[styles.chipButtonText, simMode === 'normal' && styles.chipButtonTextSelected]}>
                Daytime (Active)
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chipButton, simMode === 'before_midnight' && styles.chipButtonSelected]}
              onPress={() => setSimMode('before_midnight')}
            >
              <Text style={[styles.chipButtonText, simMode === 'before_midnight' && styles.chipButtonTextSelected]}>
                23:59:50 (Active)
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chipButton, simMode === 'after_midnight' && styles.chipButtonSelected]}
              onPress={() => setSimMode('after_midnight')}
            >
              <Text style={[styles.chipButtonText, simMode === 'after_midnight' && styles.chipButtonTextSelected]}>
                00:00:10 (Expired)
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleButton, historicalReplay && styles.toggleButtonActive]}
              onPress={() => setHistoricalReplay(!historicalReplay)}
            >
              <Text style={[styles.toggleButtonText, historicalReplay && styles.toggleButtonTextActive]}>
                Historical Replay ({historicalReplay ? 'ON' : 'OFF'})
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 5. Visual Tuning Sliders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Effect Parameters Tuning ({primaryConfig.effectType})</Text>

          <SliderRow
            label="Intensity"
            value={primaryConfig.intensity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updatePrimary({ intensity: v })}
          />
          <SliderRow
            label="Density"
            value={primaryConfig.density}
            min={0.1}
            max={2}
            step={0.1}
            onChange={(v) => updatePrimary({ density: v })}
          />
          <SliderRow
            label="Opacity"
            value={primaryConfig.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updatePrimary({ opacity: v })}
          />
          <SliderRow
            label="Animation Speed"
            value={primaryConfig.animationSpeed}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(v) => updatePrimary({ animationSpeed: v })}
          />
          <SliderRow
            label="Scale"
            value={primaryConfig.scale}
            min={0.2}
            max={2.5}
            step={0.05}
            onChange={(v) => updatePrimary({ scale: v })}
          />
          <SliderRow
            label="Effect Radius"
            value={primaryConfig.effectRadius}
            min={10}
            max={120}
            step={2}
            unit="px"
            onChange={(v) => updatePrimary({ effectRadius: v })}
          />
          <SliderRow
            label="Effect Height"
            value={primaryConfig.effectHeight}
            min={10}
            max={160}
            step={2}
            unit="px"
            onChange={(v) => updatePrimary({ effectHeight: v })}
          />
          <SliderRow
            label="Particle Count"
            value={primaryConfig.particleCount}
            min={0}
            max={60}
            step={1}
            onChange={(v) => updatePrimary({ particleCount: v })}
          />
          <SliderRow
            label="Spawn Interval"
            value={primaryConfig.spawnInterval}
            min={50}
            max={2000}
            step={50}
            unit="ms"
            onChange={(v) => updatePrimary({ spawnInterval: v })}
          />
          <SliderRow
            label="Particle Lifetime"
            value={primaryConfig.particleLifetime}
            min={300}
            max={6000}
            step={100}
            unit="ms"
            onChange={(v) => updatePrimary({ particleLifetime: v })}
          />
          <SliderRow
            label="Randomness"
            value={primaryConfig.randomness}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updatePrimary({ randomness: v })}
          />
        </View>

        {/* 6. Color & Seed Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Colors & Deterministic Seed</Text>

          <View style={styles.colorRow}>
            <Text style={styles.fieldLabel}>Primary Color:</Text>
            <TextInput
              style={styles.colorInput}
              value={primaryConfig.color}
              onChangeText={(text) => updatePrimary({ color: text })}
            />
            <View style={[styles.colorPreview, { backgroundColor: primaryConfig.color }]} />
          </View>

          <View style={styles.swatchesRow}>
            {COLOR_SWATCHES.map((swatch) => (
              <Pressable
                key={swatch.hex}
                style={[styles.swatchDot, { backgroundColor: swatch.hex }]}
                onPress={() => updatePrimary({ color: swatch.hex })}
              />
            ))}
          </View>

          <View style={[styles.colorRow, { marginTop: 8 }]}>
            <Text style={styles.fieldLabel}>Secondary Color:</Text>
            <TextInput
              style={styles.colorInput}
              value={primaryConfig.secondaryColor || ''}
              onChangeText={(text) => updatePrimary({ secondaryColor: text })}
            />
            <View
              style={[
                styles.colorPreview,
                { backgroundColor: primaryConfig.secondaryColor || '#transparent' },
              ]}
            />
          </View>

          <View style={[styles.buttonRow, { marginTop: 10 }]}>
            <Text style={styles.fieldLabel}>Seed: {primaryConfig.seed}</Text>
            <Pressable
              style={styles.chipButton}
              onPress={() => updatePrimary({ seed: Math.floor(Math.random() * 99999) + 1 })}
            >
              <Text style={styles.chipButtonText}>🎲 New Seed</Text>
            </Pressable>
            <Pressable style={styles.chipButton} onPress={() => updatePrimary({ seed: 42 })}>
              <Text style={styles.chipButtonText}>Reset Seed (42)</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Lightweight Slider / Stepper Component */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}) {
  const displayVal = Number.isInteger(step) ? String(Math.round(value)) : value.toFixed(2);

  const dec = () => onChange(Math.max(min, Math.round((value - step) * 100) / 100));
  const inc = () => onChange(Math.min(max, Math.round((value + step) * 100) / 100));

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>
        {label}: <Text style={styles.sliderValue}>{displayVal}{unit}</Text>
      </Text>
      <View style={styles.stepperGroup}>
        <Pressable style={styles.stepBtn} onPress={dec}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={inc}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1C2620',
  },
  rootRow: {
    flexDirection: 'row',
  },
  rootCol: {
    flexDirection: 'column',
  },
  canvasWrapper: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#26382D',
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    justifyContent: 'space-between',
  },
  hudRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: 'rgba(38, 92, 60, 0.85)',
    borderColor: '#73B68E',
  },
  statusExpired: {
    backgroundColor: 'rgba(92, 40, 40, 0.85)',
    borderColor: '#D47E7E',
  },
  statusReplay: {
    backgroundColor: 'rgba(50, 75, 115, 0.85)',
    borderColor: '#8AAEE0',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clusterLabelsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    height: 24,
  },
  clusterLabel: {
    position: 'absolute',
    bottom: 0,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    backgroundColor: 'rgba(20, 30, 24, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  controlsPanel: {
    backgroundColor: '#223028',
  },
  controlsSide: {
    flex: 1,
    maxWidth: 440,
    borderLeftWidth: 1,
    borderColor: '#2F4238',
  },
  controlsBottom: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: '#2F4238',
  },
  controlsContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  panelHeader: {
    gap: 4,
    borderBottomWidth: 1,
    borderColor: '#2F4238',
    paddingBottom: 10,
  },
  panelTitle: {
    color: '#E8F2EC',
    fontSize: 18,
    fontWeight: '700',
  },
  panelSubtitle: {
    color: '#9EBAA9',
    fontSize: 12,
  },
  section: {
    gap: 8,
    backgroundColor: '#283930',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#344A3F',
  },
  sectionTitle: {
    color: '#D2E3D8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetDesc: {
    color: '#B5CFBF',
    fontSize: 11,
    fontStyle: 'italic',
  },
  metaNote: {
    color: '#9AB3A3',
    fontSize: 11,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  chipButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#344B3F',
    borderWidth: 1,
    borderColor: '#435E50',
  },
  chipButtonSelected: {
    backgroundColor: '#4A7C59',
    borderColor: '#86B594',
  },
  chipButtonText: {
    color: '#D9E8DF',
    fontSize: 12,
    fontWeight: '500',
  },
  chipButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#2F4036',
    borderWidth: 1,
    borderColor: '#3D5246',
  },
  toggleButtonActive: {
    backgroundColor: '#3A684C',
    borderColor: '#6BA681',
  },
  toggleButtonText: {
    color: '#A2B8AA',
    fontSize: 12,
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#443A3A',
    borderWidth: 1,
    borderColor: '#665454',
  },
  resetButtonText: {
    color: '#E8C0C0',
    fontSize: 11,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  sliderLabel: {
    color: '#C5D6CC',
    fontSize: 12,
  },
  sliderValue: {
    color: '#80D8A5',
    fontWeight: '700',
  },
  stepperGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#3B5245',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4D6859',
  },
  stepBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    color: '#B5C8BD',
    fontSize: 12,
  },
  colorInput: {
    flex: 1,
    height: 28,
    backgroundColor: '#1E2B23',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374C3F',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  colorPreview: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#547260',
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  swatchDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});

export default FlowerEffectsPreview;
