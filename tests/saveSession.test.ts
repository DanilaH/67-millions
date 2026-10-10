import { describe, expect, it, vi } from 'vitest';
import { acquireSaveSession, SAVE_SESSION_LOCK, type RequestSaveLock } from '../src/app/saveSession';
import { createSaveRepository } from '../src/core/save/repository';
import { createInitialGameState } from '../src/core/state/GameState';
import { commitBareDrop } from '../src/core/plinko-rules/drop';
import { balance } from '../src/config/balance';

// Model document lifetime separately from the acquisition promise. Resolving
// acquisition must not release the callback's still-held Web Lock.
const lockHost = () => {
  let owned = false;
  const queue: Array<() => void> = [];
  const request: RequestSaveLock = vi.fn(async (name, options, callback) => {
    expect(name).toBe(SAVE_SESSION_LOCK);
    if (owned && options.ifAvailable) return callback(null);
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        owned = true;
        void callback({ name }).then(resolve, reject);
      };
      if (owned) queue.push(grant);
      else grant();
    });
  });
  return { request, closeOwner: () => { owned = false; queue.shift()?.(); } };
};

describe('exclusive save session', () => {
  it('holds ownership after startup and only boots waiting tabs after owner closes', async () => {
    const locks = lockHost();
    const waiting = vi.fn();
    await acquireSaveSession(locks.request, waiting);
    expect(waiting).not.toHaveBeenCalled();
    const secondBoot = vi.fn();
    const second = acquireSaveSession(locks.request, waiting).then(secondBoot);
    await Promise.resolve();
    expect(waiting).toHaveBeenCalledOnce();
    expect(secondBoot).not.toHaveBeenCalled();
    locks.closeOwner();
    await second;
    expect(secondBoot).toHaveBeenCalledOnce();
    // The second tab still owns the lock after its startup resolved.
    const thirdBoot = vi.fn();
    const third = acquireSaveSession(locks.request, waiting).then(thirdBoot);
    await Promise.resolve();
    expect(thirdBoot).not.toHaveBeenCalled();
    locks.closeOwner();
    await third;
    expect(thirdBoot).toHaveBeenCalledOnce();
  });

  it('waiting startup reads fresh cash and the complete paid-root ledger, not a stale snapshot', async () => {
    const locks = lockHost();
    let raw: string | null = null;
    const storage = {
      getItem: async () => raw,
      setItem: async (_key: string, value: string) => { raw = value; },
      removeItem: async () => { raw = null; },
    };
    const createGame = () => createInitialGameState(balance, 123);
    await acquireSaveSession(locks.request, () => {});
    const first = createSaveRepository(storage, createGame);
    const initial = await first.load();
    initial.game.cash = 3125;
    await first.write(initial);
    const read = vi.fn(async () => createSaveRepository(storage, createGame).load());
    const second = acquireSaveSession(locks.request, () => {}).then(read);
    await Promise.resolve();
    expect(read).not.toHaveBeenCalled();
    initial.game.cash += 10000;
    const committed = commitBareDrop(initial.game, null, balance, 'session-transfer', 1);
    const paid = { ...initial, game: committed.state, pendingDrop: committed.pendingDrop };
    await first.write(paid);
    await first.flush();
    const durable = raw;
    locks.closeOwner();
    const restored = await second;
    expect(restored).toEqual(paid);
    expect(raw).toBe(durable);
    expect(restored.game.cash).toBe(12625);
    expect(restored.pendingDrop).not.toBeNull();
  });

  it('fails closed when Web Locks are unavailable', async () => {
    const boot = vi.fn();
    await expect(acquireSaveSession(undefined, boot)).rejects.toThrow('HTTPS');
    expect(boot).not.toHaveBeenCalled();
  });

  it('propagates lock failures without starting a competing writer', async () => {
    const request: RequestSaveLock = async () => { throw new Error('blocked'); };
    await expect(acquireSaveSession(request, () => {})).rejects.toThrow('blocked');
  });
});
