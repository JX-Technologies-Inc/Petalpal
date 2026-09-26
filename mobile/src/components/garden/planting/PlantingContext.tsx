import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  FlowerPlacementRecord,
  addOrUpdateFlowerPlacement,
  incrementFlowerSupport,
  loadFlowerPlacements,
  resetFlowerPlacements,
} from './plantingPersistence';
import {
  ValidationResult,
  validateFlowerPlacement,
} from './placementValidator';
import { MONTH_CENTROIDS } from './plantingRegionData';
import { getCalibratedCentroid } from './plantingRegionCalibration';

export type PlantingMode = 'normal' | 'planting' | 'adjusting';

interface PlantingContextValue {
  placements: FlowerPlacementRecord[];
  activeMode: PlantingMode;
  targetFlower: FlowerPlacementRecord | null;
  previewCoords: { worldX: number; worldY: number } | null;
  validationResult: ValidationResult | null;
  selectedFlower: FlowerPlacementRecord | null;
  isSaving: boolean;
  // DEV Toggles
  showDevPlantingRegions: boolean;
  showDevFootprints: boolean;
  showDevHitboxes: boolean;
  showPlacementDebug: boolean;

  // Actions
  startPlanting: (
    flower: Partial<FlowerPlacementRecord> & { flowerId: string; month: number; flowerName: string }
  ) => void;
  startAdjusting: (flower: FlowerPlacementRecord) => void;
  updatePreview: (worldX: number, worldY: number) => void;
  confirmPlacement: () => Promise<boolean>;
  cancelPlacement: () => void;
  openFlowerDetail: (flower: FlowerPlacementRecord) => void;
  closeFlowerDetail: () => void;
  supportFlower: (flowerId: string) => Promise<void>;
  resetAllPlacements: () => Promise<void>;

  setShowDevPlantingRegions: (fn: (v: boolean) => boolean) => void;
  setShowDevFootprints: (fn: (v: boolean) => boolean) => void;
  setShowDevHitboxes: (fn: (v: boolean) => boolean) => void;
  setShowPlacementDebug: (fn: (v: boolean) => boolean) => void;
}

export const PlantingContext = createContext<PlantingContextValue | null>(null);

export interface PlantingProviderProps {
  children: React.ReactNode;
  value?: PlantingContextValue;
}

export function PlantingProvider({ children, value }: PlantingProviderProps) {
  // If an existing context value is provided (e.g. bridging across React Native Skia Canvas boundary),
  // re-inject the exact same context value so that descendant nodes share the exact same state.
  if (value) {
    return (
      <PlantingContext.Provider value={value}>
        {children}
      </PlantingContext.Provider>
    );
  }

  return <PlantingProviderRoot>{children}</PlantingProviderRoot>;
}

