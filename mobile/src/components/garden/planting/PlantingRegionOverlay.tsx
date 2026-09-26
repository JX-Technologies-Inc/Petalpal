import { Circle, Group, Image, Path, Rect, useImage } from '@shopify/react-native-skia';
import {
  MONTH_REGION_METAS,
} from './plantingRegionData';
import {
  MonthRegionCalibration,
  PLANTING_REGION_CALIBRATION,
  getCalibratedCentroid,
  getLandGeometry,
  getParentLand,
} from './plantingRegionCalibration';
import { GARDEN_LANDS, type GardenLandLayout } from '../gardenMapLayout';
import {
  MaskStroke,
  MaskTool,
  getMonthMaskRefinement,
} from './plantingMaskRefinement';


const NORMAL_MONTH_IMAGES: Record<number, any> = {
  1: require('@/assets/garden/planting/months/month-01.png'),
  2: require('@/assets/garden/planting/months/month-02.png'),
  3: require('@/assets/garden/planting/months/month-03.png'),
  4: require('@/assets/garden/planting/months/month-04.png'),
  5: require('@/assets/garden/planting/months/month-05.png'),
  6: require('@/assets/garden/planting/months/month-06.png'),
  7: require('@/assets/garden/planting/months/month-07.png'),
  8: require('@/assets/garden/planting/months/month-08.png'),
  9: require('@/assets/garden/planting/months/month-09.png'),
  10: require('@/assets/garden/planting/months/month-10.png'),
  11: require('@/assets/garden/planting/months/month-11.png'),
  12: require('@/assets/garden/planting/months/month-12.png'),
};

const DEBUG_MONTH_IMAGES: Record<number, any> = {
  1: require('@/assets/garden/planting/months/month-debug-01.png'),
  2: require('@/assets/garden/planting/months/month-debug-02.png'),
  3: require('@/assets/garden/planting/months/month-debug-03.png'),
  4: require('@/assets/garden/planting/months/month-debug-04.png'),
  5: require('@/assets/garden/planting/months/month-debug-05.png'),
  6: require('@/assets/garden/planting/months/month-debug-06.png'),
  7: require('@/assets/garden/planting/months/month-debug-07.png'),
  8: require('@/assets/garden/planting/months/month-debug-08.png'),
  9: require('@/assets/garden/planting/months/month-debug-09.png'),
  10: require('@/assets/garden/planting/months/month-debug-10.png'),
  11: require('@/assets/garden/planting/months/month-debug-11.png'),
  12: require('@/assets/garden/planting/months/month-debug-12.png'),
};


interface StrokeGroup {
  id: string;
  tool: MaskTool;
  radius: number;
  strokes: MaskStroke[];
}

function groupConsecutiveStrokes(strokes: MaskStroke[]): StrokeGroup[] {
  const groups: StrokeGroup[] = [];
  for (const s of strokes) {
    if (!s.points || s.points.length === 0) continue;
    const current = groups[groups.length - 1];
    if (current && current.tool === s.tool && current.radius === s.radius) {
      current.strokes.push(s);
    } else {
      groups.push({
        id: s.id,
        tool: s.tool,
        radius: s.radius,
        strokes: [s],
      });
    }
  }
  return groups;
}

function strokeGroupToPath(group: StrokeGroup, landX: number, landY: number): string {
  const subpaths: string[] = [];
  for (let i = 0; i < group.strokes.length; i++) {
    const s = group.strokes[i];
    const pts = s.points;
    if (!pts || pts.length === 0) continue;

    // Check if the start of this stroke connects to the end of the previous stroke
    if (i > 0) {
      const prev = group.strokes[i - 1];
      const prevEnd = prev.points[prev.points.length - 1];
      const curStart = pts[0];
      const dx = curStart.x - prevEnd.x;
      const dy = curStart.y - prevEnd.y;
      // If the two strokes touch or overlap (within diameter), bridge them directly!
      if (dx * dx + dy * dy <= (s.radius * 2) * (s.radius * 2)) {
        for (let j = 0; j < pts.length; j++) {
          subpaths.push(`L ${landX + pts[j].x} ${landY + pts[j].y}`);
        }
        continue;
      }
    }

    // Otherwise start a new subpath
    if (pts.length === 1) {
      subpaths.push(`M ${landX + pts[0].x} ${landY + pts[0].y} L ${landX + pts[0].x + 0.05} ${landY + pts[0].y}`);
    } else {
      let d = `M ${landX + pts[0].x} ${landY + pts[0].y}`;
      for (let j = 1; j < pts.length; j++) {
        d += ` L ${landX + pts[j].x} ${landY + pts[j].y}`;
      }
      subpaths.push(d);
    }
  }
  return subpaths.join(' ');
}

