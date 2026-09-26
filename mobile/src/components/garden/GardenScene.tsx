import { Canvas, Circle, Group, Image, Path, Rect, useImage } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PlantingRegionOverlay from './planting/PlantingRegionOverlay';
import PlantingRegionCalibrationEditor, {
  type CalDisplayMode,
  type CalDragMode,
} from './planting/PlantingRegionCalibrationEditor';
import ManualMaskPaintEditor, {
  type PaintInteractionMode,
} from './planting/ManualMaskPaintEditor';
import {
  type MonthRegionCalibration,
  PLANTING_REGION_CALIBRATION,
  getCalibratedCentroid,
  getParentLand,
  loadCalibrationFromStorage,
  resetCalibrationStorage,
  saveCalibrationToStorage,
  worldToLandLocal,
} from './planting/plantingRegionCalibration';
import {
  type MaskStroke,
  type MaskTool,
  createMaskStroke,
  loadMonthMaskRefinement,
  resetMonthMaskRefinement,
  saveMonthMaskRefinement,
} from './planting/plantingMaskRefinement';
import PlantedFlowerLayer from './planting/PlantedFlowerLayer';
import PlantingPlacementControls from './planting/PlantingPlacementControls';
import FlowerDetailModal from './planting/FlowerDetailModal';
import {
  PlantingProvider,
  usePlanting,
} from './planting/PlantingContext';
import { getFlowerPlacementDefinition } from './planting/flowerFootprintConfig';
import { MONTH_CENTROIDS } from './planting/plantingRegionData';
import { FlowerPlacementRecord } from './planting/plantingPersistence';
import { useLocalSearchParams } from 'expo-router';
import GardenReferenceLayer from './GardenReferenceLayer';
import NativeLandCalibrationEditor from './NativeLandCalibrationEditor';
import SwingCalibrationEditor, { type SwingMapPlacement } from './SwingCalibrationEditor';
import MoonBedMapCalibrationEditor, { type MoonBedMapPlacement } from './MoonBedMapCalibrationEditor';
import StaticLandmarkCalibrationEditor from './StaticLandmarkCalibrationEditor';
import TeaSetMapCalibrationEditor, { type TeaSetMapPlacement } from './TeaSetMapCalibrationEditor';
import WaterfallMapCalibrationEditor from './WaterfallMapCalibrationEditor';
import { INITIAL_WATERFALL_PLACEMENT } from './waterfallMapPlacement';
import WaterfallImpactOverlay from './WaterfallImpactOverlay';
import WaterfallImpactCalibrationEditor from './WaterfallImpactCalibrationEditor';
import {
  INITIAL_WATERFALL_IMPACT_PLACEMENT,
  type WaterfallImpactPlacement,
} from './waterfallImpactPlacement';
import TreehouseCalibrationEditor, { type TreehousePlacement } from './TreehouseCalibrationEditor';
import LandLayer from './LandLayer';
import GardenConnectionLayer from './GardenConnectionLayer';
import GardenLand09InterfaceLayer from './GardenLand09InterfaceLayer';
import GardenInfrastructureLayer from './GardenInfrastructureLayer';
import GardenRoadApproachLayer from './GardenRoadApproachLayer';
import GardenEnvironmentLayer from './GardenEnvironmentLayer';
import GardenBridge, { BridgeDebugOverlay } from './GardenBridge';
import BridgeTestEditor from './BridgeTestEditor';
import { INITIAL_BRIDGE_TEST } from './bridgeTestPlacement';
import LandmarkLayer from './LandmarkLayer';
import WaterfallV2Entity from './WaterfallV2Entity';
import { type WaterfallVersion } from './waterfallV2Placement';
import SurfaceRippleLayer from './water/SurfaceRippleLayer';
import GardenWaterField from './water/GardenWaterField';
import WaterfallImpactUnderlay from './water/WaterfallImpactUnderlay';
import FishLayer, { type FishDensity, type FishMotionPreset } from './water/FishLayer';
import LotusLayer, { type LotusRenderMode } from './water/LotusLayer';
import { type TopWaterMotionMode } from './water/WaterTopAssembly';
import WaterTopCalibrationEditor, { type TopWaterDisplayPreset } from './WaterTopCalibrationEditor';
import { INITIAL_WATER_TOP_PLACEMENT, type WaterTopPlacement } from './waterTopPlacement';

import { WATER_ASSETS } from './water/waterAssets';
import { GARDEN_LANDS, GARDEN_WATER_COLOR, GARDEN_WORLD_HEIGHT, GARDEN_WORLD_WIDTH } from './gardenMapLayout';
import {
  SWING_MAP_ROTATION, SWING_MAP_SCALE, SWING_MAP_X, SWING_MAP_Y,
} from './swingMapPlacement';
import { TREEHOUSE_MAP_SCALE, TREEHOUSE_MAP_X, TREEHOUSE_MAP_Y } from './treehouseMapPlacement';
import {
  MOON_BED_MAP_ROTATION, MOON_BED_MAP_SCALE, MOON_BED_MAP_X, MOON_BED_MAP_Y,
} from './moonBedMapPlacement';
import { STATIC_LANDMARK_MAP_PLACEMENTS, type StaticLandmarkMapPlacement } from './staticLandmarkMapPlacements';
import { TEA_SET_MAP_ROTATION, TEA_SET_MAP_SCALE, TEA_SET_MAP_X, TEA_SET_MAP_Y } from './teaSetMapPlacement';
import { type WorldTimeOverride, useWorldTime } from './world-time';

function cyclicWeight(phase: number, index: number, count: number): number {
  'worklet';
  let distance = Math.abs(phase - index);
  if (distance > count / 2) distance = count - distance;
  if (distance >= 1) return 0;
  const cosine = Math.cos((distance * Math.PI) / 2);
  return cosine * cosine;
}

