import { Blur, Circle, Group, Oval, Rect } from '@shopify/react-native-skia';
import { memo } from 'react';

import { type WaterfallImpactPlacement } from './waterfallImpactPlacement';

type Props = {
  placement: WaterfallImpactPlacement;
};

function WaterfallImpactOverlay({ placement }: Props) {
  const { x: cx, y: cy, width: w, height: h, rotation } = placement;
  const ox = cx - w / 2;
  const oy = cy - h / 2;
  const rad = (rotation * Math.PI) / 180;

  return (
    <Group origin={{ x: cx, y: cy }} transform={[{ rotate: rad }]}>
      {/* 1. Outer soft translucent footprint (planned wake envelope) */}
      <Oval
        x={ox}
        y={oy}
        width={w}
        height={h}
        color="rgba(80, 220, 240, 0.28)"
      >
        <Blur blur={8} />
      </Oval>

      {/* 2. Middle impact foam density (strongest directly under the falling water) */}
      <Oval
        x={cx - w * 0.35}
        y={cy - h * 0.35}
        width={w * 0.7}
        height={h * 0.7}
        color="rgba(190, 245, 255, 0.42)"
      >
        <Blur blur={4} />
      </Oval>

      {/* 3. Core impact center */}
      <Oval
        x={cx - w * 0.18}
        y={cy - h * 0.22}
        width={w * 0.36}
        height={h * 0.44}
        color="rgba(255, 255, 255, 0.65)"
      />

      {/* 4. Calibration boundary stroke (exact footprint limits) */}
      <Oval
        x={ox}
        y={oy}
        width={w}
        height={h}
        color="rgba(0, 229, 255, 0.85)"
        style="stroke"
        strokeWidth={2}
      />

      {/* 5. Downstream flow direction pointer along major axis */}
      <Rect
        x={cx}
        y={cy - 1}
        width={w / 2}
        height={2}
        color="rgba(0, 229, 255, 0.9)"
      />
      <Circle cx={cx + w / 2} cy={cy} r={3} color="#00E5FF" />

      {/* 6. Calibration anchor crosshair (exact impact point) */}
      <Rect x={cx - 10} y={cy - 1} width={20} height={2} color="#FF3366" />
      <Rect x={cx - 1} y={cy - 10} width={2} height={20} color="#FF3366" />
      <Circle cx={cx} cy={cy} r={3.5} color="#FF3366" />
    </Group>
  );
}

export default memo(WaterfallImpactOverlay);
