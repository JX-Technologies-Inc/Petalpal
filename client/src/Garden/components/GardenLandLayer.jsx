import { useRef } from "react";
import { MIN_LAND_WIDTH } from "../hooks/useGardenLayoutEditor";

export default function LandBaseLayer({
  layout,
  cameraZoom,
  editEnabled,
  selectedLandKey,
  showDebugLabels = false,
  onSelectLand,
  onUpdateLand
}) {
  const interactionRef = useRef(null);

  const beginInteraction = (event, landKey, type) => {
    if (!editEnabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectLand(landKey);

    const land = layout[landKey];
    const rect = event.currentTarget
      .closest(".garden-map-land")
      .getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    interactionRef.current = {
      type,
      landKey,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLand: { ...land },
      center,
      startDistance: Math.max(
        1,
        Math.hypot(event.clientX - center.x, event.clientY - center.y)
      ),
      startAngle: Math.atan2(
        event.clientY - center.y,
        event.clientX - center.x
      )
    };
  };

  const continueInteraction = (event) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    if (interaction.type === "move") {
      onUpdateLand(interaction.landKey, {
        x: interaction.startLand.x +
          (event.clientX - interaction.startClientX) / cameraZoom,
        y: interaction.startLand.y +
          (event.clientY - interaction.startClientY) / cameraZoom
      });
      return;
    }

    if (interaction.type === "resize") {
      const distance = Math.hypot(
        event.clientX - interaction.center.x,
        event.clientY - interaction.center.y
      );
      onUpdateLand(interaction.landKey, {
        width: Math.max(
          MIN_LAND_WIDTH,
          interaction.startLand.width *
            (distance / interaction.startDistance)
        )
      });
      return;
    }

    const angle = Math.atan2(
      event.clientY - interaction.center.y,
      event.clientX - interaction.center.x
    );
    onUpdateLand(interaction.landKey, {
      rotation: interaction.startLand.rotation +
        (angle - interaction.startAngle) * 180 / Math.PI
    });
  };

  const endInteraction = (event) => {
    if (interactionRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    interactionRef.current = null;
  };

  return (
    <div className="garden-map-land-layer" aria-label="Garden land">
      {Object.entries(layout).map(([landKey, land]) => (
        <div
          className={`garden-map-land ${
            editEnabled ? "garden-map-land-editable" : ""
          } ${selectedLandKey === landKey ? "garden-map-land-selected" : ""}`}
          key={landKey}
          style={{
            left: land.x,
            top: land.y,
            width: land.width,
            zIndex: land.zIndex,
            transform: `rotate(${land.rotation}deg)`
          }}
          onPointerDown={(event) => beginInteraction(event, landKey, "move")}
          onPointerMove={continueInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >
          <img
            src={land.src}
            alt=""
            draggable="false"
          />
          {showDebugLabels && (
            <span className="garden-map-land-label">{land.id}</span>
          )}
          {editEnabled && selectedLandKey === landKey && (
            <>
              {["nw", "ne", "se", "sw"].map((corner) => (
                <button
                  type="button"
                  key={corner}
                  className={`garden-map-resize-handle garden-map-resize-${corner}`}
                  aria-label={`Resize ${landKey} from ${corner}`}
                  onPointerDown={(event) => beginInteraction(event, landKey, "resize")}
                  onPointerMove={continueInteraction}
                  onPointerUp={endInteraction}
                  onPointerCancel={endInteraction}
                />
              ))}
              <button
                type="button"
                className="garden-map-rotation-handle"
                aria-label={`Rotate ${landKey}`}
                onPointerDown={(event) => beginInteraction(event, landKey, "rotate")}
                onPointerMove={continueInteraction}
                onPointerUp={endInteraction}
                onPointerCancel={endInteraction}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