function WakeOverlay({ active }: { active: boolean }) {
  const wakeA = useImage(WATER_ASSETS.wake[0]);
  const wakeB = useImage(WATER_ASSETS.wake[1]);
  const wakeC = useImage(WATER_ASSETS.wake[2]);
  const wakeD = useImage(WATER_ASSETS.wake[3]);
  const wakeImages = [wakeA, wakeB, wakeC, wakeD] as const;
  const phase = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    cancelAnimation(phase);
    if (active && !reducedMotion) {
      phase.value = withRepeat(
        withTiming(4, { duration: 5200, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(phase);
  }, [active, reducedMotion, phase]);

  const op0 = useDerivedValue(() => cyclicWeight(phase.value, 0, 4) * 0.9);
  const op1 = useDerivedValue(() => cyclicWeight(phase.value, 1, 4) * 0.9);
  const op2 = useDerivedValue(() => cyclicWeight(phase.value, 2, 4) * 0.9);
  const op3 = useDerivedValue(() => cyclicWeight(phase.value, 3, 4) * 0.9);
  const ops = [op0, op1, op2, op3] as const;

  return (
    <Group>
      {wakeImages.map((img, i) =>
        img ? (
          <Image
            key={i}
            image={img}
            x={0}
            y={0}
            width={GARDEN_WORLD_WIDTH}
            height={GARDEN_WORLD_HEIGHT}
            opacity={ops[i]}
            fit="fill"
          />
        ) : null,
      )}
    </Group>
  );
}

const CHECKED_IN_TREEHOUSE: TreehousePlacement = {
  x: TREEHOUSE_MAP_X, y: TREEHOUSE_MAP_Y, scale: TREEHOUSE_MAP_SCALE,
};
const CHECKED_IN_SWING: SwingMapPlacement = {
  x: SWING_MAP_X, y: SWING_MAP_Y, scale: SWING_MAP_SCALE, rotation: SWING_MAP_ROTATION,
};
const CHECKED_IN_MOON_BED: MoonBedMapPlacement = {
  x: MOON_BED_MAP_X, y: MOON_BED_MAP_Y,
  scale: MOON_BED_MAP_SCALE, rotation: MOON_BED_MAP_ROTATION,
};
const CHECKED_IN_GARDEN_ARCH = STATIC_LANDMARK_MAP_PLACEMENTS.gardenArch;
const CHECKED_IN_PAVILION = STATIC_LANDMARK_MAP_PLACEMENTS.pavilion;
const CHECKED_IN_TEA_SET: TeaSetMapPlacement = {
  x: TEA_SET_MAP_X, y: TEA_SET_MAP_Y, scale: TEA_SET_MAP_SCALE, rotation: TEA_SET_MAP_ROTATION,
};
const MIN_CAMERA_ZOOM = 0.8;
const MAX_CAMERA_ZOOM = 3;

export type GardenSceneProps = {
  initialPreviewMode?: boolean;
  initialWaterfallVersion?: WaterfallVersion;
};

function GardenSceneContent({ initialPreviewMode = true, initialWaterfallVersion = 'legacy' }: GardenSceneProps = {}) {
  const planting = usePlanting();
  const {
    placements,
    activeMode,
    targetFlower,
    previewCoords,
    validationResult,
    selectedFlower,
    isSaving,
    showDevPlantingRegions,
    showDevFootprints,
    showDevHitboxes,
    showPlacementDebug,
    startPlanting,
    startAdjusting,
    updatePreview,
    confirmPlacement,
    cancelPlacement,
    openFlowerDetail,
    closeFlowerDetail,
    supportFlower,
    resetAllPlacements,
    setShowDevPlantingRegions,
    setShowDevFootprints,
    setShowDevHitboxes,
    setShowPlacementDebug,
  } = planting;

  const activeModeRef = useRef(activeMode);
  const placementsRef = useRef(placements);
  useEffect(() => {
    activeModeRef.current = activeMode;
    placementsRef.current = placements;
  }, [activeMode, placements]);

  const searchParams = useLocalSearchParams<{
    mode?: string;
    flowerId?: string;
    month?: string;
    flowerName?: string;
    speciesCode?: string;
    mood?: string;
    calMode?: string;
    subMode?: string;
  }>();

  const handledParamRef = useRef<string | null>(null);

  const [waterfallVersion, setWaterfallVersion] = useState<WaterfallVersion>(initialWaterfallVersion);
  const worldTime = useWorldTime();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [previewMode, setPreviewMode] = useState(initialPreviewMode);
  const [treehouseStatus, setTreehouseStatus] = useState('Waiting for TreehouseEntity effect');
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [infrastructureEnabled, setInfrastructureEnabled] = useState(true);
  const [environmentEnabled, setEnvironmentEnabled] = useState(false);
  const [referenceOpacity, setReferenceOpacity] = useState(0);
  const [waterfallReferenceOpacity, setWaterfallReferenceOpacity] = useState(0.5);
  const [moonBedIntegrationEnabled, setMoonBedIntegrationEnabled] = useState(true);
  const [moonBedShadowOpacity, setMoonBedShadowOpacity] = useState(0.5);
  const [calibrationLayout, setCalibrationLayout] = useState(() => GARDEN_LANDS.map((land) => ({ ...land })));
  const [selectedLandId, setSelectedLandId] = useState('central');
  const [calibrationMode, setCalibrationMode] = useState<
    | 'land'
    | 'treehouse'
    | 'swing'
    | 'moon-bed'
    | 'garden-arch'
    | 'pavilion'
    | 'tea-set'
    | 'waterfall'
    | 'impact'
    | 'water-top'
    | 'bridge'
    | 'planting-regions'
  >('land');
  const [plantingCalibrationMap, setPlantingCalibrationMap] = useState<
    Record<number, MonthRegionCalibration>
  >(() => loadCalibrationFromStorage());
  const [selectedCalMonth, setSelectedCalMonth] = useState<number>(1);
  const [calDisplayMode, setCalDisplayMode] = useState<CalDisplayMode>('all');
  const [calOpacity, setCalOpacity] = useState<number>(0.5);
  const [calDragMode, setCalDragMode] = useState<CalDragMode>('region');
  const [showLandBounds, setShowLandBounds] = useState<boolean>(true);
  const [calSubMode, setCalSubMode] = useState<'transform' | 'mask-paint'>('transform');
  const [paintTool, setPaintTool] = useState<MaskTool>('add');
  const [paintBrushSize, setPaintBrushSize] = useState<number>(40);
  const [paintInteractionMode, setPaintInteractionMode] = useState<PaintInteractionMode>('paint');
  const [paintOpacity, setPaintOpacity] = useState<number>(0.5);
  const [showBaseMask, setShowBaseMask] = useState<boolean>(false);
  const [showAdditions, setShowAdditions] = useState<boolean>(false);
  const [showErasures, setShowErasures] = useState<boolean>(false);
  const [showFinalMask, setShowFinalMask] = useState<boolean>(true);
  const [paintStrokes, setPaintStrokes] = useState<MaskStroke[]>([]);
  const paintStrokesRef = useRef<MaskStroke[]>([]);
  paintStrokesRef.current = paintStrokes;
  const [undoStack, setUndoStack] = useState<MaskStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<MaskStroke[][]>([]);
  const [brushCursor, setBrushCursor] = useState<{
    lx: number;
    ly: number;
    radius: number;
    tool: MaskTool;
  } | null>(null);
  const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);
  const [bridgePlacement, setBridgePlacement] = useState(() => ({ ...INITIAL_BRIDGE_TEST }));
  const [showBridgeDebug, setShowBridgeDebug] = useState(false);
  const [showBridgeWalkPath, setShowBridgeWalkPath] = useState(false);
  const [treehousePlacement, setTreehousePlacement] = useState<TreehousePlacement>(() => ({ ...CHECKED_IN_TREEHOUSE }));
  const [swingPlacement, setSwingPlacement] = useState<SwingMapPlacement>(() => ({ ...CHECKED_IN_SWING }));
  const [moonBedPlacement, setMoonBedPlacement] = useState<MoonBedMapPlacement>(
    () => ({ ...CHECKED_IN_MOON_BED }),
  );
  const [gardenArchPlacement, setGardenArchPlacement] = useState<StaticLandmarkMapPlacement>(
    () => ({ ...CHECKED_IN_GARDEN_ARCH }),
  );
  const [pavilionPlacement, setPavilionPlacement] = useState<StaticLandmarkMapPlacement>(
    () => ({ ...CHECKED_IN_PAVILION }),
  );
  const [teaSetPlacement, setTeaSetPlacement] = useState<TeaSetMapPlacement>(
    () => ({ ...CHECKED_IN_TEA_SET }),
  );
  const [waterfallPlacement, setWaterfallPlacement] = useState(() => ({ ...INITIAL_WATERFALL_PLACEMENT }));
  const [waterfallImpactPlacement, setWaterfallImpactPlacement] = useState<WaterfallImpactPlacement>(
    () => ({ ...INITIAL_WATERFALL_IMPACT_PLACEMENT })
  );
  const [waterTopPlacement, setWaterTopPlacement] = useState<WaterTopPlacement>(
    () => ({ ...INITIAL_WATER_TOP_PLACEMENT })
  );
  const [waterTopPreset, setWaterTopPreset] = useState<TopWaterDisplayPreset>('all');
  const [waterTopFrontBankEnabled, setWaterTopFrontBankEnabled] = useState(true);
  const [impactOverlayVisible, setImpactOverlayVisible] = useState(true);
  const [impactWaterStrength, setImpactWaterStrength] = useState(1.0);
  const [underlayDebugMode, setUnderlayDebugMode] = useState<'off' | 'current-z' | 'top-z'>('off');
  const [runtimeUnderlayStrength, setRuntimeUnderlayStrength] = useState(1.5);
  const [gardenActive, setGardenActive] = useState(true);

  // Approved Water System integration states
  const [waterBaseVisible, setWaterBaseVisible] = useState(true);
  const [waterRipplesVisible, setWaterRipplesVisible] = useState(true);
  const [waterRippleOpacity, setWaterRippleOpacity] = useState(0.35);
  const [fishVisible, setFishVisible] = useState(true);
  const [fishDensity, setFishDensity] = useState<FishDensity>('normal');
  const [fishMotionPreset, setFishMotionPreset] = useState<FishMotionPreset>('normal');
  const [lotusVisible, setLotusVisible] = useState(true);
  const [lotusMode, setLotusMode] = useState<LotusRenderMode>('sway');
  const [wakeVisible, setWakeVisible] = useState(false); // Optional DEV toggle, default OFF
  const [foamVisible, setFoamVisible] = useState(true);
  const [topWaterAssemblyEnabled, setTopWaterAssemblyEnabled] = useState(true);
  const [topWaterMotionMode, setTopWaterMotionMode] = useState<TopWaterMotionMode>('animate');

  const calmBaseImage = useImage(WATER_ASSETS.calmBase);


  useFocusEffect(useCallback(() => {
    setGardenActive(true);
    return () => setGardenActive(false);
  }, []));
  const waterfallFocus = __DEV__ && !previewMode && calibrationMode === 'waterfall';
  const fit = Math.min(viewport.width / GARDEN_WORLD_WIDTH, viewport.height / GARDEN_WORLD_HEIGHT);
  const baseX = (viewport.width - GARDEN_WORLD_WIDTH * fit) / 2;
  const baseY = (viewport.height - GARDEN_WORLD_HEIGHT * fit) / 2;
  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const cameraZoom = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const focalWorldX = useSharedValue(0);
  const focalWorldY = useSharedValue(0);
  const cameraTransform = useDerivedValue(() => [
    { translateX: baseX + cameraX.value },
    { translateY: baseY + cameraY.value },
    { scale: fit * cameraZoom.value },
  ]);
  const focusCoords = useCallback((worldX: number, worldY: number, targetZoom = 1.8) => {
    if (viewport.width === 0 || viewport.height === 0 || fit <= 0) return;
    cameraZoom.value = targetZoom;
    cameraX.value = viewport.width / 2 - baseX - worldX * fit * targetZoom;
    cameraY.value = viewport.height / 2 - baseY - worldY * fit * targetZoom;
  }, [baseX, baseY, fit, viewport.width, viewport.height, cameraX, cameraY, cameraZoom]);

  const focusCalMonth = useCallback((month: number) => {
    if (fit <= 0) return;
    const centroid = getCalibratedCentroid(month, plantingCalibrationMap, calibrationLayout);
    focusCoords(centroid.x, centroid.y, 2.0);
  }, [fit, plantingCalibrationMap, calibrationLayout, focusCoords]);

  useEffect(() => {
    if (!searchParams.mode && !searchParams.calMode) return;
    const paramKey = `${searchParams.mode || ''}-${searchParams.flowerId || ''}-${searchParams.calMode || ''}`;
    if (handledParamRef.current === paramKey) return;
    handledParamRef.current = paramKey;

    if (searchParams.calMode === 'planting-regions' || searchParams.mode === 'calibrate') {
      setPreviewMode(false);
      setCalibrationMode('planting-regions');
      if (searchParams.subMode === 'mask-paint') {
        setCalSubMode('mask-paint');
      } else {
        setCalSubMode('transform');
      }
      focusCalMonth(1);
    } else if (searchParams.mode === 'plant' && searchParams.flowerId) {
      const monthNum = parseInt(searchParams.month || '1', 10);
      startPlanting({
        flowerId: searchParams.flowerId,
        month: monthNum,
        flowerName: searchParams.flowerName || 'pink',
        speciesCode: searchParams.speciesCode,
        mood: searchParams.mood,
      });
      const c = MONTH_CENTROIDS[monthNum] || { x: 1200, y: 900 };
      focusCoords(c.x, c.y);
      setPreviewMode(true);
    } else if (searchParams.mode === 'adjust') {
      const flower = placements.find((p) => p.flowerId === searchParams.flowerId || p.id === searchParams.flowerId);
      if (flower) {
        startAdjusting(flower);
        focusCoords(flower.worldX, flower.worldY);
        setPreviewMode(true);
      }
    }
  }, [searchParams, placements, startPlanting, startAdjusting, focusCoords, focusCalMonth]);

  const handleCalibrationNudge = useCallback((field: keyof MonthRegionCalibration, delta: number) => {
    setPlantingCalibrationMap((prev) => {
      const current = prev[selectedCalMonth] || PLANTING_REGION_CALIBRATION[selectedCalMonth];
      const updated = {
        ...current,
        [field]: Number(((current[field] as number) + delta).toFixed(4)),
      };
      return {
        ...prev,
        [selectedCalMonth]: updated,
      };
    });
  }, [selectedCalMonth]);

  const handleResetSelectedMonth = useCallback(() => {
    setPlantingCalibrationMap((prev) => ({
      ...prev,
      [selectedCalMonth]: { ...PLANTING_REGION_CALIBRATION[selectedCalMonth] },
    }));
  }, [selectedCalMonth]);

  const handleResetAllMonths = useCallback(() => {
    resetCalibrationStorage();
    setPlantingCalibrationMap({ ...PLANTING_REGION_CALIBRATION });
  }, []);

  const handleSaveCalibration = useCallback(() => {
    saveCalibrationToStorage(plantingCalibrationMap);
  }, [plantingCalibrationMap]);

  useEffect(() => {
    if (calibrationMode === 'planting-regions') {
      const refinement = loadMonthMaskRefinement(selectedCalMonth);
      setPaintStrokes(refinement ? [...refinement.strokes] : []);
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [selectedCalMonth, calibrationMode]);

  const handleUndoMask = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, paintStrokes]);
    setPaintStrokes(previous);
    setBrushCursor(null);
  }, [undoStack, paintStrokes]);

  const handleRedoMask = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, paintStrokes]);
    setPaintStrokes(next);
    setBrushCursor(null);
  }, [redoStack, paintStrokes]);

  const handleClearUnsavedMask = useCallback(() => {
    const refinement = loadMonthMaskRefinement(selectedCalMonth);
    setPaintStrokes(refinement ? [...refinement.strokes] : []);
    setUndoStack([]);
    setRedoStack([]);
    setBrushCursor(null);
  }, [selectedCalMonth]);

  const handleResetMaskToLockedBase = useCallback(() => {
    resetMonthMaskRefinement(selectedCalMonth);
    setPaintStrokes([]);
    setUndoStack([]);
    setRedoStack([]);
    setBrushCursor(null);
  }, [selectedCalMonth]);

  const handleCancelMaskEdit = useCallback(() => {
    const refinement = loadMonthMaskRefinement(selectedCalMonth);
    setPaintStrokes(refinement ? [...refinement.strokes] : []);
    setUndoStack([]);
    setRedoStack([]);
    setBrushCursor(null);
    setCalSubMode('transform');
  }, [selectedCalMonth]);

  const handleSaveMask = useCallback(() => {
    const cal =
      plantingCalibrationMap[selectedCalMonth] ||
      PLANTING_REGION_CALIBRATION[selectedCalMonth];
    const land = getParentLand(cal.parentLandAsset, calibrationLayout);
    saveMonthMaskRefinement(
      selectedCalMonth,
      paintStrokes,
      land.id,
      cal.parentLandAsset
    );
  }, [plantingCalibrationMap, selectedCalMonth, calibrationLayout, paintStrokes]);

  useEffect(() => {
    if (typeof window !== 'undefined' && __DEV__) {
      (window as any).__plantingDebug = {
        setPaintTool,
        setPaintBrushSize,
        setPaintStrokes,
        setShowBaseMask,
        setShowAdditions,
        setShowErasures,
        setShowFinalMask,
        setUndoStack,
        setRedoStack,
        setSelectedCalMonth,
        focusCalMonth,
        focusCoords,
        getCamera: () => ({
          cameraX: cameraX.value,
          cameraY: cameraY.value,
          cameraZoom: cameraZoom.value,
          fit,
          baseX,
          baseY,
          viewport,
        }),
        paintStrokes,
        showErasures,
        showFinalMask,
        addStroke: (tool: MaskTool, radius: number, points: { x: number; y: number }[]) => {
          const stroke = createMaskStroke(tool, radius, points);
          setPaintStrokes((prev) => [...prev, stroke]);
        },
      };
    }
  }, [
    setPaintTool,
    setPaintBrushSize,
    setPaintStrokes,
    setShowBaseMask,
    setShowAdditions,
    setShowErasures,
    setShowFinalMask,
    setUndoStack,
    setRedoStack,
    setSelectedCalMonth,
    focusCalMonth,
    focusCoords,
    cameraX,
    cameraY,
    cameraZoom,
    fit,
    baseX,
    baseY,
    viewport,
    paintStrokes,
    showErasures,
    showFinalMask,
  ]);

  const handlePointerMove = useCallback(
    (e: any) => {
      if (
        !__DEV__ ||
        previewMode ||
        calibrationMode !== 'planting-regions' ||
        calSubMode !== 'mask-paint' ||
        paintInteractionMode !== 'paint'
      ) {
        setBrushCursor(null);
        return;
      }
      const nativeEvent = e.nativeEvent;
      if (!nativeEvent) return;
      const screenX = nativeEvent.locationX ?? nativeEvent.clientX;
      const screenY = nativeEvent.locationY ?? nativeEvent.clientY;
      if (screenX === undefined || screenY === undefined) return;
      const currentZoom = cameraZoom.value;
      const currentCamX = cameraX.value;
      const currentCamY = cameraY.value;
      const worldX = (screenX - baseX - currentCamX) / (fit * currentZoom);
      const worldY = (screenY - baseY - currentCamY) / (fit * currentZoom);
      const cal =
        plantingCalibrationMap[selectedCalMonth] ||
        PLANTING_REGION_CALIBRATION[selectedCalMonth];
      const land = getParentLand(cal.parentLandAsset, calibrationLayout);
      const landLocal = worldToLandLocal(worldX, worldY, land);
      setBrushCursor({
        lx: landLocal.x,
        ly: landLocal.y,
        radius: paintBrushSize / 2,
        tool: paintTool,
      });
    },
    [
      previewMode,
      calibrationMode,
      calSubMode,
      cameraZoom,
      cameraX,
      cameraY,
      baseX,
      baseY,
      fit,
      plantingCalibrationMap,
      selectedCalMonth,
      calibrationLayout,
      paintBrushSize,
      paintTool,
      paintInteractionMode,
    ]
  );

  const handleGardenTap = useCallback((screenX: number, screenY: number) => {
    if (fit <= 0) return;
    const currentZoom = cameraZoom.value;
    const currentCamX = cameraX.value;
    const currentCamY = cameraY.value;
    const worldX = (screenX - baseX - currentCamX) / (fit * currentZoom);
    const worldY = (screenY - baseY - currentCamY) / (fit * currentZoom);

    if (__DEV__ && !previewMode && calibrationMode === 'planting-regions') {
      if (calSubMode === 'mask-paint') {
        return;
      }
      let closestMonth = selectedCalMonth;
      let closestDist = Infinity;
      for (let m = 1; m <= 12; m++) {
        const c = getCalibratedCentroid(m, plantingCalibrationMap, calibrationLayout);
        const d = Math.hypot(worldX - c.x, worldY - c.y);
        if (d < closestDist) {
          closestDist = d;
          closestMonth = m;
        }
      }
      if (closestDist < 160) {
        setSelectedCalMonth(closestMonth);
        return;
      }
    }

    if (activeModeRef.current !== 'normal') {
      updatePreview(worldX, worldY);
    } else {
      const currentPlacements = placementsRef.current;
      let hitFlower: FlowerPlacementRecord | null = null;
      for (let i = currentPlacements.length - 1; i >= 0; i--) {
        const p = currentPlacements[i];
        const def = getFlowerPlacementDefinition(p.flowerName);
        const hitCenterY = p.worldY - def.visualHeight * 0.35;
        const dx = worldX - p.worldX;
        const dy = worldY - hitCenterY;
        if (dx * dx + dy * dy <= def.hitboxRadius * def.hitboxRadius) {
          hitFlower = p;
          break;
        }
      }
      if (hitFlower) {
        openFlowerDetail(hitFlower);
      }
    }
  }, [fit, baseX, baseY, cameraZoom, cameraX, cameraY, updatePreview, openFlowerDetail, previewMode, calibrationMode, calSubMode, selectedCalMonth, plantingCalibrationMap, calibrationLayout]);

  const startMaskPos = useRef({ localX: 0, localY: 0 });

  const maskPan = useMemo(() => {
    return Gesture.Pan()
      .maxPointers(1)
      .runOnJS(true)
      .onStart(() => {
        const cal =
          plantingCalibrationMap[selectedCalMonth] ||
          PLANTING_REGION_CALIBRATION[selectedCalMonth];
        startMaskPos.current = { localX: cal.localX, localY: cal.localY };
      })
      .onUpdate((event) => {
        const currentZoom = cameraZoom.value;
        const cal =
          plantingCalibrationMap[selectedCalMonth] ||
          PLANTING_REGION_CALIBRATION[selectedCalMonth];
        const land = getParentLand(cal.parentLandAsset, calibrationLayout);
        const rotRad = (land.rotation * Math.PI) / 180;
        const dxW = event.translationX / (fit * currentZoom);
        const dyW = event.translationY / (fit * currentZoom);
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);
        const dxL = dxW * cos + dyW * sin;
        const dyL = -dxW * sin + dyW * cos;
        setPlantingCalibrationMap((prev) => {
          const cur =
            prev[selectedCalMonth] || PLANTING_REGION_CALIBRATION[selectedCalMonth];
          return {
            ...prev,
            [selectedCalMonth]: {
              ...cur,
              localX: Number((startMaskPos.current.localX + dxL).toFixed(2)),
              localY: Number((startMaskPos.current.localY + dyL).toFixed(2)),
            },
          };
        });
      });
  }, [selectedCalMonth, plantingCalibrationMap, calibrationLayout, fit, cameraZoom]);

  const paintPan = useMemo(() => {
    return Gesture.Pan()
      .maxPointers(1)
      .minDistance(0)
      .runOnJS(true)
      .onStart((event) => {
        const currentZoom = cameraZoom.value;
        const currentCamX = cameraX.value;
        const currentCamY = cameraY.value;
        const worldX = (event.x - baseX - currentCamX) / (fit * currentZoom);
        const worldY = (event.y - baseY - currentCamY) / (fit * currentZoom);
        const cal =
          plantingCalibrationMap[selectedCalMonth] ||
          PLANTING_REGION_CALIBRATION[selectedCalMonth];
        const land = getParentLand(cal.parentLandAsset, calibrationLayout);
        const landLocal = worldToLandLocal(worldX, worldY, land);

        currentStrokePointsRef.current = [{ x: landLocal.x, y: landLocal.y }];
        const newStroke = createMaskStroke(
          paintTool,
          paintBrushSize / 2,
          currentStrokePointsRef.current
        );
        setUndoStack((prev) => [...prev, paintStrokesRef.current]);
        setRedoStack([]);
        setPaintStrokes((prev) => [...prev, newStroke]);
        setBrushCursor({
          lx: landLocal.x,
          ly: landLocal.y,
          radius: paintBrushSize / 2,
          tool: paintTool,
        });
      })
      .onUpdate((event) => {
        const currentZoom = cameraZoom.value;
        const currentCamX = cameraX.value;
        const currentCamY = cameraY.value;
        const worldX = (event.x - baseX - currentCamX) / (fit * currentZoom);
        const worldY = (event.y - baseY - currentCamY) / (fit * currentZoom);
        const cal =
          plantingCalibrationMap[selectedCalMonth] ||
          PLANTING_REGION_CALIBRATION[selectedCalMonth];
        const land = getParentLand(cal.parentLandAsset, calibrationLayout);
        const landLocal = worldToLandLocal(worldX, worldY, land);

        setBrushCursor({
          lx: landLocal.x,
          ly: landLocal.y,
          radius: paintBrushSize / 2,
          tool: paintTool,
        });

        const pts = currentStrokePointsRef.current;
        if (pts.length === 0) return;
        const lastPt = pts[pts.length - 1];
        const dx = landLocal.x - lastPt.x;
        const dy = landLocal.y - lastPt.y;
        if (dx * dx + dy * dy >= 4) {
          pts.push({ x: landLocal.x, y: landLocal.y });
          const updatedStroke = createMaskStroke(paintTool, paintBrushSize / 2, pts);
          setPaintStrokes((prev) => [...prev.slice(0, -1), updatedStroke]);
        }
      })
      .onEnd(() => {
        currentStrokePointsRef.current = [];
        setBrushCursor(null);
      })
      .onFinalize(() => {
        currentStrokePointsRef.current = [];
        setBrushCursor(null);
      });
  }, [
    baseX,
    baseY,
    fit,
    cameraZoom,
    cameraX,
    cameraY,
    plantingCalibrationMap,
    selectedCalMonth,
    calibrationLayout,
    paintTool,
    paintBrushSize,
  ]);

  const cameraGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        startX.value = cameraX.value;
        startY.value = cameraY.value;
      })
      .onUpdate((event) => {
        cameraX.value = startX.value + event.translationX;
        cameraY.value = startY.value + event.translationY;
      });
    const pinch = Gesture.Pinch()
      .onStart((event) => {
        startZoom.value = cameraZoom.value;
        startX.value = cameraX.value;
        startY.value = cameraY.value;
        focalWorldX.value = (event.focalX - baseX - startX.value) / (fit * startZoom.value);
        focalWorldY.value = (event.focalY - baseY - startY.value) / (fit * startZoom.value);
      })
      .onUpdate((event) => {
        const nextZoom = Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, startZoom.value * event.scale));
        cameraZoom.value = nextZoom;
        cameraX.value = event.focalX - baseX - focalWorldX.value * fit * nextZoom;
        cameraY.value = event.focalY - baseY - focalWorldY.value * fit * nextZoom;
      });
    const tap = Gesture.Tap()
      .maxDuration(250)
      .runOnJS(true)
      .onEnd((event) => {
        handleGardenTap(event.x, event.y);
      });
    const isPlantingCal = __DEV__ && !previewMode && calibrationMode === 'planting-regions';
    let effectivePan = pan;
    if (isPlantingCal) {
      if (calSubMode === 'mask-paint') {
        effectivePan = paintInteractionMode === 'paint' ? paintPan : pan;
      } else {
        effectivePan = calDragMode === 'region' ? maskPan : pan;
      }
    }
    return Gesture.Simultaneous(effectivePan, pinch, tap);
  }, [baseX, baseY, fit, cameraX, cameraY, cameraZoom, focalWorldX, focalWorldY,
    startX, startY, startZoom, handleGardenTap, previewMode, calibrationMode, calSubMode, calDragMode, paintInteractionMode, maskPan, paintPan]);
  const resetView = useCallback(() => {
    cameraX.value = 0;
    cameraY.value = 0;
    cameraZoom.value = 1;
  }, [cameraX, cameraY, cameraZoom]);

  const focusImpactView = useCallback(() => {
    if (viewport.width === 0 || viewport.height === 0 || fit <= 0) return;
    const targetZoom = 2.6;
    const targetX = 1040;
    const targetY = 240;
    cameraZoom.value = targetZoom;
    cameraX.value = viewport.width / 2 - baseX - targetX * fit * targetZoom;
    cameraY.value = viewport.height * 0.38 - baseY - targetY * fit * targetZoom;
  }, [baseX, baseY, fit, viewport.width, viewport.height, cameraX, cameraY, cameraZoom]);

  // Camera-only framing keeps the bridge above its numeric editor.
  const focusBridge = () => {
    if (fit <= 0) return;
    const zoom = Math.min(MAX_CAMERA_ZOOM, viewport.width * 0.9 / (fit * 800), viewport.height * 0.48 / (fit * 700));
    cameraZoom.value = zoom;
    cameraX.value = viewport.width / 2 - baseX - bridgePlacement.x * fit * zoom;
    cameraY.value = viewport.height * 0.27 - baseY - bridgePlacement.y * fit * zoom;
  };

  const focusWaterTopView = useCallback(() => {
    if (viewport.width === 0 || viewport.height === 0 || fit <= 0) return;
    // Fit the complete raw image above the calibration panel, including y < 0.
    // Camera only: approved world placement stays unchanged.
    const p = INITIAL_WATER_TOP_PLACEMENT;
    const targetZoom = Math.min(3, viewport.width * 0.9 / (fit * 530), viewport.height * 0.42 / (fit * 360));
    const targetX = p.x + 1536 * p.scale / 2;
    const targetY = p.y + 1024 * p.scale / 2;
    cameraZoom.value = targetZoom;
    cameraX.value = viewport.width / 2 - baseX - targetX * fit * targetZoom;
    cameraY.value = viewport.height * 0.25 - baseY - targetY * fit * targetZoom;
  }, [baseX, baseY, fit, viewport.width, viewport.height, cameraX, cameraY, cameraZoom]);

  useEffect(() => {
    if (calibrationMode === 'impact') {
      focusImpactView();
    } else if (calibrationMode === 'water-top') {
      focusWaterTopView();
    } else if (calibrationMode === 'planting-regions' && viewport.width > 0 && fit > 0) {
      focusCalMonth(selectedCalMonth);
    }
  }, [calibrationMode, focusImpactView, focusWaterTopView, focusCalMonth, selectedCalMonth, viewport.width, fit]);

  const handleDoneImpactCalibration = useCallback(() => {
    setCalibrationMode('land');
    setPreviewMode(true);
    resetView();
  }, [resetView]);

  const isWaterTopCalibrating = __DEV__ && !previewMode && calibrationMode === 'water-top';
  const topWaterShowWater = true;
  const topWaterShowCliff = !isWaterTopCalibrating || (waterTopPreset !== 'water-only');
  const topWaterShowBank = !isWaterTopCalibrating || (waterTopFrontBankEnabled || waterTopPreset === 'bank' || waterTopPreset === 'all');
  const waterfallVisible = !isWaterTopCalibrating || (waterTopPreset === 'waterfall' || waterTopPreset === 'all');
  const impactFoamEffective = foamVisible && (!isWaterTopCalibrating || waterTopPreset === 'all');

  return (
    <View
      style={styles.scene}
      onPointerMove={handlePointerMove}
      onLayout={({ nativeEvent: { layout } }) =>
        setViewport({ width: layout.width, height: layout.height })
      }
    >
      {/* Direct Waterfall gestures remain disabled while the stable numeric editor is active. */}
      {fit > 0 && (
        <GestureDetector gesture={cameraGesture}>
        <Canvas style={styles.scene}>
          <PlantingProvider value={planting}>
          {/* Shared camera only. Neither sibling inherits an individual land transform. */}
          <Group transform={cameraTransform}>
            {/* 1. Solid fallback */}
            <Rect x={-2400} y={-2400} width={7200} height={6600} color={GARDEN_WATER_COLOR} />

            {/* 2. Calm water base */}
            {waterBaseVisible && calmBaseImage && (
              <GardenWaterField image={calmBaseImage} active={gardenActive} animated={waterRipplesVisible} />
            )}

            {/* 3. Fish (below ripples & surface disturbance) */}
            <FishLayer
              active={gardenActive}
              enabled={fishVisible}
              opacity={1.0}
              density={fishDensity}
              motionPreset={fishMotionPreset}
            />

            {/* 4. Surface ripples */}
            <SurfaceRippleLayer
              softWorldEdges
              active={gardenActive}
              enabled={waterRipplesVisible}
              opacity={waterRippleOpacity}
            />

            {/* 5. Waterfall Impact Underlay (disturbed turquoise water & wake, above fish/ripples, below lotus/land/landmarks) */}
            <WaterfallImpactUnderlay
              strength={__DEV__ ? impactWaterStrength : 1.0}
              active={gardenActive}
              enabled={foamVisible && waterfallVersion === 'legacy'}
              opacity={1.0}
              placement={waterfallImpactPlacement}
              onRuntimeStrength={__DEV__ ? setRuntimeUnderlayStrength : undefined}
            />
            {__DEV__ && underlayDebugMode === 'current-z' && (
              <WaterfallImpactDebugShape placement={waterfallImpactPlacement} />
            )}

            {/* 6. Lotus */}
            <LotusLayer
              active={gardenActive}
              visible={lotusVisible}
              opacity={1.0}
              mode={lotusMode}
            />

            {/* V2 is one independent terrain; islands and treehouse occlude it naturally. */}
            {showLandmarks && waterfallVersion === 'v2' && (
              <WaterfallV2Entity active={gardenActive} animated={topWaterMotionMode === 'animate'} />
            )}
            {/* 7. LandLayer */}
            <LandLayer layout={__DEV__ ? calibrationLayout : undefined}
              selectedLandId={__DEV__ && !previewMode && calibrationMode === 'land' ? selectedLandId : null} />
            {/* Month Planting Region Overlay */}
            <PlantingRegionOverlay
              highlightedMonth={activeMode !== 'normal' && targetFlower ? targetFlower.month : null}
              showAllRegions={showDevPlantingRegions}
              isCalibrating={__DEV__ && !previewMode && calibrationMode === 'planting-regions'}
              calibrationMap={plantingCalibrationMap}
              selectedMonth={selectedCalMonth}
              displayMode={calDisplayMode}
              opacity={calSubMode === 'mask-paint' ? paintOpacity : calOpacity}
              showLandBounds={showLandBounds}
              layout={calibrationLayout}
              isPaintingMask={__DEV__ && !previewMode && calibrationMode === 'planting-regions' && calSubMode === 'mask-paint'}
              paintingMonth={selectedCalMonth}
              activeStrokes={paintStrokes}
              brushCursor={brushCursor}
              showBaseMask={showBaseMask}
              showAdditions={showAdditions}
              showErasures={showErasures}
              showFinalMask={showFinalMask}
            />

            {environmentEnabled && <GardenEnvironmentLayer />}
            {/* The approved entrance road is unchanged in both DEV states. */}
              {__DEV__ && infrastructureEnabled && <GardenLand09InterfaceLayer />}
              <GardenConnectionLayer />
            {/* World-aligned corrected infrastructure; OFF restores the prior DEV view. */}
            {__DEV__ && infrastructureEnabled && <GardenInfrastructureLayer />}
            {__DEV__ && !infrastructureEnabled && <GardenBridge placement={bridgePlacement} />}

            {/* 8. Reference overlay when enabled */}
            {__DEV__ && (waterfallFocus ? waterfallReferenceOpacity : referenceOpacity) > 0 && (
              <GardenReferenceLayer opacity={waterfallFocus ? waterfallReferenceOpacity : referenceOpacity} />
            )}
            {showLandmarks && (
              <LandmarkLayer
                waterfallVersion={waterfallVersion}
                showDiagnostics={__DEV__ && !previewMode && !waterfallFocus && showDiagnostics}
                showBounds={__DEV__ && !previewMode && !waterfallFocus && calibrationMode !== 'land' && calibrationMode !== 'impact' && calibrationMode !== 'water-top'}
                waterfallImpactPlacement={waterfallImpactPlacement}
                impactFoamEnabled={impactFoamEffective}
                treehousePlacement={treehousePlacement}
                swingPlacement={swingPlacement}
                moonBedPlacement={moonBedPlacement}
                gardenArchPlacement={gardenArchPlacement}
                pavilionPlacement={pavilionPlacement}
                teaSetPlacement={teaSetPlacement}
                waterfallPlacement={waterfallPlacement}
                waterfallActive={gardenActive}
                moonBedIntegrationEnabled={moonBedIntegrationEnabled}
                moonBedShadowOpacity={moonBedShadowOpacity}
                treehouseLightingEnabled={worldTime.isTreehouseLightingTime}
                swingLightingEnabled={worldTime.isTreehouseLightingTime}
                topWaterAssemblyEnabled={topWaterAssemblyEnabled}
                suppressLegacyWaterTop
                topWaterMotionMode={topWaterMotionMode}
                waterTopPlacement={waterTopPlacement}
                topWaterShowWater={topWaterShowWater}
                topWaterShowCliff={topWaterShowCliff}
                topWaterShowBank={topWaterShowBank}
                waterfallVisible={waterfallVisible}
                onDebugStatus={__DEV__ ? setTreehouseStatus : undefined}
              />
            )}
            {__DEV__ && infrastructureEnabled && showLandmarks && <GardenRoadApproachLayer />}
            {/* Planted Flowers & Active Placement Preview Layer */}
            <PlantedFlowerLayer />
            {__DEV__ && !previewMode && calibrationMode === 'impact' && (
              <WaterfallImpactOverlay placement={waterfallImpactPlacement} />
            )}
            {/* TOP Z Diagnostic Copy: above LandmarkLayer / above WaterfallEntity */}
            {__DEV__ && <BridgeDebugOverlay placement={bridgePlacement}
              debug={showBridgeDebug} walkPath={showBridgeWalkPath} />}
            {__DEV__ && underlayDebugMode === 'top-z' && (
              <WaterfallImpactDebugShape placement={waterfallImpactPlacement} />
            )}
          </Group>
          </PlantingProvider>
        </Canvas>
        </GestureDetector>
      )}
      {/* Planting Placement Controls Banner & Action Bar */}
      <PlantingPlacementControls />

      {/* Flower Detail Modal */}
      <FlowerDetailModal />

      {/* Floating button when in Preview Mode */}
      {__DEV__ && previewMode && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPreviewMode(false)}
          style={styles.floatingToggleButton}
        >
          <Text style={styles.floatingToggleText}>⚙️ DEV Controls</Text>
        </Pressable>
      )}

      {/* Full DEV Control Panels when Preview Mode is OFF */}
      {__DEV__ && !previewMode && !waterfallFocus && calibrationMode !== 'impact' && calibrationMode !== 'water-top' && calibrationMode !== 'bridge' && calibrationMode !== 'planting-regions' && (
        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <ToggleButton
              label="👁️ Preview Mode (Hide Panels)"
              enabled
              onPress={() => setPreviewMode(true)}
            />
            <ToggleButton label="Reset View" enabled={false} onPress={resetView} />
            {([
              ['B01 feet', 1740, 1364], ['B02 feet', 1680, 570],
              ['ST01 feet', 1650, 935], ['Road junctions', 790, 740],
              ['Upper path junction', 1340, 390], ['Lower path junction', 1160, 1040],
              ['Treehouse road', 640, 485], ['Entrance road junction', 1440, 1490],
              ['Environment Central', 1190, 650], ['Environment West', 425, 890],
              ['Environment Land0405', 1430, 205], ['Environment Land06', 1930, 445],
              ['Environment Land07', 2100, 740], ['Environment Land08', 2050, 1275],
              ['Environment Land09', 1230, 1280], ['Environment Shoreline', 320, 1240],
            ] as const).map(([label, x, y]) => <ToggleButton key={label} label={label} enabled={false}
              onPress={() => {
                cameraZoom.value = 3;
                cameraX.value = viewport.width / 2 - baseX - x * fit * 3;
                cameraY.value = viewport.height / 2 - baseY - y * fit * 3;
                setPreviewMode(true);
              }} />)}
            <ToggleButton label="BRIDGE TEST" enabled={false} onPress={() => {
              setCalibrationMode('bridge');
              focusBridge();
            }} />
            {([
              ['Roads medium west', 685, 600], ['Roads medium upper', 1340, 390],
              ['Roads medium lower', 1260, 1080], ['Roads medium entrance', 1440, 1490],
            ] as const).map(([label, x, y]) => <ToggleButton key={label} label={label} enabled={false}
              onPress={() => {
                cameraZoom.value = 1.65;
                cameraX.value = viewport.width / 2 - baseX - x * fit * 1.65;
                cameraY.value = viewport.height / 2 - baseY - y * fit * 1.65;
                setPreviewMode(true);
              }} />)}
            <ToggleButton label="Land calibration" enabled={calibrationMode === 'land'} onPress={() => setCalibrationMode('land')} />
            <ToggleButton
              label="Planting Region calibration"
              enabled={(calibrationMode as string) === 'planting-regions'}
              onPress={() => {
                setCalibrationMode('planting-regions');
                focusCalMonth(selectedCalMonth);
              }}
            />
                <ToggleButton label="Treehouse calibration" enabled={calibrationMode === 'treehouse'} onPress={() => {
                  setCalibrationMode('treehouse');
                  setShowLandmarks(true);
                }} />
            <ToggleButton label="Swing calibration" enabled={calibrationMode === 'swing'} onPress={() => {
              setCalibrationMode('swing');
              setShowLandmarks(true);
            }} />
            <ToggleButton label="Moon Bed calibration" enabled={calibrationMode === 'moon-bed'} onPress={() => {
              setCalibrationMode('moon-bed');
              setShowLandmarks(true);
            }} />
            <ToggleButton label="Garden Arch calibration" enabled={calibrationMode === 'garden-arch'} onPress={() => {
              setCalibrationMode('garden-arch');
              setShowLandmarks(true);
            }} />
            <ToggleButton label="Pavilion calibration" enabled={calibrationMode === 'pavilion'} onPress={() => {
              setCalibrationMode('pavilion');
              setShowLandmarks(true);
            }} />
            <ToggleButton label="Tea Set calibration" enabled={calibrationMode === 'tea-set'} onPress={() => {
              setCalibrationMode('tea-set');
              setShowLandmarks(true);
            }} />
            <ToggleButton label="Legacy Waterfall calibration" enabled={calibrationMode === 'waterfall'} onPress={() => {
              setWaterfallVersion('legacy');
              setCalibrationMode('waterfall');
              setShowLandmarks(true);
            }} />
            <ToggleButton label="Legacy Water Top calibration" enabled={false} onPress={() => {
              setWaterfallVersion('legacy');
              setCalibrationMode('water-top');
              setShowLandmarks(true);
              setTopWaterAssemblyEnabled(true);
              setTopWaterMotionMode('static');
              setWaterTopPreset('all');
              setWaterTopFrontBankEnabled(true);
              focusWaterTopView();
            }} />
            <ToggleButton label="Impact calibration" enabled={false} onPress={() => {
              setWaterfallVersion('legacy');
              setCalibrationMode('impact');
              setShowLandmarks(true);
              focusImpactView();
            }} />
          </View>
          {/* 🌿 Production Flower Planting System DEV Controls */}
          <View style={[styles.controlRow, { alignItems: 'center', backgroundColor: '#ECFDF5', padding: 4, borderRadius: 6 }]}>
            <Text style={[styles.diagnosticText, { fontWeight: '700', color: '#065F46' }]}>Planting DEV:</Text>
            <ToggleButton
              label={`Calibrate Regions ${(calibrationMode as string) === 'planting-regions' ? 'ON' : 'OFF'}`}
              enabled={(calibrationMode as string) === 'planting-regions'}
              onPress={() => {
                setCalibrationMode((prev) => (prev === 'planting-regions' ? 'land' : 'planting-regions'));
                if ((calibrationMode as string) !== 'planting-regions') {
                  focusCalMonth(selectedCalMonth);
                }
              }}
            />
            <ToggleButton
              label={`Regions ${showDevPlantingRegions ? 'ON' : 'OFF'}`}
              enabled={showDevPlantingRegions}
              onPress={() => setShowDevPlantingRegions((v) => !v)}
            />
            <ToggleButton
              label={`Footprints ${showDevFootprints ? 'ON' : 'OFF'}`}
              enabled={showDevFootprints}
              onPress={() => setShowDevFootprints((v) => !v)}
            />
            <ToggleButton
              label={`Hitboxes ${showDevHitboxes ? 'ON' : 'OFF'}`}
              enabled={showDevHitboxes}
              onPress={() => setShowDevHitboxes((v) => !v)}
            />
            <ToggleButton
              label={`Debug Info ${showPlacementDebug ? 'ON' : 'OFF'}`}
              enabled={showPlacementDebug}
              onPress={() => setShowPlacementDebug((v) => !v)}
            />
            <ToggleButton
              label="Plant Jan"
              enabled={false}
              onPress={() => {
                startPlanting({ flowerId: `dev-fl-${Date.now()}`, month: 1, flowerName: 'pink', mood: 'Peaceful' });
                focusCoords(MONTH_CENTROIDS[1].x, MONTH_CENTROIDS[1].y);
              }}
            />
            <ToggleButton
              label="Plant Jun"
              enabled={false}
              onPress={() => {
                startPlanting({ flowerId: `dev-fl-${Date.now()}`, month: 6, flowerName: 'sunflower', mood: 'Sunny' });
                focusCoords(MONTH_CENTROIDS[6].x, MONTH_CENTROIDS[6].y);
              }}
            />
            <ToggleButton
              label="Reset Flowers"
              enabled={false}
              onPress={resetAllPlacements}
            />
          </View>
          <View style={styles.controlRow}>
            <ToggleButton label={`Infrastructure ${infrastructureEnabled ? 'ON' : 'OFF'}`}
              enabled={infrastructureEnabled} onPress={() => setInfrastructureEnabled((value) => !value)} />
            <ToggleButton label={`Environment ${environmentEnabled ? 'ON' : 'OFF'}`}
              enabled={environmentEnabled} onPress={() => setEnvironmentEnabled((value) => !value)} />
            <ToggleButton label="Landmarks" enabled={showLandmarks} onPress={() => setShowLandmarks((value) => !value)} />
            <ToggleButton label="Diagnostics" enabled={showDiagnostics} onPress={() => setShowDiagnostics((value) => !value)} />
            <ToggleButton label="Reference" enabled={referenceOpacity > 0}
              onPress={() => setReferenceOpacity((value) => value > 0 ? 0 : 0.5)} />
          </View>
          <View style={styles.controlRow}>
            <ToggleButton
              label={`Water ${waterBaseVisible ? 'ON' : 'OFF'}`}
              enabled={waterBaseVisible}
              onPress={() => setWaterBaseVisible((v) => !v)}
            />
            <ToggleButton
              label={`Ripples ${waterRipplesVisible ? 'ON' : 'OFF'}`}
              enabled={waterRipplesVisible}
              onPress={() => setWaterRipplesVisible((v) => !v)}
            />
            <ToggleButton
              label={`Fish ${fishVisible ? 'ON' : 'OFF'}`}
              enabled={fishVisible}
              onPress={() => setFishVisible((v) => !v)}
            />
            <ToggleButton
              label={`Lotus ${lotusVisible ? 'ON' : 'OFF'}`}
              enabled={lotusVisible}
              onPress={() => setLotusVisible((v) => !v)}
            />
            <ToggleButton
              label={`Impact Overlay ${impactOverlayVisible ? 'ON' : 'OFF'}`}
              enabled={impactOverlayVisible}
              onPress={() => setImpactOverlayVisible((v) => !v)}
            />
            <ToggleButton
              label={`Impact Foam ${foamVisible ? 'ON' : 'OFF'}`}
              enabled={foamVisible}
              onPress={() => setFoamVisible((v) => !v)}
            />
          </View>
          <View style={styles.controlRow}>
            <ToggleButton
              label={`Legacy Source ${topWaterAssemblyEnabled ? 'ON' : 'OFF'}`}
              enabled={topWaterAssemblyEnabled}
              onPress={() => setTopWaterAssemblyEnabled((v) => !v)}
            />
            <ToggleButton label="Waterfall V2" enabled={waterfallVersion === 'v2'}
              onPress={() => { setWaterfallVersion('v2'); setShowLandmarks(true); }} />
            <ToggleButton label="Old Waterfall" enabled={waterfallVersion === 'legacy'}
              onPress={() => setWaterfallVersion('legacy')} />
            <ToggleButton label={`Waterfall Flow ${topWaterMotionMode === 'animate' ? 'ON' : 'OFF'}`}
              enabled={topWaterMotionMode === 'animate'}
              onPress={() => setTopWaterMotionMode(m => m === 'animate' ? 'static' : 'animate')} />
          </View>
          <View style={[styles.controlRow, { alignItems: 'center' }]}>
            <Text style={[styles.diagnosticText, { fontWeight: '700' }]}>Impact Water:</Text>
            {[
              { label: 'OFF', val: 0 },
              { label: 'NORMAL', val: 1.0 },
              { label: 'STRONG', val: 1.5 },
            ].map(({ label, val }) => (
              <ToggleButton
                key={`impact-water-${label}`}
                label={label}
                enabled={impactWaterStrength === val}
                onPress={() => setImpactWaterStrength(val)}
              />
            ))}
          </View>
          <View style={[styles.controlRow, { alignItems: 'center' }]}>
            <Text style={[styles.diagnosticText, { fontWeight: '700' }]}>Impact Underlay Debug:</Text>
            {(['off', 'current-z', 'top-z'] as const).map((mode) => (
              <ToggleButton
                key={`underlay-debug-${mode}`}
                label={mode === 'off' ? 'OFF' : mode === 'current-z' ? 'CURRENT Z' : 'TOP Z'}
                enabled={underlayDebugMode === mode}
                onPress={() => setUnderlayDebugMode(mode)}
              />
            ))}
          </View>
          <Text style={styles.diagnosticText}>
            Impact Water: {impactWaterStrength === 0 ? 'OFF' : impactWaterStrength === 1.0 ? 'NORMAL (1.0x)' : 'STRONG (1.5x)'} · Runtime: {runtimeUnderlayStrength}x
          </Text>
          {waterRipplesVisible && (
            <View style={styles.controlRow}>
              {[0.2, 0.35, 0.5, 0.7].map((opacity) => (
                <ToggleButton
                  key={`ripple-${opacity}`}
                  label={`Ripple ${Math.round(opacity * 100)}%`}
                  enabled={waterRippleOpacity === opacity}
                  onPress={() => setWaterRippleOpacity(opacity)}
                />
              ))}
            </View>
          )}
          <View style={styles.controlRow}>
            <ToggleButton label={`Moon Bed Integration ${moonBedIntegrationEnabled ? 'ON' : 'OFF'}`}
              enabled={moonBedIntegrationEnabled}
              onPress={() => setMoonBedIntegrationEnabled((value) => !value)} />
            {[0, 0.3, 0.5, 0.7].map((opacity) => (
              <ToggleButton key={`moon-shadow-${opacity}`} label={`Shadow ${opacity * 100}%`}
                enabled={moonBedShadowOpacity === opacity}
                onPress={() => setMoonBedShadowOpacity(opacity)} />
            ))}
          </View>
          <View style={styles.controlRow}>
            {[0, 0.3, 0.5, 0.7].map((opacity) => (
              <ToggleButton key={opacity} label={`${opacity * 100}%`}
                enabled={referenceOpacity === opacity} onPress={() => setReferenceOpacity(opacity)} />
            ))}
          </View>
          <View style={styles.controlRow}>
            {([
              ['auto', 'AUTO'],
              ['day', 'FORCE DAY'],
              ['evening', 'FORCE EVENING'],
              ['night', 'FORCE NIGHT'],
            ] as const).map(([override, label]) => (
              <ToggleButton key={override} label={label}
                enabled={worldTime.override === override}
                onPress={() => worldTime.setOverride(override as WorldTimeOverride)} />
            ))}
          </View>
          <Text style={styles.diagnosticText}>
            World Time: {worldTime.override === 'auto'
              ? 'AUTO'
              : `FORCE ${worldTime.override.toUpperCase()}`}
            {' → '}{worldTime.phase.toUpperCase()}
          </Text>
          {showDiagnostics && (
            <View pointerEvents="none">
              <Text style={styles.diagnosticText}>Reference: 1448×1086 → 2400×1800 · scale 1.65745856 · offset 0,0</Text>
              <Text style={styles.diagnosticText}>Landmark anchor: {String(treehousePlacement.x)},{String(treehousePlacement.y)} · scale {String(treehousePlacement.scale)} · viewport fit {fit.toFixed(4)}</Text>
              <Text style={styles.diagnosticText}>Swing anchor: {String(swingPlacement.x)},{String(swingPlacement.y)} · scale {String(swingPlacement.scale)} · rotation {String(swingPlacement.rotation)}°</Text>
              <Text style={styles.diagnosticText}>Moon Bed anchor: {String(moonBedPlacement.x)},{String(moonBedPlacement.y)} · scale {String(moonBedPlacement.scale)} · rotation {String(moonBedPlacement.rotation)}°</Text>
              <Text style={styles.diagnosticText}>Garden Arch anchor: {String(gardenArchPlacement.x)},{String(gardenArchPlacement.y)} · scale {String(gardenArchPlacement.scale)} · rotation {String(gardenArchPlacement.rotation)}°</Text>
              <Text style={styles.diagnosticText}>Pavilion anchor: {String(pavilionPlacement.x)},{String(pavilionPlacement.y)} · scale {String(pavilionPlacement.scale)} · rotation {String(pavilionPlacement.rotation)}°</Text>
              <Text style={styles.diagnosticText}>Tea Set anchor: {String(teaSetPlacement.x)},{String(teaSetPlacement.y)} · scale {String(teaSetPlacement.scale)} · rotation {String(teaSetPlacement.rotation)}°</Text>
              <Text style={styles.diagnosticText}>Waterfall impact: {String(waterfallImpactPlacement.x)},{String(waterfallImpactPlacement.y)} · size {String(waterfallImpactPlacement.width)}×{String(waterfallImpactPlacement.height)} · rot {String(waterfallImpactPlacement.rotation)}°</Text>
              <Text style={styles.diagnosticText}>{treehouseStatus}</Text>
            </View>
          )}
        </View>
      )}
      {__DEV__ && !previewMode && calibrationMode === 'bridge' && (
        <BridgeTestEditor placement={bridgePlacement} onChange={setBridgePlacement}
          debug={showBridgeDebug} onDebug={() => setShowBridgeDebug(v => !v)}
          walkPath={showBridgeWalkPath} onWalkPath={() => setShowBridgeWalkPath(v => !v)}
          onReset={() => {
            setBridgePlacement({ ...INITIAL_BRIDGE_TEST });
            setShowBridgeDebug(false);
            setShowBridgeWalkPath(false);
          }}
          onDone={() => { setCalibrationMode('land'); setPreviewMode(true); }} />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'land' && (
        <NativeLandCalibrationEditor
          layout={calibrationLayout}
          selectedId={selectedLandId}
          onSelect={setSelectedLandId}
          onNudge={(field, amount) => setCalibrationLayout((current) => current.map((land) =>
            land.id === selectedLandId
              ? { ...land, [field]: field === 'width' ? Math.max(1, land.width + amount) : land[field] + amount }
              : land))}
          onResetSelected={() => setCalibrationLayout((current) => current.map((land) => {
            const initial = GARDEN_LANDS.find((item) => item.id === selectedLandId);
            return land.id === selectedLandId && initial ? { ...initial } : land;
          }))}
          onResetAll={() => setCalibrationLayout(GARDEN_LANDS.map((land) => ({ ...land })))}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'treehouse' && (
        <TreehouseCalibrationEditor
          placement={treehousePlacement}
          onNudge={(field, amount) => setTreehousePlacement((current) => ({
            ...current,
            [field]: field === 'scale' ? Math.max(0.01, current.scale + amount) : current[field] + amount,
          }))}
          onReset={() => setTreehousePlacement({ ...CHECKED_IN_TREEHOUSE })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'swing' && (
        <SwingCalibrationEditor
          placement={swingPlacement}
          onNudge={(field, amount) => setSwingPlacement((current) => ({
            ...current,
            [field]: field === 'scale' ? Math.max(0.01, current.scale + amount) : current[field] + amount,
          }))}
          onReset={() => setSwingPlacement({ ...CHECKED_IN_SWING })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'moon-bed' && (
        <MoonBedMapCalibrationEditor
          placement={moonBedPlacement}
          onNudge={(field, amount) => setMoonBedPlacement((current) => ({
            ...current,
            [field]: field === 'scale' ? Math.max(0.01, current.scale + amount) : current[field] + amount,
          }))}
          onReset={() => setMoonBedPlacement({ ...CHECKED_IN_MOON_BED })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'garden-arch' && (
        <StaticLandmarkCalibrationEditor
          title="Garden Arch"
          placement={gardenArchPlacement}
          exportPlacements={{ gardenArch: gardenArchPlacement, pavilion: pavilionPlacement }}
          onNudge={(field, amount) => setGardenArchPlacement((current) => ({
            ...current,
            [field]: field === 'scale' ? Math.max(0.01, current.scale + amount) : current[field] + amount,
          }))}
          onReset={() => setGardenArchPlacement({ ...CHECKED_IN_GARDEN_ARCH })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'pavilion' && (
        <StaticLandmarkCalibrationEditor
          title="Pavilion"
          placement={pavilionPlacement}
          exportPlacements={{ gardenArch: gardenArchPlacement, pavilion: pavilionPlacement }}
          onNudge={(field, amount) => setPavilionPlacement((current) => ({
            ...current,
            [field]: field === 'scale' ? Math.max(0.01, current.scale + amount) : current[field] + amount,
          }))}
          onReset={() => setPavilionPlacement({ ...CHECKED_IN_PAVILION })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'waterfall' && (
        <WaterfallMapCalibrationEditor
          placement={waterfallPlacement}
          referenceOpacity={waterfallReferenceOpacity}
          onReferenceOpacityChange={setWaterfallReferenceOpacity}
          onExit={() => setCalibrationMode('land')}
          onNudge={(field, amount) => setWaterfallPlacement((current) => ({
            ...current,
            [field]: Number((field === 'scale'
              ? Math.max(0.01, current.scale + amount)
              : field === 'scaleX' || field === 'scaleY'
                ? Math.max(0.9, Math.min(1.1, current[field]+amount)) : current[field] + amount).toFixed(6)),
          }))}
          onReset={() => setWaterfallPlacement({ ...INITIAL_WATERFALL_PLACEMENT })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'tea-set' && (
        <TeaSetMapCalibrationEditor
          placement={teaSetPlacement}
          onNudge={(field, amount) => setTeaSetPlacement((current) => ({
            ...current,
            [field]: field === 'scale' ? Math.max(0.01, current.scale + amount) : current[field] + amount,
          }))}
          onReset={() => setTeaSetPlacement({ ...CHECKED_IN_TEA_SET })}
        />
      )}
      {__DEV__ && calibrationMode === 'impact' && (
        <WaterfallImpactCalibrationEditor
          placement={waterfallImpactPlacement}
          onDone={handleDoneImpactCalibration}
          onFocusImpact={focusImpactView}
          onNudge={(field, amount) => setWaterfallImpactPlacement((current) => ({
            ...current,
            [field]: Number((field === 'rotation' ? current[field] + amount : Math.max(1, current[field] + amount)).toFixed(2)),
          }))}
          onReset={() => setWaterfallImpactPlacement({ ...INITIAL_WATERFALL_IMPACT_PLACEMENT })}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'water-top' && (
        <WaterTopCalibrationEditor
          rawFinal
          placement={waterTopPlacement}
          motionMode={topWaterMotionMode}
          displayPreset={waterTopPreset}
          frontBankEnabled={waterTopFrontBankEnabled}
          onNudge={(field, amount) =>
            setWaterTopPlacement((current) => ({
              ...current,
              [field]:
                field === 'scale' || field === 'cliffScale' || field === 'bankScale'
                  ? Math.max(0.01, Number((current[field] + amount).toFixed(6)))
                  : Number((current[field] + amount).toFixed(6)),
            }))
          }
          onMotionModeChange={setTopWaterMotionMode}
          onDisplayPresetChange={(preset) => {
            setWaterTopPreset(preset);
            if (preset === 'bank' || preset === 'all') {
              setWaterTopFrontBankEnabled(true);
            } else if (preset === 'water-only' || preset === 'cliff') {
              setWaterTopFrontBankEnabled(false);
            }
          }}
          onFrontBankToggle={() => setWaterTopFrontBankEnabled((v) => !v)}
          onReset={() => setWaterTopPlacement({ ...INITIAL_WATER_TOP_PLACEMENT })}
          onExit={() => {
            setCalibrationMode('land');
            setPreviewMode(true);
            resetView();
          }}
        />
      )}
      {__DEV__ && !previewMode && calibrationMode === 'planting-regions' && (
        calSubMode === 'mask-paint' ? (
          <ManualMaskPaintEditor
            selectedMonth={selectedCalMonth}
            tool={paintTool}
            brushSize={paintBrushSize}
            interactionMode={paintInteractionMode}
            opacity={paintOpacity}
            showBaseMask={showBaseMask}
            showAdditions={showAdditions}
            showErasures={showErasures}
            showFinalMask={showFinalMask}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            strokeCount={paintStrokes.length}
            onSelectMonth={(m) => {
              setSelectedCalMonth(m);
              focusCalMonth(m);
            }}
            onChangeTool={setPaintTool}
            onChangeBrushSize={setPaintBrushSize}
            onChangeInteractionMode={setPaintInteractionMode}
            onChangeOpacity={setPaintOpacity}
            onToggleShowBaseMask={() => setShowBaseMask((v) => !v)}
            onToggleShowAdditions={() => setShowAdditions((v) => !v)}
            onToggleShowErasures={() => setShowErasures((v) => !v)}
            onToggleShowFinalMask={() => setShowFinalMask((v) => !v)}
            onUndo={handleUndoMask}
            onRedo={handleRedoMask}
            onClearUnsaved={handleClearUnsavedMask}
            onResetToLockedBase={handleResetMaskToLockedBase}
            onCancel={handleCancelMaskEdit}
            onSaveMask={handleSaveMask}
          />
        ) : (
          <PlantingRegionCalibrationEditor
            calibrationMap={plantingCalibrationMap}
            selectedMonth={selectedCalMonth}
            displayMode={calDisplayMode}
            opacity={calOpacity}
            dragMode={calDragMode}
            showLandBounds={showLandBounds}
            onSelectMonth={(m) => {
              setSelectedCalMonth(m);
              focusCalMonth(m);
            }}
            onChangeDisplayMode={setCalDisplayMode}
            onChangeOpacity={setCalOpacity}
            onChangeDragMode={setCalDragMode}
            onToggleLandBounds={() => setShowLandBounds((v) => !v)}
            onNudge={handleCalibrationNudge}
            onResetSelected={handleResetSelectedMonth}
            onResetAll={handleResetAllMonths}
            onSave={handleSaveCalibration}
            onDone={() => {
              setCalibrationMode('land');
              setPreviewMode(true);
            }}
            onOpenMaskEditor={() => setCalSubMode('mask-paint')}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: GARDEN_WATER_COLOR },
  controls: { position: 'absolute', top: 8, left: 8, right: 8, padding: 8, gap: 6, backgroundColor: '#FFFFFFE8' },
  controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  controlButton: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 6, backgroundColor: '#D8DDDA' },
  controlButtonEnabled: { backgroundColor: '#245B45' },
  controlButtonText: { color: '#172219', fontSize: 11, fontWeight: '600' },
  controlButtonTextEnabled: { color: '#FFFFFF' },
  diagnosticText: { color: '#172219', fontSize: 11 },
  floatingToggleButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#1E2B22E6',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: '#4A6B56',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  floatingToggleText: {
    color: '#E8F5EE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

function ToggleButton({ label, enabled, onPress }: { label: string; enabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: enabled }} onPress={onPress}
      style={[styles.controlButton, enabled && styles.controlButtonEnabled]}>
      <Text style={[styles.controlButtonText, enabled && styles.controlButtonTextEnabled]}>{label}</Text>
    </Pressable>
  );
}

function WaterfallImpactDebugShape({ placement }: { placement: WaterfallImpactPlacement }) {
  return (
    <Group
      transform={[
        { translateX: placement.x },
        { translateY: placement.y },
        { rotate: (placement.rotation * Math.PI) / 180 },
        { scaleX: placement.width / 110 },
        { scaleY: placement.height / 57 },
      ]}
    >
      {/* Obvious bright magenta diagnostic footprint */}
      <Rect
        x={-57}
        y={-18}
        width={145}
        height={54}
        color="#FF00FF"
        opacity={0.9}
      />
      {/* DEV crosshair at underlay rendered center (local 0,0 -> world 1040, 250) */}
      <Path
        path="M -60 0 L 60 0 M 0 -35 L 0 35"
        color="#00FFFF"
        style="stroke"
        strokeWidth={3}
      />
      <Circle cx={0} cy={0} r={5} color="#FFFFFF" />
      <Circle cx={0} cy={0} r={2} color="#000000" />
    </Group>
  );
}

export default function GardenScene(props: GardenSceneProps = {}) {
  return (
    <PlantingProvider>
      <GardenSceneContent {...props} />
    </PlantingProvider>
  );
}
