// Renders the bundled Fairy Moments photos (mobile/assets/moments/<STATE>-<key>.jpg) from the
// garden's own art, exactly as GardenScene draws it: water, lands, environment overlays, roads
// and bridges, then each landmark at its LandmarkLayer world placement with the Fairy's pose
// registered as in TeaFairy / SeatedSwingFairy / MailboxFairy / SleepingMoonFairy / GardenFairy.
// Dusk and night shots add a colour wash and lantern glows. Keys match FAIRY_MOMENTS_CONFIG.
//
//   node scripts/render-fairy-moment-photos.mjs            # all photos
//   node scripts/render-fairy-moment-photos.mjs TEA_TIME-1  # selected photos
//
// Uses sharp from the root node_modules. Re-run after changing landmark, land or Fairy art.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const out = root + "/mobile/assets/moments";
const only = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sharp = createRequire(root + "/package.json")("sharp");
const A = root + "/mobile/assets/garden/", SRC = root + "/mobile/src/components/garden/";
const png = s => s.png().toBuffer();
const blank = (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

async function scene(width, height, layers, base = null) {
  const composites = [];
  for (const l of layers) {
    let img = sharp(l.input);
    if (l.extract) img = img.extract(l.extract);
    if (l.flip) img = img.flop();
    let buf = await png(img);
    if (l.w || l.h) buf = await png(sharp(buf).resize({ width: Math.max(1, Math.round(l.w)), height: Math.max(1, Math.round(l.h)), fit: "fill" }));
    let x = l.x, y = l.y;
    if (l.rotate) {
      const b = await sharp(buf).metadata();
      buf = await png(sharp(buf).rotate(l.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }));
      const a = await sharp(buf).metadata();
      x -= (a.width - b.width) / 2; y -= (a.height - b.height) / 2;
    }
    x = Math.round(x); y = Math.round(y);
    const m = await sharp(buf).metadata();
    const x0 = Math.max(0, -x), y0 = Math.max(0, -y);
    const w = Math.min(m.width - x0, width - Math.max(0, x)), h = Math.min(m.height - y0, height - Math.max(0, y));
    if (w <= 0 || h <= 0) continue;
    composites.push({ input: await png(sharp(buf).extract({ left: x0, top: y0, width: w, height: h })), left: Math.max(0, x), top: Math.max(0, y), ...(l.blend ? { blend: l.blend } : {}) });
  }
  return png((base ? sharp(base) : blank(width, height)).composite(composites));
}
const layer = (file, x, y, s, sw, sh, extra = {}) => ({ input: A + file, x, y, w: sw * s, h: sh * s, ...extra });

// ---- ground (GardenScene order) ----
const LANDS = [["central-land",768,297,831,0],["land-0405",1135,-60,597,1.5],["land-06",1638,230,598,-1.33],
  ["land-07",1737,407,689,7.24],["land-08",1667,924,673,16.9],["land-09",936,1000,597,8.28],["land-101112",-27,373,1008,0]];
