import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MIN_ZOOM = 0.35;
const DEFAULT_MAX_ZOOM = 1.8;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

export default function useGardenViewport({
  worldWidth,
  worldHeight,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  initialZoom = 0.6
}) {
  const viewportRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: initialZoom });
  const viewportSizeRef = useRef({ width: 0, height: 0 });

  const [camera, setCameraState] = useState(cameraRef.current);
  const [pointerWorld, setPointerWorld] = useState(null);

  const constrainCamera = useCallback(
    (candidate, viewportSize = viewportSizeRef.current) => {
      const zoom = clamp(candidate.zoom, minZoom, maxZoom);
      const scaledWidth = worldWidth * zoom;
      const scaledHeight = worldHeight * zoom;

      const minimumX = Math.min(0, viewportSize.width - scaledWidth);
      const minimumY = Math.min(0, viewportSize.height - scaledHeight);
      const maximumX = scaledWidth < viewportSize.width
        ? (viewportSize.width - scaledWidth) / 2
        : 0;
      const maximumY = scaledHeight < viewportSize.height
        ? (viewportSize.height - scaledHeight) / 2
        : 0;

      return {
        x: scaledWidth < viewportSize.width
          ? maximumX
          : clamp(candidate.x, minimumX, maximumX),
        y: scaledHeight < viewportSize.height
          ? maximumY
          : clamp(candidate.y, minimumY, maximumY),
        zoom
      };
    },
    [maxZoom, minZoom, worldHeight, worldWidth]
  );

  const setCamera = useCallback(
    (nextCamera) => {
      const resolved = typeof nextCamera === "function"
        ? nextCamera(cameraRef.current)
        : nextCamera;
      const constrained = constrainCamera(resolved);

      cameraRef.current = constrained;
      setCameraState(constrained);
      return constrained;
    },
    [constrainCamera]
  );

  const clientToLocal = useCallback((clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const localToWorld = useCallback((localPoint, sourceCamera = cameraRef.current) => ({
    x: (localPoint.x - sourceCamera.x) / sourceCamera.zoom,
    y: (localPoint.y - sourceCamera.y) / sourceCamera.zoom
  }), []);

  const updatePointerWorld = useCallback(
    (clientX, clientY) => {
      const localPoint = clientToLocal(clientX, clientY);
      if (!localPoint) return;

      const worldPoint = localToWorld(localPoint);
      setPointerWorld({
        x: clamp(worldPoint.x, 0, worldWidth),
        y: clamp(worldPoint.y, 0, worldHeight)
      });
    },
    [clientToLocal, localToWorld, worldHeight, worldWidth]
  );

  const zoomAt = useCallback(
    (nextZoom, localPoint, anchorWorld = localToWorld(localPoint)) => {
      setCamera({
        x: localPoint.x - anchorWorld.x * nextZoom,
        y: localPoint.y - anchorWorld.y * nextZoom,
        zoom: nextZoom
      });
    },
    [localToWorld, setCamera]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const updateSize = () => {
      const nextSize = {
        width: viewport.clientWidth,
        height: viewport.clientHeight
      };
      viewportSizeRef.current = nextSize;

      const constrained = constrainCamera(cameraRef.current, nextSize);
      cameraRef.current = constrained;
      setCameraState(constrained);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [constrainCamera]);

  const onPointerDown = useCallback((event) => {
    const localPoint = clientToLocal(event.clientX, event.clientY);
    if (!localPoint) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, localPoint);

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        type: "pan",
        startPoint: localPoint,
        startCamera: cameraRef.current
      };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      const midpoint = getMidpoint(first, second);
      gestureRef.current = {
        type: "pinch",
        startDistance: Math.max(1, getDistance(first, second)),
        startZoom: cameraRef.current.zoom,
        anchorWorld: localToWorld(midpoint)
      };
    }
  }, [clientToLocal, localToWorld]);

  const onPointerMove = useCallback((event) => {
    updatePointerWorld(event.clientX, event.clientY);

    if (!pointersRef.current.has(event.pointerId)) return;
    const localPoint = clientToLocal(event.clientX, event.clientY);
    if (!localPoint) return;
    pointersRef.current.set(event.pointerId, localPoint);

    const gesture = gestureRef.current;
    if (pointersRef.current.size === 1 && gesture?.type === "pan") {
      setCamera({
        x: gesture.startCamera.x + localPoint.x - gesture.startPoint.x,
        y: gesture.startCamera.y + localPoint.y - gesture.startPoint.y,
        zoom: gesture.startCamera.zoom
      });
    } else if (pointersRef.current.size >= 2) {
      const [first, second] = [...pointersRef.current.values()];
      const midpoint = getMidpoint(first, second);
      const distance = Math.max(1, getDistance(first, second));
      const nextZoom = clamp(
        gesture.startZoom * (distance / gesture.startDistance),
        minZoom,
        maxZoom
      );
      zoomAt(nextZoom, midpoint, gesture.anchorWorld);
    }
  }, [clientToLocal, maxZoom, minZoom, setCamera, updatePointerWorld, zoomAt]);

  const endPointer = useCallback((event) => {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 1) {
      const [remainingPoint] = pointersRef.current.values();
      gestureRef.current = {
        type: "pan",
        startPoint: remainingPoint,
        startCamera: cameraRef.current
      };
    } else if (pointersRef.current.size === 0) {
      gestureRef.current = null;
    }
  }, []);

  const onWheel = useCallback((event) => {
    event.preventDefault();
    const localPoint = clientToLocal(event.clientX, event.clientY);
    if (!localPoint) return;

    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(
      clamp(cameraRef.current.zoom * zoomFactor, minZoom, maxZoom),
      localPoint
    );
    updatePointerWorld(event.clientX, event.clientY);
  }, [clientToLocal, maxZoom, minZoom, updatePointerWorld, zoomAt]);

  return {
    viewportRef,
    camera,
    pointerWorld,
    viewportHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: (event) => {
        if (event.pointerType === "mouse" && event.buttons === 0) {
          setPointerWorld(null);
        }
      },
      onWheel
    }
  };
}