function PlantingProviderRoot({ children }: { children: React.ReactNode }) {
  const [placements, setPlacements] = useState<FlowerPlacementRecord[]>([]);
  const [activeMode, setActiveMode] = useState<PlantingMode>('normal');
  const [targetFlower, setTargetFlower] = useState<FlowerPlacementRecord | null>(null);
  const [previewCoords, setPreviewCoords] = useState<{ worldX: number; worldY: number } | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFlower, setSelectedFlower] = useState<FlowerPlacementRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // DEV Toggles
  const [showDevPlantingRegions, setShowDevPlantingRegions] = useState(false);
  const [showDevFootprints, setShowDevFootprints] = useState(false);
  const [showDevHitboxes, setShowDevHitboxes] = useState(false);
  const [showPlacementDebug, setShowPlacementDebug] = useState(false);

  // Load placements on mount
  useEffect(() => {
    let mounted = true;
    loadFlowerPlacements().then((loaded) => {
      if (mounted) setPlacements(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const validateAt = useCallback(
    (
      worldX: number,
      worldY: number,
      month: number,
      flowerName?: string,
      ignorePlacementId?: string
    ) => {
      return validateFlowerPlacement({
        flowerId: targetFlower?.flowerId || 'preview-flower',
        month,
        worldX,
        worldY,
        existingPlacements: placements,
        ignorePlacementId,
        flowerName,
      });
    },
    [placements, targetFlower]
  );

  const startPlanting = useCallback(
    (flower: Partial<FlowerPlacementRecord> & { flowerId: string; month: number; flowerName: string }) => {
      // Pick initial preview at calibrated month centroid or fallback
      const centroid = getCalibratedCentroid(flower.month) || MONTH_CENTROIDS[flower.month] || { x: 1200, y: 900 };
      const fullRecord: FlowerPlacementRecord = {
        id: flower.id || `flower-${flower.flowerId}`,
        flowerId: flower.flowerId,
        journalEntryId: flower.journalEntryId || `entry-${flower.flowerId}`,
        plantedDate: flower.plantedDate || new Date().toISOString(),
        month: flower.month,
        worldX: centroid.x,
        worldY: centroid.y,
        scale: flower.scale ?? 1,
        rotation: flower.rotation ?? 0,
        placementVersion: 1,
        flowerName: flower.flowerName,
        speciesCode: flower.speciesCode,
        mood: flower.mood || 'Happy',
        supportCount: flower.supportCount ?? 0,
        notes: flower.notes || '',
      };

      setTargetFlower(fullRecord);
      setPreviewCoords({ worldX: centroid.x, worldY: centroid.y });
      setActiveMode('planting');
      setSelectedFlower(null);

      // Validate at initial centroid
      const res = validateFlowerPlacement({
        flowerId: fullRecord.flowerId,
        month: fullRecord.month,
        worldX: centroid.x,
        worldY: centroid.y,
        existingPlacements: placements,
        flowerName: fullRecord.flowerName,
      });
      setValidationResult(res);
    },
    [placements]
  );

  const startAdjusting = useCallback(
    (flower: FlowerPlacementRecord) => {
      setTargetFlower(flower);
      setPreviewCoords({ worldX: flower.worldX, worldY: flower.worldY });
      setActiveMode('adjusting');
      setSelectedFlower(null);

      const res = validateFlowerPlacement({
        flowerId: flower.flowerId,
        month: flower.month,
        worldX: flower.worldX,
        worldY: flower.worldY,
        existingPlacements: placements,
        ignorePlacementId: flower.id,
        flowerName: flower.flowerName,
      });
      setValidationResult(res);
    },
    [placements]
  );

  const updatePreview = useCallback(
    (worldX: number, worldY: number) => {
      if (!targetFlower || activeMode === 'normal') return;
      setPreviewCoords({ worldX, worldY });

      const res = validateFlowerPlacement({
        flowerId: targetFlower.flowerId,
        month: targetFlower.month,
        worldX,
        worldY,
        existingPlacements: placements,
        ignorePlacementId: activeMode === 'adjusting' ? targetFlower.id : undefined,
        flowerName: targetFlower.flowerName,
      });
      setValidationResult(res);
    },
    [activeMode, targetFlower, placements]
  );

  const confirmPlacement = useCallback(async (): Promise<boolean> => {
    if (!targetFlower || !previewCoords || !validationResult?.isValid || isSaving) {
      return false;
    }

    setIsSaving(true);
    try {
      const committed: FlowerPlacementRecord = {
        ...targetFlower,
        worldX: previewCoords.worldX,
        worldY: previewCoords.worldY,
        placementVersion: 1,
      };

      const updated = await addOrUpdateFlowerPlacement(committed);
      setPlacements(updated);
      setActiveMode('normal');
      setTargetFlower(null);
      setPreviewCoords(null);
      setValidationResult(null);
      return true;
    } catch (err) {
      console.error('[PlantingContext] Failed to commit placement:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [targetFlower, previewCoords, validationResult, isSaving]);

  const cancelPlacement = useCallback(() => {
    setActiveMode('normal');
    setTargetFlower(null);
    setPreviewCoords(null);
    setValidationResult(null);
  }, []);

  const openFlowerDetail = useCallback((flower: FlowerPlacementRecord) => {
    setSelectedFlower(flower);
  }, []);

  const closeFlowerDetail = useCallback(() => {
    setSelectedFlower(null);
  }, []);

  const supportFlower = useCallback(async (flowerId: string) => {
    const updated = await incrementFlowerSupport(flowerId);
    setPlacements(updated);
    setSelectedFlower((cur) => {
      if (!cur) return null;
      if (cur.flowerId === flowerId || cur.id === flowerId) {
        return { ...cur, supportCount: (cur.supportCount || 0) + 1 };
      }
      return cur;
    });
  }, []);

  const resetAllPlacements = useCallback(async () => {
    const defaults = await resetFlowerPlacements();
    setPlacements(defaults);
    cancelPlacement();
  }, [cancelPlacement]);

  return (
    <PlantingContext.Provider
      value={{
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
      }}
    >
      {children}
    </PlantingContext.Provider>
  );
}

export function usePlanting() {
  const ctx = useContext(PlantingContext);
  if (!ctx) {
    throw new Error('usePlanting must be used within a PlantingProvider');
  }
  return ctx;
}
