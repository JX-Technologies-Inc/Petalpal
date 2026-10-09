import { Canvas, type CanvasProps } from '@shopify/react-native-skia';
// Native remains on the upstream Canvas; Web quality/cache choices do not apply.
export type GardenCanvasProps = Pick<CanvasProps, 'children' | 'style' | 'ref'> & { active: boolean };
export default function GardenCanvas({ active: _active, ...props }: GardenCanvasProps) {
  return <Canvas {...props} />;
}
