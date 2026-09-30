import { COMPONENT_IMAGES } from './componentImages';
import { componentById } from './chamomileComposition';
import type { ComponentCatalog } from '../tulip-components/TulipComponentLayer';

export const CHAMOMILE_CATALOG: ComponentCatalog = { images: COMPONENT_IMAGES, lookup: componentById };
