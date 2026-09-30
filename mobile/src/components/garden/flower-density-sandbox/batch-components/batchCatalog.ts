import { COMPONENT_IMAGES } from './componentImages';
import { batchComponentById } from './batchComposition';
import { CHAMOMILE_CATALOG } from '../chamomile-components/chamomileCatalog';
import { HYDRANGEA_CATALOG } from '../hydrangea-components/hydrangeaCatalog';

export const BATCH_CATALOG = {images:COMPONENT_IMAGES, lookup:batchComponentById};
export const catalogForBatchSpecies = (speciesCode: string) => speciesCode === 'TULIP' ? undefined
  : speciesCode === 'CHAMOMILE' ? CHAMOMILE_CATALOG : speciesCode === 'HYDRANGEA' ? HYDRANGEA_CATALOG : BATCH_CATALOG;
