import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  appendCourierRoutePoint,
  cancelCourierRoute,
  releaseCourierRoute,
  courierRouteReachesFinish,
  startCourierDelivery,
  advanceCourierSession,
  createCourierSession,
  getCourierRules,
  redrawCourierRoute,
  resolveCourierRoute,
} from '../src/minigames/courier/courierModel';

describe('Courier minigame model', () => {
  it('uses the canonical 2–4 obstacle range and retains the legacy redraw config', () => {
    expect(getCourierRules(balance)).toEqual({
      obstacleCountMin: 2,
      obstacleCountMax: 4,
      redrawsBeforeStart: 1,
      travelRealSeconds: 3,
    });

    const session = createCourierSession(balance, 901);
    expect(session.obstacles.length).toBeGreaterThanOrEqual(2);
    expect(session.obstacles.length).toBeLessThanOrEqual(4);
    expect(session.redrawsRemaining).toBe(1);
  });

  it('generates exactly the same obstacle layout from the same seed', () => {
    const a = createCourierSession(balance, 902);
    const b = createCourierSession(balance, 902);
    const c = createCourierSession(balance, 903);

    expect(b.obstacles).toEqual(a.obstacles);
    expect(c.obstacles).not.toEqual(a.obstacles);
  });

  it('allows exactly one route redraw before start', () => {
    let session = createCourierSession(balance, 904);
    session = appendCourierRoutePoint(
      session,
      session.start,
    );
    session = appendCourierRoutePoint(
      session,
      { x: 300, y: 300 },
    );

    const redrawn = redrawCourierRoute(session);
    expect(redrawn.route).toEqual([]);
    expect(redrawn.redrawsRemaining).toBe(0);

    const second = redrawCourierRoute({
      ...redrawn,
      route: [redrawn.start, { x: 300, y: 300 }],
    });
    expect(second.route).toHaveLength(2);
    expect(second.redrawsRemaining).toBe(0);
  });

  it('passes a deterministic route that goes around every obstacle', () => {
    let session = createCourierSession(balance, 905);

    const safeRoute = [
      session.start,
      { x: session.start.x, y: 600 },
      { x: session.finish.x, y: 600 },
      session.finish,
    ];

    for (const point of safeRoute) {
      session = appendCourierRoutePoint(
        session,
        point,
      );
    }

    const resolved = resolveCourierRoute(session);
    expect(resolved.result).toBe('SUCCESS');
    expect(resolved.failureReason).toBeNull();
    expect(resolved.started).toBe(true);
  });

  it('fails deterministically when the route intersects an obstacle', () => {
    let session = createCourierSession(balance, 906);
    const obstacle = session.obstacles[0]!;

    for (const point of [
      session.start,
      { x: obstacle.x, y: obstacle.y },
      session.finish,
    ]) {
      session = appendCourierRoutePoint(
        session,
        point,
      );
    }

    const resolved = resolveCourierRoute(session);
    expect(resolved.result).toBe('FAILURE');
    expect(resolved.failureReason).toBe(
      'Курьер врезался в препятствие',
    );
  });

  it('fails when the drawn route does not reach the destination', () => {
    let session = createCourierSession(balance, 907);
    session = appendCourierRoutePoint(
      session,
      session.start,
    );
    session = appendCourierRoutePoint(
      session,
      { x: 300, y: 580 },
    );

    const resolved = resolveCourierRoute(session);
    expect(resolved.result).toBe('FAILURE');
    expect(resolved.failureReason).toBe(
      'Маршрут закончился до точки доставки',
    );
  });

  it('locks redraw and further drawing after START resolves the route', () => {
    let session = createCourierSession(balance, 908);

    for (const point of [
      session.start,
      { x: session.start.x, y: 600 },
      { x: session.finish.x, y: 600 },
      session.finish,
    ]) {
      session = appendCourierRoutePoint(
        session,
        point,
      );
    }

    const resolved = resolveCourierRoute(session);
    const routeBefore = resolved.route;

    expect(
      appendCourierRoutePoint(
        resolved,
        { x: 640, y: 300 },
      ).route,
    ).toEqual(routeBefore);
    expect(redrawCourierRoute(resolved).route).toEqual(routeBefore);
  });
});