function renderStrokeInLand(
  stroke: MaskStroke,
  landX: number,
  landY: number,
  color: string,
  opacity: number,
  blendMode?: 'clear' | 'srcOver' | 'srcIn',
  keyPrefix = ''
) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return null;
  let d = '';
  if (pts.length === 1) {
    d = `M ${landX + pts[0].x} ${landY + pts[0].y} L ${landX + pts[0].x + 0.05} ${landY + pts[0].y}`;
  } else {
    d = `M ${landX + pts[0].x} ${landY + pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${landX + pts[i].x} ${landY + pts[i].y}`;
    }
  }

  return (
    <Path
      key={`${keyPrefix}${stroke.id}`}
      path={d}
      style="stroke"
      strokeWidth={stroke.radius * 2}
      strokeCap="round"
      strokeJoin="round"
      color={color}
      opacity={opacity}
      blendMode={blendMode}
    />
  );
}

function CalibratedMonthRegion({
  month,
  isCalibrating,
  isSelected,
  cal,
  layout,
  opacity,
  showLandBounds,
  isPaintingMask,
  paintingMonth,
  activeStrokes,
  brushCursor,
  showBaseMask = false,
  showAdditions = false,
  showErasures = false,
  showFinalMask = true,
}: {
  month: number;
  isCalibrating: boolean;
  isSelected: boolean;
  cal: MonthRegionCalibration;
  layout?: GardenLandLayout;
  opacity: number;
  showLandBounds: boolean;
  isPaintingMask?: boolean;
  paintingMonth?: number;
  activeStrokes?: MaskStroke[];
  brushCursor?: { lx: number; ly: number; radius: number; tool: MaskTool } | null;
  showBaseMask?: boolean;
  showAdditions?: boolean;
  showErasures?: boolean;
  showFinalMask?: boolean;
}) {
  const imgSrc =
    isCalibrating && !isPaintingMask
      ? DEBUG_MONTH_IMAGES[month]
      : NORMAL_MONTH_IMAGES[month];
  const meta = MONTH_REGION_METAS[month];
  const image = useImage(imgSrc);
  if (!image || !meta) return null;

  const land = getParentLand(cal.parentLandAsset, layout);
  const { width: landWidth, height: landHeight, centerX: landCenterX, centerY: landCenterY } = getLandGeometry(land);

  const W = meta.bbox.width;
  const H = meta.bbox.height;
  const regCenterX = land.x + cal.localX + W / 2;
  const regCenterY = land.y + cal.localY + H / 2;

  const centroid = getCalibratedCentroid(month, { [month]: cal }, layout);

  // Determine strokes to render for this month
  const isThisMonthPainting = isPaintingMask && paintingMonth === month;
  let strokesToRender: MaskStroke[] = [];
  if (isThisMonthPainting && activeStrokes) {
    strokesToRender = activeStrokes;
  } else {
    const saved = getMonthMaskRefinement(month);
    if (saved) strokesToRender = saved.strokes;
  }

  const addStrokes = strokesToRender.filter((s) => s.tool === 'add');
  const eraseStrokes = strokesToRender.filter((s) => s.tool === 'remove');

  return (
    <Group>
      <Group
        transform={[
          { translateX: landCenterX },
          { translateY: landCenterY },
          { rotate: (land.rotation * Math.PI) / 180 },
          { translateX: -landCenterX },
          { translateY: -landCenterY },
        ]}
      >
        {/* 1. Final Composite Mask: BASE MASK + ADDITIONS - ERASURES */}
        {showFinalMask && (
          <Group layer={true} opacity={opacity * 0.9}>
            {/* Base Mask: Image with srcIn Cyan fill inside its own layer */}
            <Group layer={true}>
              <Group
                transform={[
                  { translateX: regCenterX },
                  { translateY: regCenterY },
                  { rotate: (cal.rotation * Math.PI) / 180 },
                  { scaleX: cal.scaleX || 1.0 },
                  { scaleY: cal.scaleY || 1.0 },
                  { translateX: -regCenterX },
                  { translateY: -regCenterY },
                ]}
              >
                <Image
                  image={image}
                  x={land.x + cal.localX}
                  y={land.y + cal.localY}
                  width={W}
                  height={H}
                />
                <Rect
                  x={land.x + cal.localX}
                  y={land.y + cal.localY}
                  width={W}
                  height={H}
                  color="#06B6D4"
                  blendMode="srcIn"
                />
              </Group>
            </Group>

            {/* Sequential Strokes in chronological order:
                - Brush/Add paints Cyan (#06B6D4) with srcOver as continuous Skia Paths
                - Eraser/Remove clears the mask with blendMode="clear" as continuous Skia Paths
                Later strokes naturally take precedence (Brush can repaint an erased area,
                and Eraser can erase it again).
                Consecutive/overlapping Add strokes visually union with each other and the Base Mask.
            */}
            {groupConsecutiveStrokes(strokesToRender).map((group) => {
              const d = strokeGroupToPath(group, land.x, land.y);
              if (!d) return null;
              const isAdd = group.tool === 'add';
              return (
                <Path
                  key={`final-group-${group.id}`}
                  path={d}
                  style="stroke"
                  strokeWidth={group.radius * 2}
                  strokeCap="round"
                  strokeJoin="round"
                  color={isAdd ? '#06B6D4' : '#000000'}
                  opacity={1.0}
                  blendMode={isAdd ? 'srcOver' : 'clear'}
                />
              );
            })}
          </Group>
        )}

        {/* 2. Optional Diagnostic Overlay: Base Mask in Yellow */}
        {isThisMonthPainting && showBaseMask && (
          <Group layer={true} opacity={opacity * 0.85}>
            <Group
              transform={[
                { translateX: regCenterX },
                { translateY: regCenterY },
                { rotate: (cal.rotation * Math.PI) / 180 },
                { scaleX: cal.scaleX || 1.0 },
                { scaleY: cal.scaleY || 1.0 },
                { translateX: -regCenterX },
                { translateY: -regCenterY },
              ]}
            >
              <Image
                image={image}
                x={land.x + cal.localX}
                y={land.y + cal.localY}
                width={W}
                height={H}
              />
              <Rect
                x={land.x + cal.localX}
                y={land.y + cal.localY}
                width={W}
                height={H}
                color="#FACC15"
                blendMode="srcIn"
              />
            </Group>
          </Group>
        )}

        {/* 3. Optional Diagnostic Overlay: Additions in Green */}
        {isThisMonthPainting &&
          showAdditions &&
          addStrokes.map((s) =>
            renderStrokeInLand(s, land.x, land.y, '#10B981', opacity * 0.9, 'srcOver', 'add-')
          )}

        {/* 4. Optional Diagnostic Overlay: Erasures in Red (OFF by default) */}
        {isThisMonthPainting &&
          showErasures &&
          eraseStrokes.map((s) =>
            renderStrokeInLand(s, land.x, land.y, '#EF4444', 0.65, 'srcOver', 'erase-')
          )}

        {/* 5. Transform Calibration Selection Box (Stage 1 only) */}
        {isCalibrating && isSelected && !isPaintingMask && (
          <Group
            transform={[
              { translateX: regCenterX },
              { translateY: regCenterY },
              { rotate: (cal.rotation * Math.PI) / 180 },
              { scaleX: cal.scaleX || 1.0 },
              { scaleY: cal.scaleY || 1.0 },
              { translateX: -regCenterX },
              { translateY: -regCenterY },
            ]}
          >
            <Rect
              x={land.x + cal.localX}
              y={land.y + cal.localY}
              width={W}
              height={H}
              color="#FFFFFFAA"
              style="stroke"
              strokeWidth={3}
            />
          </Group>
        )}

        {/* 6. Active Brush Cursor in Paint Mode */}
        {isThisMonthPainting && brushCursor && (
          <Group>
            <Circle
              cx={land.x + brushCursor.lx}
              cy={land.y + brushCursor.ly}
              r={brushCursor.radius}
              style="stroke"
              strokeWidth={2}
              color={brushCursor.tool === 'add' ? '#10B981' : '#FFFFFF'}
            />
            <Circle
              cx={land.x + brushCursor.lx}
              cy={land.y + brushCursor.ly}
              r={2}
              color={brushCursor.tool === 'add' ? '#10B981' : '#FFFFFF'}
            />
          </Group>
        )}

        {/* 7. Land Outline Border */}
        {isCalibrating && isSelected && showLandBounds && (
          <Rect
            x={land.x}
            y={land.y}
            width={landWidth}
            height={landHeight}
            color="#FFD700CC"
            style="stroke"
            strokeWidth={4}
          />
        )}
      </Group>

      {/* Centroid Marker in Transform Calibration Mode */}
      {isCalibrating && !isPaintingMask && (
        <Group>
          <Circle
            cx={centroid.x}
            cy={centroid.y}
            r={isSelected ? 16 : 10}
            color={isSelected ? '#FFFFFF' : '#172219CC'}
          />
          <Circle
            cx={centroid.x}
            cy={centroid.y}
            r={isSelected ? 12 : 7}
            color={isSelected ? '#E63946' : '#457B9D'}
          />
        </Group>
      )}
    </Group>
  );
}

