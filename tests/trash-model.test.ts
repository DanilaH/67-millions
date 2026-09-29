import { describe, expect, it } from 'vitest';

import { balance } from '../src/config/balance';
import {
  advanceTrashSession,
  createTrashSession,
  dropTrashBag,
  findTrashBagAtPoint,
  getAcceptedTrashBagCount,
  getTrashRemainingMs,
  getTrashRules,
  isTrashTargetAcceptingPoint,
  moveTrashBag,
} from '../src/minigames/trash/trashModel';

describe('Trash minigame model', () => {
  it('uses the canonical 25-second / five-bag rules', () => {
    expect(getTrashRules(balance)).toEqual({
      timerRealSeconds: 25,
      bagCount: 5,
    });

    const session = createTrashSession(balance);
    expect(session.durationMs).toBe(25_000);
    expect(session.bags).toHaveLength(5);
    expect(getAcceptedTrashBagCount(session)).toBe(0);
  });

  it('supports forgiving pickup around the bag center', () => {
    const session = createTrashSession(balance);
    const bag = session.bags[0]!;

    expect(
      findTrashBagAtPoint(session, {
        x: bag.x + session.grabRadius - 2,
        y: bag.y,
      }),
    ).toBe(bag.id);

    expect(
      findTrashBagAtPoint(session, {
        x: bag.x + session.grabRadius + 10,
        y: bag.y,
      }),
    ).toBeNull();
  });

  it('accepts a bag slightly outside the visible dumpster rectangle', () => {
    const session = createTrashSession(balance);
    const bag = session.bags[0]!;
    const forgivingPoint = {
      x:
        session.target.x -
        session.target.forgivingMargin +
        2,
      y: session.target.y + 30,
    };

    expect(
      isTrashTargetAcceptingPoint(
        session,
        forgivingPoint,
      ),
    ).toBe(true);

    const dropped = dropTrashBag(
      session,
      bag.id,
      forgivingPoint,
    );
    expect(dropped.bags[0]?.accepted).toBe(true);
    expect(getAcceptedTrashBagCount(dropped)).toBe(1);
  });

  it('keeps an unaccepted bag at its dropped position for an easy retry', () => {
    const session = createTrashSession(balance);
    const bag = session.bags[0]!;
    const point = { x: 600, y: 620 };

    const moved = moveTrashBag(
      session,
      bag.id,
      point,
    );
    const dropped = dropTrashBag(
      moved,
      bag.id,
      point,
    );

    expect(dropped.bags[0]).toMatchObject({
      id: bag.id,
      x: point.x,
      y: point.y,
      accepted: false,
    });
  });

  it('succeeds immediately once all five bags are accepted', () => {
    let session = createTrashSession(balance);
    const point = {
      x: session.target.x + session.target.width / 2,
      y: session.target.y + session.target.height / 2,
    };

    for (const bag of session.bags) {
      session = dropTrashBag(
        session,
        bag.id,
        point,
      );
    }

    expect(getAcceptedTrashBagCount(session)).toBe(5);
    expect(session.result).toBe('SUCCESS');
    expect(session.elapsedMs).toBe(0);
  });

  it('fails exactly at the 25-second deadline if any bag remains', () => {
    let session = createTrashSession(balance);

    session = advanceTrashSession(session, 24_999);
    expect(session.result).toBeNull();
    expect(getTrashRemainingMs(session)).toBe(1);

    session = advanceTrashSession(session, 1);
    expect(session.elapsedMs).toBe(25_000);
    expect(session.result).toBe('FAILURE');
  });
});
