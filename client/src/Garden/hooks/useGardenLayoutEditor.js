import { useCallback, useEffect, useMemo, useState } from "react";
import { GARDEN_LAND_LAYOUT } from "../config/gardenLandLayout";

export const GARDEN_LAYOUT_STORAGE_KEY = "petalpal-garden-layout-v1";
export const MIN_LAND_WIDTH = 120;

function cloneDefaultLayout() {
  return Object.fromEntries(
    Object.entries(GARDEN_LAND_LAYOUT).map(([key, land]) => [
      key,
      { ...land }
    ])
  );
}

function loadSavedLayout() {
  const defaults = cloneDefaultLayout();

  try {
    const saved = JSON.parse(
      localStorage.getItem(GARDEN_LAYOUT_STORAGE_KEY)
    );

    if (!saved || typeof saved !== "object") return defaults;

    return Object.fromEntries(
      Object.entries(defaults).map(([key, defaultLand]) => {
        const savedLand = saved[key] || {};
        const numericValue = (field) =>
          Number.isFinite(Number(savedLand[field]))
            ? Number(savedLand[field])
            : defaultLand[field];

        return [
          key,
          {
            ...defaultLand,
            x: numericValue("x"),
            y: numericValue("y"),
            width: Math.max(MIN_LAND_WIDTH, numericValue("width")),
            rotation: numericValue("rotation")
          }
        ];
      })
    );
  } catch {
    return defaults;
  }
}

function serializeLayout(layout) {
  const entries = Object.entries(layout).map(([key, land]) => `  ${key}: {
    id: '${land.id}',
    src: '${land.src}',
    x: ${Math.round(land.x)},
    y: ${Math.round(land.y)},
    width: ${Math.round(land.width)},
    rotation: ${Number(land.rotation.toFixed(2))},
    zIndex: ${land.zIndex},
  }`);

  return `export const GARDEN_LAND_LAYOUT = {\n${entries.join(",\n\n")}\n};`;
}

export default function useGardenLayoutEditor() {
  const [layout, setLayout] = useState(loadSavedLayout);
  const [selectedLandKey, setSelectedLandKey] = useState(null);
  const [editEnabled, setEditEnabled] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const persistLayout = useCallback((nextLayout) => {
    localStorage.setItem(
      GARDEN_LAYOUT_STORAGE_KEY,
      JSON.stringify(nextLayout)
    );
  }, []);

  const updateLand = useCallback((landKey, update) => {
    setLayout((current) => {
      const currentLand = current[landKey];
      if (!currentLand) return current;

      const patch = typeof update === "function"
        ? update(currentLand)
        : update;
      const next = {
        ...current,
        [landKey]: {
          ...currentLand,
          ...patch,
          width: Math.max(
            MIN_LAND_WIDTH,
            Number(patch.width ?? currentLand.width)
          )
        }
      };

      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const saveLayout = useCallback(() => {
    persistLayout(layout);
  }, [layout, persistLayout]);

  const resetSelected = useCallback(() => {
    if (!selectedLandKey) return;
    updateLand(selectedLandKey, { ...GARDEN_LAND_LAYOUT[selectedLandKey] });
  }, [selectedLandKey, updateLand]);

  const resetAll = useCallback(() => {
    setLayout(cloneDefaultLayout());
    setSelectedLandKey(null);
    localStorage.removeItem(GARDEN_LAYOUT_STORAGE_KEY);
  }, []);

  const exportedLayout = useMemo(
    () => serializeLayout(layout),
    [layout]
  );

  const copyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportedLayout);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed — select the export text instead");
    }
  }, [exportedLayout]);

  useEffect(() => {
    if (!copyStatus) return undefined;
    const timer = window.setTimeout(() => setCopyStatus(""), 1800);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (!editEnabled || !selectedLandKey) return undefined;

    function handleKeyDown(event) {
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName?.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      const movements = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }
      };
      const movement = movements[event.key];
      if (!movement) return;

      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      updateLand(selectedLandKey, (land) => ({
        x: land.x + movement.x * amount,
        y: land.y + movement.y * amount
      }));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editEnabled, selectedLandKey, updateLand]);

  return {
    layout,
    selectedLandKey,
    selectedLand: selectedLandKey ? layout[selectedLandKey] : null,
    editEnabled,
    showDebug,
    copyStatus,
    exportedLayout,
    setSelectedLandKey,
    setEditEnabled,
    setShowDebug,
    updateLand,
    saveLayout,
    resetSelected,
    resetAll,
    copyConfig
  };
}
