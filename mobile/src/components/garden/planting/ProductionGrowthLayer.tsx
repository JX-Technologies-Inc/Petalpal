import { Group, Image, useImage, type SkImage } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { growthCatalog } from '../flower-density-sandbox/monthly-growth/growthCatalog';
import { growthDrawOrder } from '../flower-density-sandbox/monthly-growth/MonthlyGrowthLayer';
import type { GrowthPiece } from '../flower-density-sandbox/monthly-growth/growthCoverage';
import type { MonthlyGrowth } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';

const AssetLoader = memo(function AssetLoader({ piece, onLoad }: {
  piece: GrowthPiece; onLoad: (key: string, image: SkImage) => void;
}) {
  const key = `${piece.speciesCode}:${piece.componentId}`;
  const image = useImage(growthCatalog(piece.speciesCode).images[piece.componentId]);
  useEffect(() => { if (image) onLoad(key, image); }, [image, key, onLoad]);
  return null;
});

const BotanicalPiece = memo(function BotanicalPiece({ piece, image }: {
  piece: GrowthPiece; image?: SkImage;
}) {
  const c = growthCatalog(piece.speciesCode).lookup(piece.componentId);
  if (!image) return null;
  return <Group transform={[{ translateX: piece.worldX }, { translateY: piece.worldY }, { rotate: piece.rotation }]}>
    <Image image={image} x={-c.anchorX * c.canvasWidth * piece.scale} y={-c.anchorY * c.canvasHeight * piece.scale}
      width={c.canvasWidth * piece.scale} height={c.canvasHeight * piece.scale} fit="fill" />
  </Group>;
});

/** Release-capable neutral drawing of the approved pieces. No placement,
 * persistence, interaction identity, emotion effect or botanical mask clip. */
export const ProductionGrowthLayer = memo(function ProductionGrowthLayer({ growth }: { growth: MonthlyGrowth }) {
  const [images, setImages] = useState<Record<string, SkImage>>({});
  const onLoad = useCallback((key: string, image: SkImage) =>
    setImages(previous => previous[key] === image ? previous : { ...previous, [key]: image }), []);
  const pieces = useMemo(() => growthDrawOrder(growth), [growth]);
  const requests = useMemo(() => new Map(pieces.map(piece => [`${piece.speciesCode}:${piece.componentId}`, piece])), [pieces]);
  return <Group>
    {Array.from(requests, ([key, piece]) => <AssetLoader key={key} piece={piece} onLoad={onLoad} />)}
    {pieces.map(piece => <BotanicalPiece key={piece.id} piece={piece}
      image={images[`${piece.speciesCode}:${piece.componentId}`]} />)}
  </Group>;
});