export interface PlantingRegionOverlayProps {
  showAllRegions?: boolean;
  highlightedMonth?: number | null;
  // Calibration DEV mode props
  isCalibrating?: boolean;
  calibrationMap?: Record<number, MonthRegionCalibration>;
  selectedMonth?: number;
  displayMode?: 'selected' | 'all';
  opacity?: number;
  showLandBounds?: boolean;
  layout?: GardenLandLayout;
  // Manual Mask Painting Props
  isPaintingMask?: boolean;
  paintingMonth?: number;
  activeStrokes?: MaskStroke[];
  brushCursor?: { lx: number; ly: number; radius: number; tool: MaskTool } | null;
  showBaseMask?: boolean;
  showAdditions?: boolean;
  showErasures?: boolean;
  showFinalMask?: boolean;
}

export default function PlantingRegionOverlay({
  showAllRegions = false,
  highlightedMonth = null,
  isCalibrating = false,
  calibrationMap,
  selectedMonth = 1,
  displayMode = 'all',
  opacity = 0.5,
  showLandBounds = true,
  layout = GARDEN_LANDS,
  isPaintingMask = false,
  paintingMonth = 1,
  activeStrokes,
  brushCursor,
  showBaseMask = false,
  showAdditions = false,
  showErasures = false,
  showFinalMask = true,
}: PlantingRegionOverlayProps) {
  const currentCalibrationMap = calibrationMap || PLANTING_REGION_CALIBRATION;

  // 1. Manual Mask Painting Active
  if (isPaintingMask) {
    return (
      <Group>
        <CalibratedMonthRegion
          key={paintingMonth}
          month={paintingMonth}
          isCalibrating={true}
          isSelected={true}
          cal={currentCalibrationMap[paintingMonth] || PLANTING_REGION_CALIBRATION[paintingMonth]}
          layout={layout}
          opacity={opacity}
          showLandBounds={showLandBounds}
          isPaintingMask={true}
          paintingMonth={paintingMonth}
          activeStrokes={activeStrokes}
          brushCursor={brushCursor}
          showBaseMask={showBaseMask}
          showAdditions={showAdditions}
          showErasures={showErasures}
          showFinalMask={showFinalMask}
        />
      </Group>
    );
  }

  // 2. Calibration DEV mode active
  if (isCalibrating) {
    const monthsToRender =
      displayMode === 'selected' ? [selectedMonth] : Array.from({ length: 12 }, (_, i) => i + 1);

    return (
      <Group>
        {monthsToRender.map((m) => (
          <CalibratedMonthRegion
            key={m}
            month={m}
            isCalibrating={true}
            isSelected={m === selectedMonth}
            cal={currentCalibrationMap[m] || PLANTING_REGION_CALIBRATION[m]}
            layout={layout}
            opacity={opacity}
            showLandBounds={showLandBounds}
          />
        ))}
      </Group>
    );
  }

  // 3. Normal Planting Mode: only the active flower's month region is highlighted
  if (highlightedMonth && highlightedMonth >= 1 && highlightedMonth <= 12) {
    return (
      <Group>
        <CalibratedMonthRegion
          month={highlightedMonth}
          isCalibrating={false}
          isSelected={false}
          cal={currentCalibrationMap[highlightedMonth] || PLANTING_REGION_CALIBRATION[highlightedMonth]}
          layout={layout}
          opacity={0.8}
          showLandBounds={false}
        />
      </Group>
    );
  }

  // 4. DEV showAllRegions toggle
  if (showAllRegions) {
    return (
      <Group>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <CalibratedMonthRegion
            key={m}
            month={m}
            isCalibrating={false}
            isSelected={false}
            cal={currentCalibrationMap[m] || PLANTING_REGION_CALIBRATION[m]}
            layout={layout}
            opacity={0.65}
            showLandBounds={false}
          />
        ))}
      </Group>
    );
  }

  return null;
}
