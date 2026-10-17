/**
 * PetalPal Handmade Paper Material System
 *
 * Procedural (asset-free) paper textures for web, built from inline SVG
 * feTurbulence filters. Everything is tiled, GPU-composited background
 * imagery, so it costs nothing on the JS thread during animations.
 *
 *  - GRAIN   : fine cotton-paper tooth (high-frequency fractal noise)
 *  - FIBERS  : sparse elongated pulp fibres (anisotropic turbulence)
 *  - MOTTLE  : very soft low-frequency tonal variation (handmade sheet density)
 *
 * Plus a deterministic deckled-edge clip-path for torn / hand-formed edges.
 */

const svgUrl = (svg: string) =>
  `url("data:image/svg+xml;utf8,${svg
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/\n\s*/g, ' ')}")`;

/** Fine paper tooth — warm sepia speckle, avg alpha ≈ 0.07 */
export const PAPER_GRAIN_URL = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>
    <filter id='g'>
      <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' seed='7' stitchTiles='stitch'/>
      <feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.32  0 0 0 0 0.20  0.55 0 0 0 -0.20'/>
    </filter>
    <rect width='100%' height='100%' filter='url(#g)'/>
  </svg>`
);

/** Sparse elongated cotton fibres — mostly transparent with faint streaks */
export const PAPER_FIBER_URL = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>
    <filter id='f'>
      <feTurbulence type='turbulence' baseFrequency='0.012 0.16' numOctaves='2' seed='3' stitchTiles='stitch'/>
      <feColorMatrix values='0 0 0 0 0.50  0 0 0 0 0.40  0 0 0 0 0.27  1.6 0 0 0 -0.95'/>
    </filter>
    <rect width='100%' height='100%' filter='url(#f)'/>
  </svg>`
);

/** Soft cloud-like density variation of a hand-formed sheet */
export const PAPER_MOTTLE_URL = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'>
    <filter id='m'>
      <feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='3' seed='11' stitchTiles='stitch'/>
      <feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.26  0.55 0 0 0 -0.20'/>
    </filter>
    <rect width='100%' height='100%' filter='url(#m)'/>
  </svg>`
);

/** Combined web background layers for premium letter paper */
export const LETTER_PAPER_BACKGROUND = [
  PAPER_FIBER_URL,
  PAPER_GRAIN_URL,
  PAPER_MOTTLE_URL,
  // Luminous centre fading to warmer, slightly toasted margins
  'radial-gradient(ellipse 85% 75% at 50% 42%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 62%, rgba(176,136,82,0.10) 100%)',
].join(', ');

/** Lighter-weight combination for small envelopes */
export const ENVELOPE_PAPER_BACKGROUND = [
  PAPER_GRAIN_URL,
  PAPER_MOTTLE_URL,
  'linear-gradient(170deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 45%, rgba(150,110,70,0.06) 100%)',
].join(', ');

/* ──────────────────────────────────────────────────────────────────
   DECKLED EDGE CLIP PATH
   Deterministic pseudo-random inset along each edge (px), positioned by
   percentage so it scales with the sheet during unfolding transitions.
   ────────────────────────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildDeckledClipPath(seed: number, maxInset: number, steps: number) {
  const rnd = seededRandom(seed);
  // Smooth the noise slightly so the edge looks torn-fibrous, not jagged
  let prev = rnd() * maxInset;
  const inset = () => {
    const next = rnd() * maxInset;
    prev = prev * 0.45 + next * 0.55;
    return prev.toFixed(2);
  };
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = ((i / steps) * 100).toFixed(2);
    pts.push(`${p}% ${inset()}px`); // top edge  (L → R)
  }
  for (let i = 0; i <= steps; i++) {
    const p = ((i / steps) * 100).toFixed(2);
    pts.push(`calc(100% - ${inset()}px) ${p}%`); // right edge (T → B)
  }
  for (let i = steps; i >= 0; i--) {
    const p = ((i / steps) * 100).toFixed(2);
    pts.push(`${p}% calc(100% - ${inset()}px)`); // bottom edge (R → L)
  }
  for (let i = steps; i >= 0; i--) {
    const p = ((i / steps) * 100).toFixed(2);
    pts.push(`${inset()}px ${p}%`); // left edge (B → T)
  }
  return `polygon(${pts.join(', ')})`;
}

/** Soft hand-torn deckle for the reading letter */
export const LETTER_DECKLE_CLIP = buildDeckledClipPath(20241012, 2.6, 64);

/** Very fine deckle for envelopes (machine-cut but soft cotton stock) */
export const ENVELOPE_DECKLE_CLIP = buildDeckledClipPath(7781, 1.1, 36);
