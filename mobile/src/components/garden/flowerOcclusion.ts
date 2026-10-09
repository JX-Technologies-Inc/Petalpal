/** Render-only ownership rule; never classify by visual overlap or move an anchor. */
export const flowersRenderBehindTeaSet = (month: number): boolean => month === 6;

export type FlowerDepthPass = 'all' | 'behind-tea-set' | 'foreground';

export function flowerInDepthPass(month: number, pass: FlowerDepthPass): boolean {
  return pass === 'all' || flowersRenderBehindTeaSet(month) === (pass === 'behind-tea-set');
}
