import { describe, expect, it } from 'vitest';

import type { StorageAdapter } from '@danilah/mini-games-kit/platform';
import {
  YandexMirroredStorageAdapter,
  type YandexPlayerDataLike,
} from '@danilah/mini-games-kit/yandex';

import { balance } from '../src/config/balance';
import {
  commitBareDrop,
} from '../src/core/plinko-rules/drop';
import {
  createSaveRepository,
  SAVE_STORAGE_KEY,
} from '../src/core/save/repository';
import {
  SAVE_VERSION,
  type SaveState,
} from '../src/core/save/SaveState';
import {
  YANDEX_SAVE_CLOUD_FIELD,
  reconcileYandexSaveRaw,
} from '../src/core/save/yandexPersistence';
import { createInitialGameState } from '../src/core/state/GameState';

class MemoryStorage implements StorageAdapter {
  public readonly data = new Map<string, string>();

  public async getItem(
    key: string,
  ): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  public async setItem(
    key: string,
    value: string,
  ): Promise<void> {
    this.data.set(key, value);
  }

  public async removeItem(
    key: string,
  ): Promise<void> {
    this.data.delete(key);
  }
}

class FakePlayer implements YandexPlayerDataLike {
  public readonly data =
    new Map<string, unknown>();

  public async getData(
    keys?: readonly string[],
  ): Promise<Record<string, unknown>> {
    const selected =
      keys ?? [...this.data.keys()];

    return Object.fromEntries(
      selected.flatMap((key) =>
        this.data.has(key)
          ? [[key, this.data.get(key)]]
          : [],
      ),
    );
  }

  public async setData(
    data: Record<string, unknown>,
  ): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      if (value === null) {
        this.data.delete(key);
      } else {
        this.data.set(key, value);
      }
    }
  }
}

const createMirroredStorage = (
  local: StorageAdapter,
  player: YandexPlayerDataLike,
): StorageAdapter =>
  new YandexMirroredStorageAdapter(
    local,
    player,
    {
      syncKey: SAVE_STORAGE_KEY,
      cloudField: YANDEX_SAVE_CLOUD_FIELD,
      reconcile: reconcileYandexSaveRaw,
    },
  );

const createPendingDropSave = (
  seed: number,
): SaveState => {
  const initial = {
    ...createInitialGameState(
      balance,
      seed,
    ),
    cash: 50_000,
  };
  const committed = commitBareDrop(
    initial,
    null,
    balance,
    `cloud-${seed}`,
    0.25,
  );

  return {
    version: SAVE_VERSION,
    game: committed.state,
    activeAction: null,
    pendingDrop: committed.pendingDrop,
  };
};

describe('T066 Yandex persistence', () => {
  it('mirrors the exact local SaveState JSON without a cloud-only envelope', async () => {
    const local = new MemoryStorage();
    const player = new FakePlayer();
    const repository = createSaveRepository(
      createMirroredStorage(
        local,
        player,
      ),
      () =>
        createInitialGameState(
          balance,
          7_001,
        ),
    );
    const save = createPendingDropSave(7_002);

    await repository.write(save);
    await repository.flush();

    const localRaw =
      await local.getItem(SAVE_STORAGE_KEY);
    const cloudRaw = player.data.get(
      YANDEX_SAVE_CLOUD_FIELD,
    );

    expect(typeof cloudRaw).toBe('string');
    expect(cloudRaw).toBe(localRaw);
    expect(JSON.parse(localRaw!)).toEqual(save);
  });

  it('restores an exact pending Drop from Player Data on an empty device', async () => {
    const sourceLocal = new MemoryStorage();
    const player = new FakePlayer();
    const sourceRepository =
      createSaveRepository(
        createMirroredStorage(
          sourceLocal,
          player,
        ),
        () =>
          createInitialGameState(
            balance,
            7_003,
          ),
      );
    const save = createPendingDropSave(7_004);

    await sourceRepository.write(save);
    await sourceRepository.flush();

    const freshLocal = new MemoryStorage();
    const restoredRepository =
      createSaveRepository(
        createMirroredStorage(
          freshLocal,
          player,
        ),
        () =>
          createInitialGameState(
            balance,
            9_999,
          ),
      );

    const restored =
      await restoredRepository.load();

    expect(restored).toEqual(save);
    expect(
      await freshLocal.getItem(
        SAVE_STORAGE_KEY,
      ),
    ).toBe(
      player.data.get(
        YANDEX_SAVE_CLOUD_FIELD,
      ),
    );
  });

  it('keeps a valid local run authoritative when cloud differs', async () => {
    const local = new MemoryStorage();
    const player = new FakePlayer();
    const localSave =
      createPendingDropSave(7_005);
    const cloudSave =
      createPendingDropSave(7_006);
    const localRaw =
      JSON.stringify(localSave);

    await local.setItem(
      SAVE_STORAGE_KEY,
      localRaw,
    );
    player.data.set(
      YANDEX_SAVE_CLOUD_FIELD,
      JSON.stringify(cloudSave),
    );

    const repository = createSaveRepository(
      createMirroredStorage(
        local,
        player,
      ),
      () =>
        createInitialGameState(
          balance,
          7_007,
        ),
    );

    expect(
      await repository.load(),
    ).toEqual(localSave);
    expect(
      player.data.get(
        YANDEX_SAVE_CLOUD_FIELD,
      ),
    ).toBe(localRaw);
  });

  it('uses valid cloud data to repair a corrupt local copy', async () => {
    const local = new MemoryStorage();
    const player = new FakePlayer();
    const cloudSave =
      createPendingDropSave(7_008);
    const cloudRaw =
      JSON.stringify(cloudSave);

    await local.setItem(
      SAVE_STORAGE_KEY,
      '{broken-json',
    );
    player.data.set(
      YANDEX_SAVE_CLOUD_FIELD,
      cloudRaw,
    );

    const repository = createSaveRepository(
      createMirroredStorage(
        local,
        player,
      ),
      () =>
        createInitialGameState(
          balance,
          7_009,
        ),
    );

    expect(
      await repository.load(),
    ).toEqual(cloudSave);
    expect(
      await local.getItem(SAVE_STORAGE_KEY),
    ).toBe(cloudRaw);
  });

  it('falls back to a fresh run when neither local nor cloud is a valid save', async () => {
    const local = new MemoryStorage();
    const player = new FakePlayer();

    await local.setItem(
      SAVE_STORAGE_KEY,
      '{"version":999}',
    );
    player.data.set(
      YANDEX_SAVE_CLOUD_FIELD,
      'not-json',
    );

    const repository = createSaveRepository(
      createMirroredStorage(
        local,
        player,
      ),
      () =>
        createInitialGameState(
          balance,
          7_010,
        ),
    );

    expect(
      await repository.load(),
    ).toEqual(
      {
        version: SAVE_VERSION,
        game: createInitialGameState(
          balance,
          7_010,
        ),
        activeAction: null,
        pendingDrop: null,
      },
    );
  });
});
