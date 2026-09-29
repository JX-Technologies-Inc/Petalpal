import { useEffect, useRef, useState } from "react";

const PANEL_STORAGE_KEY = "petalpal-garden-editor-panel-v1";

function loadPanelState() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY));
    return {
      collapsed: true,
      position: saved?.position &&
        Number.isFinite(saved.position.x) &&
        Number.isFinite(saved.position.y)
        ? saved.position
        : null
    };
  } catch {
    return { collapsed: true, position: null };
  }
}

export default function GardenLayoutEditor({ editor }) {
  const exportRef = useRef(null);
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [panelState, setPanelState] = useState(loadPanelState);
  const [showExactJson, setShowExactJson] = useState(false);
  const canExportExactJson = import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("gardenPreview") === "1";
  // Export live effective values, including defaults merged with browser overrides.
  // Do not round these values or write anything back to localStorage.
  const exactLayoutJson = JSON.stringify({
    worldWidth: 2400,
    worldHeight: 1800,
    layout: editor.layout
  }, null, 2);
  const {
    selectedLandKey,
    selectedLand,
    editEnabled,
    showDebug,
    copyStatus,
    exportedLayout,
    setEditEnabled,
    setShowDebug,
    updateLand,
    saveLayout,
    resetSelected,
    resetAll,
    copyConfig
  } = editor;

  const updatePanelState = (update) => {
    setPanelState((current) => {
      const next = typeof update === "function" ? update(current) : update;
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleCollapsed = () => {
    updatePanelState((current) => ({
      ...current,
      collapsed: !current.collapsed
    }));
  };

  useEffect(() => {
    function handleKeyDown(event) {
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName?.toLowerCase();
      if (
        event.key.toLowerCase() !== "e" ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        activeElement?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      toggleCollapsed();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const beginPanelDrag = (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const panelRect = panelRef.current.getBoundingClientRect();
    const viewportRect = panelRef.current.offsetParent.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panelX: panelRect.left - viewportRect.left,
      panelY: panelRect.top - viewportRect.top,
      viewportWidth: viewportRect.width,
      viewportHeight: viewportRect.height
    };
  };

  const movePanel = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const panelWidth = panelRef.current.offsetWidth;
    const panelHeight = panelRef.current.offsetHeight;
    const x = Math.max(
      0,
      Math.min(
        drag.viewportWidth - panelWidth,
        drag.panelX + event.clientX - drag.startX
      )
    );
    const y = Math.max(
      0,
      Math.min(
        drag.viewportHeight - panelHeight,
        drag.panelY + event.clientY - drag.startY
      )
    );

    updatePanelState((current) => ({ ...current, position: { x, y } }));
  };

  const endPanelDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const updateNumericField = (field, value) => {
    const number = Number(value);
    if (!selectedLandKey || !Number.isFinite(number)) return;
    updateLand(selectedLandKey, { [field]: number });
  };

  return (
    <aside
      ref={panelRef}
      className={`garden-layout-editor ${
        panelState.collapsed ? "garden-layout-editor-collapsed" : ""
      }`}
      aria-label="Garden layout editor"
      style={panelState.position ? {
        left: panelState.position.x,
        top: panelState.position.y,
        right: "auto",
        bottom: "auto"
      } : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {panelState.collapsed ? (
        <button
          type="button"
          className="garden-editor-expand-button"
          onClick={toggleCollapsed}
        >
          Edit Land Layout
        </button>
      ) : (
        <>
      <div
        className="garden-editor-header"
        onPointerDown={beginPanelDrag}
        onPointerMove={movePanel}
        onPointerUp={endPanelDrag}
        onPointerCancel={endPanelDrag}
      >
        <h2>Garden Layout Editor</h2>
        <button type="button" onClick={toggleCollapsed}>Collapse</button>
      </div>

      <label className="garden-editor-toggle">
        <input
          type="checkbox"
          checked={editEnabled}
          onChange={(event) => setEditEnabled(event.target.checked)}
        />
        Edit layout
      </label>

      <label className="garden-editor-toggle">
        <input
          type="checkbox"
          checked={showDebug}
          onChange={(event) => setShowDebug(event.target.checked)}
        />
        Show debug labels
      </label>

      <p className="garden-editor-selected">
        Selected: <strong>{selectedLandKey || "None"}</strong>
      </p>

      {selectedLand && (
        <div className="garden-editor-fields">
          {[
            ["x", "X"],
            ["y", "Y"],
            ["width", "Width"],
            ["rotation", "Rotation"]
          ].map(([field, label]) => (
            <label key={field}>
              <span>{label}</span>
              <input
                type="number"
                step={field === "rotation" ? "0.1" : "1"}
                min={field === "width" ? "120" : undefined}
                value={Number(selectedLand[field].toFixed(2))}
                onChange={(event) => updateNumericField(field, event.target.value)}
              />
            </label>
          ))}

          <label className="garden-editor-rotation-slider">
            <span>Rotate</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="0.5"
              value={selectedLand.rotation}
              onChange={(event) =>
                updateNumericField("rotation", event.target.value)
              }
            />
          </label>
        </div>
      )}

      <div className="garden-editor-actions">
        <button type="button" onClick={saveLayout}>Save layout</button>
        <button
          type="button"
          onClick={resetSelected}
          disabled={!selectedLand}
        >
          Reset selected
        </button>
        <button type="button" onClick={resetAll}>Reset all</button>
        <button
          type="button"
          onClick={() => {
            setShowExactJson(false);
            exportRef.current?.focus();
            exportRef.current?.select();
          }}
        >
          Export layout
        </button>
        <button type="button" onClick={copyConfig}>Copy config</button>
        {canExportExactJson && (
          <button type="button" onClick={() => setShowExactJson(true)}>
            Export current layout JSON
          </button>
        )}
      </div>

      {copyStatus && <p className="garden-editor-copy-status">{copyStatus}</p>}

      <label className="garden-editor-export">
        <span>{showExactJson ? "Exact current layout JSON — copy this for native migration" : "Export layout"}</span>
        <textarea ref={exportRef} readOnly
          value={showExactJson ? exactLayoutJson : exportedLayout} rows="8"
          onFocus={(event) => event.target.select()} />
      </label>
        </>
      )}
    </aside>
  );
}
