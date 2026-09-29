import Phaser from 'phaser';

import { createStartupPreloadDomView, StartupPreloadController } from '@danilah/mini-games-kit/startup';

import './style.css';
import { GameAnalytics } from './analytics/GameAnalytics';
import { installDebugPanel } from './app/debug';
import { GAME_AUDIO_BLOCKED_EVENT } from './audio/audioLifecycle';
import { disposeSceneAudioRuntime } from './audio/SceneAudio';
import { createPlatformRuntime } from './app/platform';
import {
  afterPaintFrames,
  detectRuntimeImageFormat,
  getStartupSnapshot,
  startupTimeline,
} from './app/startup';
import { getInitialGameSize, installViewportRuntime } from './app/viewport';
import { BootstrapScene, GAME_PRESENTABLE_EVENT } from './game/BootstrapScene';
import { CourierScene } from './game/CourierScene';
import { DishesScene } from './game/DishesScene';
import { PlinkoDebugScene } from './game/PlinkoDebugScene';
import { TrashScene } from './game/TrashScene';
import { balance } from './config/balance';
import { createRunSeed } from './core/random/runSeed';
import { createSaveRepository } from './core/save/repository';
import { createInitialGameState } from './core/state/GameState';
import { GAME_ANALYTICS_REGISTRY_KEY } from './game/analytics/sceneGameAnalytics';
import { GAME_SAVE_REPOSITORY_REGISTRY_KEY } from './game/save/sceneSaveRepository';

const preload = new StartupPreloadController(createStartupPreloadDomView());
preload.begin();

const platformTask = createPlatformRuntime().then((platform) => {
  startupTimeline.mark('platformReady');
  return platform;
});
const artFormatTask = detectRuntimeImageFormat();

try {
  const [platform, runtimeImageFormat] = await Promise.all([platformTask, artFormatTask]);
  const initialSize = getInitialGameSize();
  const gameAnalytics = new GameAnalytics(
    platform.analytics,
    balance,
  );
  const saveRepository = createSaveRepository(
    platform.storage,
    () =>
      createInitialGameState(
        balance,
        createRunSeed(),
      ),
  );
  let resolvePresentable!: () => void;
  const presentable = new Promise<void>((resolve) => {
    resolvePresentable = resolve;
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    width: Math.round(initialSize.width),
    height: Math.round(initialSize.height),
    backgroundColor: '#0b0d10',
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: balance.plinko.physicsSeed.gravityY },
        enableSleeping: false,
        runner: { fps: balance.plinko.geometry.fixedTimestepHz },
      },
    },
    scene: [
      BootstrapScene,
      DishesScene,
      TrashScene,
      CourierScene,
      PlinkoDebugScene,
    ],
    scale: { mode: Phaser.Scale.NONE },
    callbacks: {
      preBoot: (bootingGame) => {
        bootingGame.registry.set(
          GAME_SAVE_REPOSITORY_REGISTRY_KEY,
          saveRepository,
        );
        bootingGame.registry.set(
          GAME_ANALYTICS_REGISTRY_KEY,
          gameAnalytics,
        );
        bootingGame.events.once(
          GAME_PRESENTABLE_EVENT,
          resolvePresentable,
        );
      },
    },
  });

  const viewport = installViewportRuntime(game, platform.activity);
  const removeBlockedListener = platform.activity.onBlockedChange((blocked) => {
    game.sound.mute = blocked;
    game.events.emit(GAME_AUDIO_BLOCKED_EVENT, blocked);
    if (blocked) game.loop.sleep();
    else game.loop.wake();
  });
  const debug = installDebugPanel(() => getStartupSnapshot(runtimeImageFormat));

  void presentable.then(async () => {
    startupTimeline.mark('gamePresentable');
    await afterPaintFrames(2);
    startupTimeline.mark('ready');
    platform.markReady();
    platform.activity.setGameplayDesired(true);
    preload.complete();
  });

  const handlePageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) return;
    window.removeEventListener('pagehide', handlePageHide);
    platform.activity.setGameplayDesired(false);
    removeBlockedListener();
    disposeSceneAudioRuntime();
    debug.destroy();
    viewport.destroy();
    preload.destroy();
    platform.destroy();
    game.destroy(true);
  };
  window.addEventListener('pagehide', handlePageHide);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  preload.fail(message);
  console.error('Fatal bootstrap failure', error);
}
