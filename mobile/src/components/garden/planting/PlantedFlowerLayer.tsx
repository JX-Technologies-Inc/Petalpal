import React, { useMemo } from 'react';
import {
  Circle,
  Group,
  Image,
  useImage,
} from '@shopify/react-native-skia';
import { usePlanting } from './PlantingContext';
import { getFlowerPlacementDefinition } from './flowerFootprintConfig';

const FLOWER_ASSETS: Record<string, any> = {
  pink: require('../../../../assets/garden/flowers/pink.png'),
  purple: require('../../../../assets/garden/flowers/purple.png'),
  blue: require('../../../../assets/garden/flowers/blue.png'),
  sunflower: require('../../../../assets/garden/flowers/sunflower.png'),
  tulip: require('../../../../assets/garden/flowers/tulip.png'),
};

export default function PlantedFlowerLayer() {
  const {
    placements,
    activeMode,
    targetFlower,
    previewCoords,
    validationResult,
    showDevFootprints,
    showDevHitboxes,
  } = usePlanting();

  // Pre-load Skia images
  const pinkImg = useImage(FLOWER_ASSETS.pink);
  const purpleImg = useImage(FLOWER_ASSETS.purple);
  const blueImg = useImage(FLOWER_ASSETS.blue);
  const sunflowerImg = useImage(FLOWER_ASSETS.sunflower);
  const tulipImg = useImage(FLOWER_ASSETS.tulip);

  const getImageForFlower = (flowerName?: string) => {
    if (!flowerName) return pinkImg;
    const lower = flowerName.toLowerCase();
    if (lower.includes('sunflower')) return sunflowerImg;
    if (lower.includes('tulip')) return tulipImg;
    if (lower.includes('purple')) return purpleImg;
    if (lower.includes('blue')) return blueImg;
    if (lower.includes('pink')) return pinkImg;
    return pinkImg;
  };

  // Deterministic Y-depth sorting (smaller Y drawn first, so larger Y renders in front)
  const sortedPlacements = useMemo(() => {
    return [...placements].sort((a, b) => a.worldY - b.worldY);
  }, [placements]);

  return (
    <Group>
      {/* 1. Committed Planted Flowers */}
      {sortedPlacements.map((flower) => {
        // If this flower is actively being adjusted, hide it from its old location
        if (activeMode === 'adjusting' && targetFlower?.id === flower.id) {
          return null;
        }

        const def = getFlowerPlacementDefinition(flower.flowerName);
        const img = getImageForFlower(flower.flowerName);
        if (!img) return null;

        const w = def.visualWidth;
        const h = def.visualHeight;
        const drawX = flower.worldX - w / 2;
        const drawY = flower.worldY - h * 0.82;

        return (
          <Group key={flower.id}>
            {/* Ground shadow / root base */}
            <Circle
              cx={flower.worldX}
              cy={flower.worldY}
              r={def.footprintRadius * 0.6}
              color="rgba(20, 45, 25, 0.22)"
            />

            {/* Visual flower art */}
            <Image
              image={img}
              x={drawX}
              y={drawY}
              width={w}
              height={h}
              fit="contain"
            />

            {/* DEV Footprint Collision Overlay */}
            {showDevFootprints && (
              <Group>
                <Circle
                  cx={flower.worldX}
                  cy={flower.worldY}
                  r={def.footprintRadius}
                  color="rgba(74, 222, 128, 0.8)"
                  style="stroke"
                  strokeWidth={2}
                />
                <Circle
                  cx={flower.worldX}
                  cy={flower.worldY}
                  r={3}
                  color="rgba(74, 222, 128, 1)"
                />
              </Group>
            )}

            {/* DEV Hitbox Overlay */}
            {showDevHitboxes && (
              <Circle
                cx={flower.worldX}
                cy={flower.worldY - h * 0.35}
                r={def.hitboxRadius}
                color="rgba(56, 189, 248, 0.6)"
                style="stroke"
                strokeWidth={1.5}
              />
            )}
          </Group>
        );
      })}

      {/* 2. Active Preview Flower (Planting or Adjusting) */}
      {activeMode !== 'normal' && previewCoords && targetFlower && (
        <Group>
          {(() => {
            const def = getFlowerPlacementDefinition(targetFlower.flowerName);
            const img = getImageForFlower(targetFlower.flowerName);
            const isValid = validationResult?.isValid ?? false;
            const w = def.visualWidth;
            const h = def.visualHeight;
            const drawX = previewCoords.worldX - w / 2;
            const drawY = previewCoords.worldY - h * 0.82;

            const ringColor = isValid
              ? 'rgba(34, 197, 94, 0.85)'
              : 'rgba(239, 68, 68, 0.85)';
            const ringFill = isValid
              ? 'rgba(34, 197, 94, 0.25)'
              : 'rgba(239, 68, 68, 0.25)';

            return (
              <Group>
                {/* Placement preview base halo indicator */}
                <Circle
                  cx={previewCoords.worldX}
                  cy={previewCoords.worldY}
                  r={def.footprintRadius + 4}
                  color={ringFill}
                />
                <Circle
                  cx={previewCoords.worldX}
                  cy={previewCoords.worldY}
                  r={def.footprintRadius}
                  color={ringColor}
                  style="stroke"
                  strokeWidth={2.5}
                />

                {/* Preview flower image (slightly translucent) */}
                {img && (
                  <Group opacity={isValid ? 0.92 : 0.65}>
                    <Image
                      image={img}
                      x={drawX}
                      y={drawY}
                      width={w}
                      height={h}
                      fit="contain"
                    />
                  </Group>
                )}

                {/* Center marker */}
                <Circle
                  cx={previewCoords.worldX}
                  cy={previewCoords.worldY}
                  r={4}
                  color={ringColor}
                />
              </Group>
            );
          })()}
        </Group>
      )}
    </Group>
  );
}
