import { COMPONENTS as tulip, componentById as tulipLookup } from '../tulip-components/tulipComposition';
import { COMPONENT_IMAGES as tulipImages } from '../tulip-components/componentImages';
import { COMPONENTS as chamomile } from '../chamomile-components/chamomileComposition';
import hydrangeaManifest from '../hydrangea-components/componentManifest.json';
import { BATCH_COMPONENTS } from '../batch-components/batchComposition';
import { catalogForBatchSpecies } from '../batch-components/batchCatalog';
export const GROWTH_COMPONENTS=[...tulip.map(c=>({...c,speciesCode:'TULIP'})),...chamomile,...hydrangeaManifest.components,...BATCH_COMPONENTS];
export const growthCatalog=(species:string)=>catalogForBatchSpecies(species)??{lookup:tulipLookup,images:tulipImages};