const ENV = JSON.parse(readFileSync(A + "environment/layers.json", "utf8"));
const infra = [...readFileSync(SRC + "GardenInfrastructureLayer.tsx", "utf8").matchAll(/registeredArtwork\(require\('@\/assets\/garden\/([^']+)'\)/g)].map(m => m[1]);
const WORLD = [];
for (const [file, x, y, w, rot] of LANDS) {
  const m = await sharp(A + "land/" + file + ".png").metadata();
  WORLD.push({ input: A + "land/" + file + ".png", x, y, w, h: w * m.height / m.width, rotate: rot });
}
for (const e of ENV) WORLD.push({ input: A + "environment/" + e.asset, x: e.x, y: e.y, w: e.width, h: e.height });
WORLD.push({ input: A + "infrastructure/land09-interface-v2/land09-broad-interface.png", x: 0, y: 0, w: 2400, h: 1800 });
WORLD.push({ input: A + "bridges/approved-circulation/main-road-connected.png", x: 1300, y: 1350, w: 680, h: 2950 });
for (const f of [...infra, "roads/complete/R01_treehouse_path.png", "roads/complete/R01_existing_foreground.png"]) WORLD.push({ input: A + f, x: 0, y: 0, w: 2400, h: 1800 });

const OUTPUT = 540; // working canvas is 720
async function photo(name, { cx, cy, size, items, tone = null, glows = [] }) {
  if (only.length && !only.includes(name)) return;
  const Z = 720 / size, wx = cx - size / 2, wy = cy - size / 2;
  const toPx = l => ({ ...l, x: (l.x - wx) * Z, y: (l.y - wy) * Z, w: l.w * Z, h: l.h * Z });
  const floor = await scene(720, 720, [toPx({ input: SRC + "water/assets/ornamental-water-floor.png", x: 0, y: 0, w: 2400, h: 1800 })],
    await png(sharp({ create: { width: 720, height: 720, channels: 4, background: "#78b8b2" } })));
  const tint = await png(sharp({ create: { width: 720, height: 720, channels: 4, background: { r: 0x5f, g: 0xa8, b: 0xa2, alpha: 0.62 } } }));
  const water = await png(sharp(floor).composite([{ input: tint }]));
  const near = l => !(l.x > wx + size || l.y > wy + size || l.x + l.w * 1.2 < wx || l.y + l.h * 1.2 < wy);
  let full = await scene(720, 720, [...WORLD.filter(near), ...items].map(toPx), water);
  if (tone === "dusk" || tone === "night") {
    const c = tone === "dusk" ? { r: 214, g: 190, b: 200 } : { r: 120, g: 132, b: 190 };
    full = await png(sharp(full).composite([{ input: await png(sharp({ create: { width: 720, height: 720, channels: 4, background: { ...c, alpha: 1 } } })), blend: "multiply" }]));
  }
  if (glows.length) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720"><defs><radialGradient id="g"><stop offset="0" stop-color="#ffd58a" stop-opacity=".95"/><stop offset=".35" stop-color="#ffb35c" stop-opacity=".45"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient></defs>${
      glows.map(g => `<circle cx="${(g.x - wx) * Z}" cy="${(g.y - wy) * Z}" r="${g.r * Z}" fill="url(#g)"/>`).join("")}</svg>`;
    full = await png(sharp(full).composite([{ input: Buffer.from(svg), blend: "screen" }]));
  }
  await sharp(full).resize(OUTPUT, OUTPUT).jpeg({ quality: 80, mozjpeg: true }).toFile(`${out}/${name}.jpg`);
  console.log("rendered", name);
}
const place = (buf, W, H, x, y, scale, rotation = 0) => ({ input: buf, x, y, w: W * scale, h: H * scale, rotate: rotation });
// map a point in a landmark's own canvas to world (ignores the small landmark rotation; used for framing/glows)
const at = (lx, ly, s, px, py) => ({ x: lx + px * s, y: ly + py * s });

// ---- fairy sprites in world units ----
const WALK = i => A + `fairy/walk-v2/walk_0${i}.png`;
const walker = (px, py, frame = 4, flip = false) => ({ input: WALK(frame), x: flip ? px - 44.4 : px - 58, y: py - 139, w: 102.4, h: 153.6, flip });
const STAND = { file: A + "fairy/swing-pose-v2/poses.png", box: { left: 100, top: 20, width: 300, height: 610 } };
const stander = (px, py, h = 128) => ({ input: STAND.file, extract: STAND.box, x: px - h * 300 / 610 / 2, y: py - h, w: h * 300 / 610, h });
const glider = (px, py, lift = 40, flip = false) => ({ input: A + "fairy/fly-v1/glide.png", x: flip ? px - 34 : px - 78, y: py - 135 - lift, w: 112, h: 150, flip });

// ---- tea (TeaSetEntity + TeaFairy) ----
const T = "landmarks/tea-set/";
async function teaSet(pose) {
  const fairy = await png(sharp(A + "fairy/tea-v1/poses.png").extract({ left: pose === "drink" ? 692 : 0, top: 0, width: 724, height: 1086 }));
  return scene(1536, 1024, [
    layer(T + "left-chair-base.png", -100, 0, 1, 1536, 1024), layer(T + "right-chair-base.png", 380, 100, 0.8, 1536, 1024),
    { input: fairy, x: 995, y: 170, w: 440, h: 640 },
    layer(T + "tea-table.png", 470, 90, 0.58, 1024, 1536), layer(T + "left-occluder.png", -55, 262, 0.66, 1536, 1024),
    layer(T + "right-occluder.png", 559, 282, 0.675, 1536, 1024, { rotate: -3.5 }),
    layer(T + "left-overlay.png", -120, -15, 1, 1536, 1024), layer(T + "right-overlay.png", 480, 191, 0.73, 1536, 1024)]);
}
const TX = 1810, TY = 340, TS = 0.165, TR = -1.33;
const teaDrink = await teaSet("drink"), teaRest = await teaSet("rest");
const teaC = at(TX, TY, TS, 900, 520);
await photo("TEA_TIME-1", { cx: teaC.x - 20, cy: teaC.y - 20, size: 300, items: [place(teaDrink, 1536, 1024, TX, TY, TS, TR)] });
await photo("TEA_TIME-2", { cx: teaC.x - 10, cy: teaC.y - 10, size: 260, items: [place(teaRest, 1536, 1024, TX, TY, TS, TR)] });
await photo("TEA_TIME-3", { cx: at(TX, TY, TS, 1080, 470).x, cy: at(TX, TY, TS, 1080, 470).y, size: 150, items: [place(teaDrink, 1536, 1024, TX, TY, TS, TR)] });
await photo("TEA_TIME-4", { cx: teaC.x + 10, cy: teaC.y + 20, size: 480, items: [place(teaRest, 1536, 1024, TX, TY, TS, TR)], tone: "dusk" });

// ---- swing (SwingEntity + SeatedSwingFairy), pendulum about (642,268), amplitude 4 deg ----
const S = "landmarks/swing/", seatedFile = A + "fairy/swing-seated-v3/seated-back.png";
const sm = await sharp(seatedFile).metadata();
const sh = 470, sw = Math.round(sh * sm.width / sm.height), sx = 653 - sw * 0.5, sy = 740 - sh * 0.59, cut = Math.round(740 - sy);
const seated = await png(sharp(seatedFile).resize(sw, sh, { fit: "fill" }));
async function swingScene(angle) {
  const moving = await scene(1312, 1199, [
    layer(S + "swing-moving-back.png", 289, 260, 0.525, 1308, 1202),
    { input: await png(sharp(seated).extract({ left: 0, top: 0, width: sw, height: cut })), x: sx, y: sy },
    { input: await png(sharp(seated).extract({ left: 0, top: cut, width: sw, height: sh - cut })), x: sx, y: 740, w: sw, h: (sh - cut) * 1.55 },
    layer(S + "swing-moving-front.png", 350, 569, 0.36, 1495, 1052)]);
  // rotate the pendulum group about the pivot: pad so the pivot is the canvas centre, rotate, crop back
  const P = { x: 642, y: 268 }, R = 1400;
  const padded = await scene(R * 2, R * 2, [{ input: moving, x: R - P.x, y: R - P.y }]);
  const rotated = await png(sharp(padded).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }));
  const rm = await sharp(rotated).metadata();
  const pend = await png(sharp(rotated).extract({ left: Math.round(rm.width / 2 - P.x), top: Math.round(rm.height / 2 - P.y), width: 1312, height: 1199 }));
  return scene(1312, 1199, [{ input: pend, x: 0, y: 0 },
    layer(S + "frame-static.png", -112, 35, 1.068, 1430, 1100), layer(S + "hanging-decor.png", 15, 70, 0.935, 1368, 1150),
    layer(S + "lanterns.png", 80, 60, 0.834, 1402, 1122), layer(S + "foreground-overlay.png", 123, 237, 0.814, 1402, 1122)]);
}
const SX = 688, SY = 916, SS = 0.3, SR = 5.5;
const swC = at(SX, SY, SS, 656, 620);
await photo("SWINGING-1", { cx: swC.x, cy: swC.y, size: 470, items: [place(await swingScene(0), 1312, 1199, SX, SY, SS, SR)] });
await photo("SWINGING-2", { cx: swC.x, cy: swC.y - 20, size: 360, items: [place(await swingScene(4), 1312, 1199, SX, SY, SS, SR)] });
await photo("SWINGING-3", { cx: swC.x, cy: swC.y, size: 430, items: [place(await swingScene(-3), 1312, 1199, SX, SY, SS, SR)], tone: "night",
  glows: [at(SX, SY, SS, 220, 581), at(SX, SY, SS, 1110, 447)].map(p => ({ ...p, r: 70 })) });

// ---- treehouse (TreehouseEntity order) + mailbox (MailboxFairy atlas poses) ----
const H = "landmarks/treehouse/";
const MAIL = [ // bounds in atlas px and the sole pivot added in the shader; index 2 is mirrored
  { b: [0, 0, 452, 627], o: [235, 620] }, { b: [452, 0, 879, 627], o: [658, 620] }, { b: [879, 0, 1254, 627], o: [1080, 620], mirror: true },
  { b: [0, 627, 433, 1254], o: [235, 1230] }, { b: [433, 627, 836, 1254], o: [631, 1230] }, { b: [836, 627, 1254, 1254], o: [1044, 1230] }];
const TREE_S = 0.65, px = 0.205 / TREE_S;
function mailPose(i, fx, fy) { // fx,fy: foot in tree canvas px
  const p = MAIL[i], [x0, y0, x1, y1] = p.b;
  const left = p.mirror ? fx + (p.o[0] - x1) * px : fx + (x0 - p.o[0]) * px;
  return { input: A + "fairy/mailbox-v1/poses.png", extract: { left: x0, top: y0, width: x1 - x0, height: y1 - y0 }, flip: !!p.mirror,
    x: left, y: fy + (y0 - p.o[1]) * px, w: (x1 - x0) * px, h: (y1 - y0) * px };
}
async function treehouse(extra = [], lit = false) {
  const base = [{ input: A + H + "tree-base.png", x: 0, y: 0 }];
  if (lit) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1448" height="1086"><defs><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs><g filter="url(#b)" fill="#ffb347"><path d="M 783 376 C 802 365 813 380 811 404 C 809 426 795 444 777 449 C 759 451 746 439 746 420 C 746 401 762 383 783 376 Z"/><path d="M 854 613 C 886 605 916 621 931 653 C 940 682 931 720 912 749 L 863 774 C 836 770 810 750 799 726 C 788 699 797 660 816 637 C 827 625 839 617 854 613 Z"/></g></svg>`;
    base.push({ input: Buffer.from(svg), x: 0, y: 0, blend: "screen" });
  }
  return scene(1448, 1086, [...base, { input: A + H + "canopy-overlay.png", x: 0, y: 0 }, { input: A + H + "wisteria-overlay.png", x: 0, y: 0 },
    { input: A + H + "foreground-overlay.png", x: 0, y: 0 }, { input: A + H + "mailbox.png", x: 60, y: 135 }, ...extra]);
}
const HX = 70, HY = -140;
const tree = (x, y) => at(HX, HY, TREE_S, x, y);
await photo("AT_MAILBOX-1", { cx: tree(1000, 860).x, cy: tree(1000, 860).y, size: 260, items: [place(await treehouse([mailPose(1, 1030, 930)]), 1448, 1086, HX, HY, TREE_S)] });
await photo("AT_MAILBOX-2", { cx: tree(1020, 900).x, cy: tree(1020, 900).y, size: 220, items: [place(await treehouse([mailPose(3, 1040, 970)]), 1448, 1086, HX, HY, TREE_S)] });
await photo("AT_MAILBOX-3", { cx: tree(1000, 850).x, cy: tree(1000, 850).y, size: 300, items: [place(await treehouse([mailPose(5, 1050, 1010)]), 1448, 1086, HX, HY, TREE_S)] });
// treehouse: walking sprite drawn in world after the treehouse (GardenFairy paints above landmarks)
const door = tree(874, 780), approach = tree(970, 950);
await photo("IN_TREEHOUSE-1", { cx: tree(860, 720).x, cy: tree(860, 720).y, size: 330, items: [place(await treehouse(), 1448, 1086, HX, HY, TREE_S), walker(door.x, door.y, 3, true)] });
await photo("IN_TREEHOUSE-2", { cx: tree(820, 700).x, cy: tree(820, 700).y, size: 480, items: [place(await treehouse(), 1448, 1086, HX, HY, TREE_S), stander(approach.x, approach.y)] });
await photo("IN_TREEHOUSE-3", { cx: tree(840, 640).x, cy: tree(840, 640).y, size: 420, items: [place(await treehouse([], true), 1448, 1086, HX, HY, TREE_S), stander(approach.x - 20, approach.y - 10)], tone: "night",
  glows: [tree(780, 412), tree(865, 690)].map(p => ({ ...p, r: 16 })) });

