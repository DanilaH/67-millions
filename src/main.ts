import Phaser from 'phaser';
import { ACTION_PANEL_VISIBILITY_EVENT } from './game/map/createActionPanel';
import { EndRunAds, END_RUN_ADS_KEY } from './app/EndRunAds';
import { GameAnalytics, GAME_ANALYTICS_KEY } from './app/analytics/GameAnalytics';

import { createStartupPreloadDomView, StartupPreloadController } from '@danilah/mini-games-kit/startup';

import './style.css';
import { createSaveRecovery } from './app/saveRecovery';
import { withSaveRetry } from './core/save/retryStorage';
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
import { BootstrapScene } from './game/BootstrapScene';
import { GAME_PRESENTABLE_EVENT } from './app/presentable';
import { CourierScene } from './game/CourierScene';
import { DishesScene } from './game/DishesScene';
import { PlinkoDebugScene } from './game/PlinkoDebugScene';
import { TrashScene } from './game/TrashScene';
import { balance } from './config/balance';
import { createRunSeed } from './core/random/runSeed';
import { createSaveRepository } from './core/save/repository';
import { createInitialGameState } from './core/state/GameState';
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
  const analytics = new GameAnalytics(platform.analytics, balance);
  const saveRecovery = createSaveRecovery(platform.activity);
  const saveRepository = createSaveRepository(
    withSaveRetry(platform.storage, saveRecovery),
    () =>
      createInitialGameState(
        balance,
        createRunSeed(),
      ),
    analytics,
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
    transparent: true,
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
        bootingGame.registry.set(GAME_ANALYTICS_KEY, analytics);
        bootingGame.registry.set(END_RUN_ADS_KEY, new EndRunAds(platform.ads));
        bootingGame.registry.set(
          GAME_SAVE_REPOSITORY_REGISTRY_KEY,
          saveRepository,
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
    else {
      // Sleeping time must never enter the next active raw delta.
      game.loop.resetDelta();
      game.loop.wake();
    }
  });
  const debug = installDebugPanel(
    () => getStartupSnapshot(runtimeImageFormat),
    async (command) => {
      const scene = game.scene.getScene('bootstrap');
      if (!(scene instanceof BootstrapScene) || !scene.scene.isActive()) throw new Error('Открой карту и дождись завершения бросков / работы');
      await scene.applyPreviewDebug(command);
    },
    (paused) => {
      game.canvas.style.pointerEvents = paused ? 'none' : '';
      platform.activity.setBlocked('preview-debug', paused);
    },
  );

  const updateDebugVisibility = () => debug.setVisible(game.scene.isActive('bootstrap') && !game.canvas.hasAttribute('data-action-targets'));
  game.events.on(GAME_PRESENTABLE_EVENT, updateDebugVisibility);
  game.events.on(ACTION_PANEL_VISIBILITY_EVENT, updateDebugVisibility);
  updateDebugVisibility();

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
    game.events.off(GAME_PRESENTABLE_EVENT, updateDebugVisibility);
    game.events.off(ACTION_PANEL_VISIBILITY_EVENT, updateDebugVisibility);
    debug.destroy();
    viewport.destroy();
    saveRecovery.destroy();
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