describe('Courier physical traversal regressions', () => {
  it('starts at pickup and reaches the delivery point only after travelling', () => {
    let session = createCourierSession(balance, 905);
    for (const p of [session.start, { x: 180, y: 600 }, { x: 1100, y: 600 }, session.finish]) session = appendCourierRoutePoint(session, p);
    session = startCourierDelivery(session);
    expect(session.result).toBeNull();
    expect(session.position).toEqual(session.start);
    session = advanceCourierSession(session, 500);
    expect(session.result).toBeNull();
    expect(session.position.y).toBeGreaterThan(session.start.y);
    session = advanceCourierSession(session, 10_000);
    expect(session.result).toBe('SUCCESS');
    expect(session.position).toEqual(session.finish);
  });

  it('fails at first sprite contact, not at START or beyond the obstacle', () => {
    let session = createCourierSession(balance, 905);
    session = { ...session, obstacles: [{ id: 'wall', x: 600, y: 365, width: 120, height: 115 }], route: [session.start, session.finish] };
    const started = startCourierDelivery(session);
    const before = advanceCourierSession(started, 1000);
    expect(before.result).toBeNull();
    expect(before.position.x).toBeCloseTo(180 + 920 / 3);
    const collided = advanceCourierSession(before, 1000);
    expect(collided.result).toBe('FAILURE');
    expect(collided.position.x).toBe(511); // box edge 540 minus sprite half-size 29
    const giantFrame = advanceCourierSession(started, 10_000);
    expect(giantFrame.position).toEqual(collided.position);
    expect(advanceCourierSession(collided, 1000)).toBe(collided);
  });

  it('does not treat collinear but disjoint box edges as a collision', () => {
    let session = createCourierSession(balance, 905);
    session = { ...session, obstacles: [{ id: 'far', x: 900, y: 278.5, width: 120, height: 115 }], route: [session.start, { x: 300, y: 365 }] };
    const ended = advanceCourierSession(startCourierDelivery(session), 3000);
    expect(ended.position.x).toBe(300);
    expect(ended.failureReason).toBe('Маршрут закончился до точки доставки');
  });

  it('anchors a near-pickup stroke to the character and ignores invalid input', () => {
    const empty = createCourierSession(balance, 905);
    expect(redrawCourierRoute(empty)).toBe(empty);
    expect(startCourierDelivery(empty)).toBe(empty);
    expect(appendCourierRoutePoint(empty, { x: NaN, y: 365 })).toBe(empty);
    const drawn = appendCourierRoutePoint(empty, { x: 200, y: 365 });
    expect(drawn.route[0]).toEqual(empty.start);
    expect(drawn.route[1]).toEqual({ x: 200, y: 365 });
    expect(() => advanceCourierSession(drawn, -1)).toThrow();
  });
});


describe('Courier continuous gesture', () => {
  it('discards an incomplete route without spending redraws or failing the job', () => {
    const initial = createCourierSession(balance, 912);
    const partial = appendCourierRoutePoint(appendCourierRoutePoint(initial, initial.start), { x: 300, y: 600 });
    expect(courierRouteReachesFinish(partial)).toBe(false);
    const cancelled = cancelCourierRoute(partial);
    expect(cancelled).toEqual(initial);
    expect(appendCourierRoutePoint(cancelled, { x: 300, y: 600 }).route).toEqual([]);
  });

  it('recognizes the finish zone, snaps to its center and locks the committed route', () => {
    const initial = createCourierSession(balance, 913);
    const completed = appendCourierRoutePoint(appendCourierRoutePoint(initial, initial.start), { x: initial.finish.x - initial.finishRadius + 1, y: initial.finish.y });
    expect(courierRouteReachesFinish(completed)).toBe(true);
    const started = startCourierDelivery(completed);
    expect(started.started).toBe(true);
    expect(started.route.at(-1)).toEqual(initial.finish);
    expect(cancelCourierRoute(started)).toBe(started);
    expect(appendCourierRoutePoint(started, initial.start)).toBe(started);
  });
});


describe('Courier release and fixed duration', () => {
  it('waits at the finish while held and cancels releases outside it', () => {
    let s = createCourierSession(balance, 905);
    s = { ...s, obstacles: [], route: [s.start, s.finish] };
    expect(advanceCourierSession(s, 5000).started).toBe(false);
    expect(releaseCourierRoute(s, { x: 2000, y: 365 }).route).toEqual([]);
    expect(releaseCourierRoute(s, { x: 900, y: 365 }).started).toBe(false);
    expect(releaseCourierRoute(s, s.finish).started).toBe(true);
  });
  it.each([false, true])('finishes at three seconds regardless of path length (detour=%s)', detour => {
    let s = createCourierSession(balance, 905);
    s = startCourierDelivery({ ...s, obstacles: [], route: detour ? [s.start, { x: 180, y: 600 }, { x: 1100, y: 600 }, s.finish] : [s.start, s.finish] });
    const whole = advanceCourierSession(s, 3000);
    for (const ms of [16, 500, 333, 1000, 1150]) s = advanceCourierSession(s, ms);
    expect(s.elapsedMs).toBe(2999);
    expect(s.result).toBeNull();
    s = advanceCourierSession(s, 1);
    expect(s.result).toBe('SUCCESS');
    expect(s.position).toEqual(whole.position);
    expect(s.elapsedMs).toBe(3000);
    expect(s.heading).toBeCloseTo(detour ? -Math.PI / 2 : 0);
  });
});
