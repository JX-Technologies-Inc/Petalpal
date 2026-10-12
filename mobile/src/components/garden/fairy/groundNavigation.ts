import { GARDEN_WORLD_BOUNDS } from '../rendering/gardenWorldBounds';
import { distance, interpolate, type Point } from './walkNetwork';

export type GroundBounds = { x: number; y: number; width: number; height: number };
export type GroundBlocked = (point: Point) => boolean;
// Finer than the narrow authored paths, without tying standing positions to them.
export const GROUND_GRID_STEP = 4;
// Guard both sides of the centerline so smoothing cannot graze a mask corner
// that would only be discovered at a differently phased animation frame.
const SEGMENT_SAMPLE_STEP = .25;
const SEGMENT_SIDE_CLEARANCE = .75;

export function isValidGround(point: Point, blocked: GroundBlocked,
  bounds: GroundBounds = GARDEN_WORLD_BOUNDS): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= bounds.x && point.y >= bounds.y
    && point.x <= bounds.x + bounds.width && point.y <= bounds.y + bounds.height
    && !blocked(point);
}

/** All route/arrival checks use the same ground veto, including between vertices. */
export function safeGroundSegment(from: Point, to: Point, blocked: GroundBlocked,
  bounds: GroundBounds = GARDEN_WORLD_BOUNDS): boolean {
  if (!isValidGround(from, blocked, bounds) || !isValidGround(to, blocked, bounds)) return false;
  return safeSegmentInterior(from, to, p => !isValidGround(p, blocked, bounds));
}

function safeSegmentInterior(from: Point, to: Point, blocked: GroundBlocked): boolean {
  const length = distance(from, to);
  const steps = Math.max(2, Math.ceil(length / SEGMENT_SAMPLE_STEP));
  const perpendicularX = length ? -(to.y - from.y) / length : 0;
  const perpendicularY = length ? (to.x - from.x) / length : 0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps, point = interpolate(from, to, t);
    if (blocked(point)) return false;
    // Dense center samples resolve thin corners left by subtractive planting
    // strokes; side guards need only be checked once per world unit.
    if (i % 4 && i !== Math.ceil(steps / 2)) continue;
    // Taper to zero at exact endpoints: a valid shore-adjacent destination
    // stays selectable and the final approach retains its requested position.
    const clearance = Math.min(SEGMENT_SIDE_CLEARANCE, t * length, (1 - t) * length);
    if (blocked({ x: point.x + perpendicularX * clearance, y: point.y + perpendicularY * clearance })
      || blocked({ x: point.x - perpendicularX * clearance, y: point.y - perpendicularY * clearance })) return false;
  }
  return true;
}

type QueueEntry = { id: number; score: number; cost: number };
class MinHeap {
  private entries: QueueEntry[] = [];
  get length() { return this.entries.length; }
  push(entry: QueueEntry) {
    const entries = this.entries;
    let index = entries.length;
    entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (entries[parent].score <= entry.score) break;
      entries[index] = entries[parent];
      index = parent;
    }
    entries[index] = entry;
  }
  pop(): QueueEntry {
    const entries = this.entries, result = entries[0], last = entries.pop()!;
    if (entries.length) {
      let index = 0;
      while (index * 2 + 1 < entries.length) {
        let child = index * 2 + 1;
        if (child + 1 < entries.length && entries[child + 1].score < entries[child].score) child++;
        if (entries[child].score >= last.score) break;
        entries[index] = entries[child];
        index = child;
      }
      entries[index] = last;
    }
    return result;
  }
}

/**
 * Routes across any valid dry ground. Endpoints are exact user/landmark points;
 * the grid is only a routing aid and never restricts where the fairy can stand.
 * No cache survives a call, so changed planting/water masks apply immediately.
 */
