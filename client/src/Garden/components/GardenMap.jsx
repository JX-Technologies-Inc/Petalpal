import LandBaseLayer from "./GardenLandLayer";
import GardenLayoutEditor from "./GardenLayoutEditor";
import useGardenViewport from "../hooks/useGardenViewport";
import useGardenLayoutEditor from "../hooks/useGardenLayoutEditor";
import "../styles/garden-map.css";

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1800;

function WaterBackground() {
  return <div className="garden-map-water" aria-hidden="true" />;
}

function DebugLayer() {
  return <div className="garden-map-world-boundary" aria-hidden="true" />;
}

function GardenWorld({ camera, editor }) {
  return (
    <div
      className="garden-map-world"
      style={{
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
      }}
    >
      <WaterBackground />
      <LandBaseLayer
        layout={editor.layout}
        cameraZoom={camera.zoom}
        editEnabled={editor.editEnabled}
        selectedLandKey={editor.selectedLandKey}
        showDebugLabels={editor.showDebug}
        onSelectLand={editor.setSelectedLandKey}
        onUpdateLand={editor.updateLand}
      />
      {editor.showDebug && <DebugLayer />}
    </div>
  );
}

function DebugReadout({ camera, pointerWorld }) {
  return (
    <aside className="garden-map-debug-readout" aria-live="polite">
      <strong>Garden World</strong>
      <span>World: {WORLD_WIDTH} × {WORLD_HEIGHT}</span>
      <span>Pan: {camera.x.toFixed(1)}, {camera.y.toFixed(1)}</span>
      <span>Zoom: {camera.zoom.toFixed(3)}×</span>
      <span>
        World pointer: {pointerWorld
          ? `${pointerWorld.x.toFixed(0)}, ${pointerWorld.y.toFixed(0)}`
          : "—"}
      </span>
    </aside>
  );
}

export default function GardenMap() {
  const isDevelopment = import.meta.env.DEV;
  const editor = useGardenLayoutEditor();
  const {
    viewportRef,
    camera,
    pointerWorld,
    viewportHandlers
  } = useGardenViewport({
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT
  });

  return (
    <section className="garden-map" aria-label="Pannable garden world">
      <div
        ref={viewportRef}
        className="garden-map-viewport"
        {...viewportHandlers}
      >
        <GardenWorld
          camera={camera}
          editor={{
            ...editor,
            editEnabled: isDevelopment && editor.editEnabled,
            showDebug: isDevelopment && editor.showDebug
          }}
        />
        {isDevelopment && editor.showDebug && (
          <DebugReadout camera={camera} pointerWorld={pointerWorld} />
        )}
        {isDevelopment && <GardenLayoutEditor editor={editor} />}
        <p className="garden-map-help">Drag to pan · Wheel or pinch to zoom</p>
      </div>
    </section>
  );
}
