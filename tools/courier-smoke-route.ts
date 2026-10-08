import { COURIER_BUILDINGS, COURIER_INTERACTION, type CourierPoint, type CourierSession } from '../src/minigames/courier/courierModel';

/** Offline fixture routing only: keep browser smoke on streets after adding buildings. */
export const courierSmokeRoute = (session: CourierSession): CourierPoint[] => {
  const step = 20;
  const columns = 47;
  const rows = 25;
  const point = (id: number): CourierPoint => ({ x: 180 + id % columns * step, y: 125 + Math.floor(id / columns) * step });
  const blocked = (id: number) => {
    const p = point(id);
    return [...session.obstacles, ...COURIER_BUILDINGS].some(o =>
      Math.abs(p.x - o.x) <= o.width / 2 + COURIER_INTERACTION.courierHalfSize + 2 &&
      Math.abs(p.y - o.y) <= o.height / 2 + COURIER_INTERACTION.courierHalfSize + 2);
  };
  const start = 12 * columns;
  const finish = start + columns - 1;
  const parents = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let index = 0; index < queue.length && !parents.has(finish); index++) {
    const id = queue[index]!;
    const x = id % columns;
    const y = Math.floor(id / columns);
    const neighbors = [x > 0 ? id - 1 : -1, x < columns - 1 ? id + 1 : -1,
      y > 0 ? id - columns : -1, y < rows - 1 ? id + columns : -1];
    for (const next of neighbors) {
      if (next < 0 || parents.has(next) || blocked(next)) continue;
      parents.set(next, id); queue.push(next);
    }
  }
  if (!parents.has(finish)) throw new Error(`No street route for courier seed ${session.seed}`);
  const path: CourierPoint[] = [];
  for (let id = finish; id >= 0; id = parents.get(id)!) path.unshift(point(id));
  return path.filter((p, i) => i === 0 || i === path.length - 1 ||
    (p.x - path[i - 1]!.x) !== (path[i + 1]!.x - p.x) ||
    (p.y - path[i - 1]!.y) !== (path[i + 1]!.y - p.y));
};