// ---- walks (IDLE): points on the walk network next to each sight ----
const pav = { input: A + "landmarks/pavilion.png", x: 1086, y: 514, w: 1214 * 0.17, h: 1295 * 0.17 };
await photo("IDLE-PAVILION", { cx: 1215, cy: 590, size: 300, items: [pav, stander(1292, 650)] });
await photo("IDLE-EAST_BRIDGE", { cx: 1662, cy: 545, size: 300, items: [walker(1662, 588, 6)] });
const arch = { input: A + "landmarks/garden-arch.png", x: 1380, y: 1450, w: 1312 * 0.3, h: 1199 * 0.3, rotate: -6 };
await photo("IDLE-GARDEN_ARCH", { cx: 1600, cy: 1610, size: 380, items: [stander(1610, 1685), arch] });
await photo("IDLE-STEPPING_STONES", { cx: 2135, cy: 925, size: 300, items: [glider(2137, 985, 45, true)] });
await photo("IDLE-SOUTH_BRIDGE", { cx: 1740, cy: 1320, size: 300, items: [walker(1742, 1354, 2, true)], tone: "dusk" });

// ---- good night (MoonBedEntity + SleepingMoonFairy) ----
const M = "landmarks/moon-bed/";
const moon = await scene(1312, 1199, [
  layer(M + "frame-static.png", 52, 0, 1, 1254, 1254), layer(M + "ribbons.png", -1, 230, 0.82, 1536, 1024),
  layer(M + "bed-surface.png", -121, 0, 1.125, 1422, 1106), layer(M + "pillow.png", 376, 498, 0.3, 1312, 1199),
  { input: A + "fairy/moon-sleep-v1/sleep.png", x: 430, y: 450, w: 580, h: 435 },
  layer(M + "hanging-decor.png", 175, 40, 0.73, 1402, 1122), layer(M + "blanket-tail.png", 88, 158, 0.9, 1254, 1254)]);
const MX = 1840, MY = 885, MS = 0.175, MR = 0.65;
const mC = at(MX, MY, MS, 680, 600);
await photo("SLEEPING-1", { cx: mC.x, cy: mC.y, size: 300, items: [place(moon, 1312, 1199, MX, MY, MS, MR)], tone: "night" });
await photo("SLEEPING-2", { cx: at(MX, MY, MS, 720, 680).x, cy: at(MX, MY, MS, 720, 680).y, size: 160, items: [place(moon, 1312, 1199, MX, MY, MS, MR)], tone: "night",
  glows: [{ ...at(MX, MY, MS, 300, 200), r: 30 }] });