export function route(start: Point, target: Point, blocked: GroundBlocked,
  bounds: GroundBounds = GARDEN_WORLD_BOUNDS): Point[] | null {
  if (!isValidGround(start, blocked, bounds) || !isValidGround(target, blocked, bounds)) return null;
  if (distance(start, target) < .001) return [{ ...start }, { ...target }];
  if (safeGroundSegment(start, target, blocked, bounds)) return [{ ...start }, { ...target }];

  const step = GROUND_GRID_STEP;
  const columns = Math.floor(bounds.width / step) + 1;
  const rows = Math.floor(bounds.height / step) + 1;
  const count = columns * rows;
  // 0 = unchecked, 1 = valid, 2 = blocked. Evaluate only the explored region.
  const validity = new Uint8Array(count);
  const closed = new Uint8Array(count);
  const costs = new Float64Array(count).fill(Infinity);
  const parents = new Int32Array(count).fill(-1);
  const point = (id: number): Point => ({
    x: bounds.x + (id % columns) * step,
    y: bounds.y + Math.floor(id / columns) * step,
  });
  const validNode = (id: number) => {
    if (!validity[id]) validity[id] = isValidGround(point(id), blocked, bounds) ? 1 : 2;
    return validity[id] === 1;
  };
  // Both endpoint nodes have already passed validNode. Reuse those exact
  // results instead of reevaluating all twelve flower masks for every edge.
  const safeGridEdge = (from: Point, to: Point) => safeSegmentInterior(from, to, blocked);
  // Link exact endpoints to every safely reachable nearby grid node. In
  // particular, do not blindly snap across a water/flower boundary.
  const connections = (endpoint: Point) => {
    const result = new Map<number, number>();
    const cx = Math.round((endpoint.x - bounds.x) / step);
    const cy = Math.round((endpoint.y - bounds.y) / step);
    for (let y = Math.max(0, cy - 2); y <= Math.min(rows - 1, cy + 2); y++) {
      for (let x = Math.max(0, cx - 2); x <= Math.min(columns - 1, cx + 2); x++) {
        const id = y * columns + x, p = point(id);
        if (validNode(id) && safeGroundSegment(endpoint, p, blocked, bounds)) {
          result.set(id, distance(endpoint, p));
        }
      }
    }
    return result;
  };
  const starts = connections(start), goals = connections(target);
  if (!starts.size || !goals.size) return null;
  const queue = new MinHeap();
  for (const [id, cost] of starts) {
    costs[id] = cost;
    queue.push({ id, cost, score: cost + distance(point(id), target) });
  }
  let goal = -1, goalCost = Infinity;
  while (queue.length) {
    const entry = queue.pop(), id = entry.id;
    if (entry.score >= goalCost) break;
    if (closed[id] || entry.cost !== costs[id]) continue;
    closed[id] = 1;
    const endCost = goals.get(id);
    if (endCost !== undefined && costs[id] + endCost < goalCost) {
      goal = id;
      goalCost = costs[id] + endCost;
    }
    const x = id % columns, y = Math.floor(id / columns), from = point(id);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= columns || y + dy < 0 || y + dy >= rows) continue;
        const next = (y + dy) * columns + x + dx;
        if (closed[next] || !validNode(next)) continue;
        // A diagonal cannot squeeze between two blocked orthogonal cells.
        if (dx && dy && (!validNode(y * columns + x + dx) || !validNode((y + dy) * columns + x))) continue;
        const to = point(next), cost = costs[id] + (dx && dy ? Math.SQRT2 * step : step);
        if (cost >= costs[next] || !safeGridEdge(from, to)) continue;
        costs[next] = cost;
        parents[next] = id;
        queue.push({ id: next, cost, score: cost + distance(to, target) });
      }
    }
  }
  if (goal < 0) return null;
  const reversed: Point[] = [{ ...target }];
  for (let id = goal; id >= 0; id = parents[id]) reversed.push(point(id));
  reversed.push({ ...start });
  const points = reversed.reverse().filter((p, i, all) => !i || distance(p, all[i - 1]) > .0001);
  // Remove grid stair-steps only when the entire shortcut remains on valid ground.
  const result: Point[] = [points[0]];
  for (let anchor = 0; anchor < points.length - 1;) {
    let next = points.length - 1;
    while (next > anchor + 1 && !safeGroundSegment(points[anchor], points[next], blocked, bounds)) next--;
    result.push(points[next]);
    anchor = next;
  }
  // Preserve the exact requested point even if it almost coincides with a node.
  result[result.length - 1] = { ...target };
  return result;
}

export const groundRoute = route;
