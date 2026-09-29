import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  appendCourierRoutePoint,
  createCourierSession,
  getCourierRules,
  redrawCourierRoute,
  resolveCourierRoute,
} from '../src/minigames/courier/courierModel';

describe('Courier minigame model', () => {
  it('uses the canonical 2–4 obstacle range and one redraw', () => {
    expect(getCourierRules(balance)).toEqual({
      obstacleCountMin: 2,
      obstacleCountMax: 4,
      redrawsBeforeStart: 1,
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
      'Route intersects an obstacle',
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
      'Route does not reach destination',
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
