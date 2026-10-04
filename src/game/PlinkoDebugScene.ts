import { PersistentHud } from './ui/PersistentHud';
import { PlinkoEffects } from './casino/PlinkoEffects';
import { installScenePresentation } from './visual/scenePresentation';
import { activeDrops, appendDrop, canLaunchDrop, findBallDrop, recordDropPayout, removeSettledDrop } from '../core/plinko-rules/concurrentDrops';

import { formatCasinoResult } from './casino/casinoPayoutToast';
import Phaser from 'phaser';
import { GAME_PRESENTABLE_EVENT } from '../app/presentable';
import { createPinTextures } from './casino/createPinTextures';
import { preloadProductionArt, addProductionImage, productionArtKey } from './visual/productionArt';
import { GAME_ANALYTICS_KEY, type GameAnalytics } from '../app/analytics/GameAnalytics';

import { ActiveTimeAccumulator } from '../core/time/ActiveTimeAccumulator';
import { advanceRunTime } from '../core/time/runTime';
import { balance } from '../config/balance';
import { resolvePendingBoardConfig } from '../core/plinko-rules/restoreBoardConfig';
import {
  PlinkoAudio,
  shouldUseBigJackpotStinger,
} from '../audio/PlinkoAudio';
import { SceneAudio } from '../audio/SceneAudio';
import { GAME_AUDIO_BLOCKED_EVENT } from '../audio/audioLifecycle';
import {
  clearPlinkoPerfProbe,
  isPlinkoPerfMode,
} from '../app/perfMode';
import {
  assertDropBoardCompatible,
  commitBareDrop,
  settleAggregateDrop,
  calculateBallPocketPayout,
  setDropPhysicsSnapshot,
  type BetFraction,
  type DropBallSnapshot,
  type DropBallState,
} from '../core/plinko-rules/drop';
import {
  advancePendingDropTime,
  settleAggregatePendingDropAndResumeTime,
} from '../core/plinko-rules/dropTiming';
import {
  purchaseInsuranceUpgrade,
  purchaseMaxBetUpgrade,
  purchasePocketUpgrade,
  purchaseSpecialUpgrade,
} from '../core/plinko-rules/progression';
import { deriveJackpotBiasGeometry } from '../core/plinko-rules/jackpotBias';
import {
  canAmplifyAt,
  canReturnLineage,
  canSplitAt,
  clearSplitterBlockAfterPeg,
  createRootBallState,
  createSplitChildren,
  deriveActiveSpecialPins,
  markAmplifierProc,
  markReturnUsed,
} from '../core/plinko-rules/cascade';
import { SeededRandom } from '../core/rng/SeededRandom';
import type { SaveRepository } from '../core/save/repository';
import { createInitialGameState } from '../core/state/GameState';
import { SAVE_VERSION, type SaveState } from '../core/save/SaveState';
import {
  createBarePlinko,
  type BarePlinkoRuntime,
} from '../phaser/plinko/createBarePlinko';
import {
  buildCasinoQuickBets,
  buildCasinoUpgradePreviews,
  type CasinoUpgradeId,
} from './casino/casinoUiModel';
import {
  createCasinoBetPanel,
  type CasinoBetPanel,
} from './casino/createCasinoBetPanel';
import {
  createCasinoUpgradePanel,
  type CasinoUpgradePanel,
} from './casino/createCasinoUpgradePanel';
import { publishCasinoPayoutToast } from './casino/casinoPayoutToast';
import {
  derivePlinkoVisualSnapshot,
  getPegVisualRole,
  getPocketVisualRole,
  type PlinkoVisualSnapshot,
} from './casino/plinkoVisualModel';
import {
  SPECIAL_PIN_STYLE,
  VISUAL_FONT,
  visualColor,
  visualHex,
} from './visual/visualTheme';
import {
  acknowledgeCurrentTutorialInfo,
  deriveTutorialStep,
  loadTutorialProgress,
  recordTutorialMilestone,
} from './tutorial/tutorialProgress';
import { buildTutorialCard } from './tutorial/tutorialUiModel';
import {
  createTutorialCard,
  type TutorialCard,
} from './tutorial/createTutorialCard';
import { getSceneSaveRepository } from './save/sceneSaveRepository';

export class PlinkoDebugScene extends Phaser.Scene {
  private boardConfig = balance;
  private effects?: PlinkoEffects;
  private mapHud?: PersistentHud;
  private casinoHud?: PersistentHud;
  private runtime: BarePlinkoRuntime | null = null;
  private random: SeededRandom | null = null;
  private save: SaveState | null = null;
  private repository: SaveRepository | null = null;
  private readonly balls = new Map<MatterJS.BodyType, DropBallState>();
  private saveWriteChain: Promise<void> = Promise.resolve();
  private cascadeMutationChain: Promise<void> = Promise.resolve();
  private physicsSaveQueued = false;
  private lastPersistedPhysicsTick = 0;
  private visibilityHandler: (() => void) | null = null;
  private audio: PlinkoAudio | null = null;
  private worldAudio: SceneAudio | null = null;

  private casinoLayer?: Phaser.GameObjects.Container;
  private staticBoardGraphics?: Phaser.GameObjects.Graphics;
  private ballImages: Phaser.GameObjects.Image[] = [];
  private pegImages: Phaser.GameObjects.Image[] = [];
  private mapLayer?: Phaser.GameObjects.Container;
  private infoText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private mapMessageText?: Phaser.GameObjects.Text;
  private mapMode = false;
  private leaving = false;
  private readonly idleTime = new ActiveTimeAccumulator(this.boardConfig.time.realSecondsPerGameMinute);
  private lastResultMessage = '';
  private betPanel?: CasinoBetPanel;
  private upgradePanel?: CasinoUpgradePanel;
  private resultText?: Phaser.GameObjects.Text;
  private readonly pocketLabels: Phaser.GameObjects.Text[] = [];
  private tutorialCard?: TutorialCard;
  private visualSnapshot: PlinkoVisualSnapshot | null = null;

  public constructor() {
    super('plinko-debug');
  }

  public preload(): void {
    preloadProductionArt(this, ['map', 'casino', 'barry-due', 'barry-paid']);
  }

  public create(): void {
    installScenePresentation(this);
    this.save = null;
    this.mapMode = false;
    this.leaving = false;
    this.lastResultMessage = '';
    this.visualSnapshot = null;
    this.pocketLabels.length = 0;
    this.physicsSaveQueued = false;
    this.lastPersistedPhysicsTick = 0;
    this.saveWriteChain = Promise.resolve();
    this.cascadeMutationChain = Promise.resolve();

    this.casinoLayer = this.add.container(0, 0);
    // Draw the painted frame as four cropped strips rather than shading every board pixel.
    const frameSize = this.textures.get(productionArtKey('casino')).getSourceImage();
    const border = 40;
    for (const [x, y, width, height] of [
      [0, 0, frameSize.width, border],
      [0, frameSize.height - border, frameSize.width, border],
      [0, border, border, frameSize.height - 2 * border],
      [frameSize.width - border, border, border, frameSize.height - 2 * border],
    ]) {
      this.casinoLayer.add(addProductionImage(this, 'casino', 640, 400, 600, 590).setCrop(x, y, width, height));
    }
    this.mapLayer = this.add.container(0, 0).setVisible(false);

    this.staticBoardGraphics = this.add.graphics();
    this.casinoLayer.add(this.staticBoardGraphics);
    this.effects = new PlinkoEffects(this, this.casinoLayer);
    this.ballImages = [];
    this.pegImages = [];
    createPinTextures(this, this.boardConfig.plinko.geometry.pegRadius);
    const radius = this.boardConfig.plinko.geometry.ballRadius;
    const size = (radius + 4) * 2;
    for (const kind of ['normal', 'amplified', 'split'] as const) {
      const key = `67m:ball:${kind}`;
      if (this.textures.exists(key)) continue;
      const stamp = this.add.graphics();
      stamp.fillStyle(visualColor(kind === 'amplified' ? 'mustard' : kind === 'split' ? 'paperOld' : 'textMain'), 1);
      stamp.fillCircle(size / 2, size / 2, radius);
      if (kind !== 'normal') {
        stamp.lineStyle(2, visualColor(kind === 'amplified' ? 'rust' : 'cold'), 0.95);
        stamp.strokeCircle(size / 2, size / 2, radius + 2);
      }
      stamp.generateTexture(key, size, size);
      stamp.destroy();
    }
    for (let index = 0; index < this.boardConfig.plinko.maxActiveBalls; index += 1) {
      const image = this.add.image(0, 0, '67m:ball:normal').setVisible(false);
      this.ballImages.push(image);
      this.casinoLayer.add(image);
    }

    const hudStart = this.children.list.length;
    this.casinoHud = new PersistentHud(this, this.boardConfig);
    this.casinoLayer.add(this.children.list.slice(hudStart));
    this.infoText = this.add.text(28, 155, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.mono,
      fontSize: '21px',
      lineSpacing: 4,
    });
    this.casinoLayer.add(this.infoText);

    this.statusText = this.add
      .text(28, 605, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '14px',
        wordWrap: { width: 280 },
      })
      .setOrigin(0, 0);
    this.casinoLayer.add(this.statusText);

    this.resultText = this.add
      .text(28, 470, '', {
        color: visualHex('mustard'),
        backgroundColor: visualHex('inkPanel'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '17px',
        padding: { x: 10, y: 8 },
        wordWrap: { width: 264 },
      })
      .setOrigin(0, 0)
      .setVisible(false);
    this.casinoLayer.add(this.resultText);

    this.audio = new PlinkoAudio(() => this.game.sound.mute);
    this.worldAudio = new SceneAudio(this, 'casino');
    this.input.on('pointerdown', this.handleAudioPrime);
    this.game.events.on(
      GAME_AUDIO_BLOCKED_EVENT,
      this.handleAudioBlocked,
    );
    this.matter.world.on('collisionstart', this.handleAudioCollision);

    this.installMapLayer();
    this.tutorialCard = createTutorialCard(
      this,
      (step) => {
        acknowledgeCurrentTutorialInfo(step);
        this.renderTutorial();
      },
      'casino',
    );
    void this.initialize();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      void this.persistPendingPhysics(true);
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
      this.matter.world?.off('collisionstart', this.handleAudioCollision);
      this.input.off('pointerdown', this.handleAudioPrime);
      this.game.events.off(
        GAME_AUDIO_BLOCKED_EVENT,
        this.handleAudioBlocked,
      );
      clearPlinkoPerfProbe();
      this.audio?.dispose();
      this.audio = null;
      this.worldAudio?.dispose();
      this.worldAudio = null;
      this.runtime?.destroy();
      this.runtime = null;
      this.balls.clear();
    });
  }

  public update(_time: number, deltaMs: number): void {
    if (this.save && this.runtime && !this.leaving && !this.save.pendingDrop && !isPlinkoPerfMode()) {
      if (this.save.game.barryInterruptPending || this.save.game.terminalReason !== null ||
          this.save.game.victory || this.save.game.pendingEventId !== null) {
        void this.leaveCasino();
      } else {
        const minutes = this.idleTime.consume(deltaMs / 1000, true);
        if (minutes > 0) this.advanceCasinoTime(minutes);
      }
    }
    if (!this.staticBoardGraphics || this.mapMode) return;

    this.effects?.render(this.balls.keys());
    let index = 0;
    for (const [ball, metadata] of this.balls) {
      const kind = metadata.currentValue > 1 ? 'amplified' : metadata.splitDepth > 0 ? 'split' : 'normal';
      const image = this.ballImages[index] ?? (this.ballImages[index] = this.add.image(0, 0, `67m:ball:${kind}`));
      if (!image.parentContainer) this.casinoLayer!.add(image);
      const texture = `67m:ball:${kind}`;
      if (image.texture.key !== texture) image.setTexture(texture);
      image.setPosition(ball.position.x, ball.position.y).setVisible(true);
      index += 1;
    }
    for (; index < this.ballImages.length; index += 1) this.ballImages[index]!.setVisible(false);
  }

  private async initialize(): Promise<void> {
    this.repository = getSceneSaveRepository(this);
    this.save = await this.repository.load();
    this.boardConfig = resolvePendingBoardConfig(balance, this.save.pendingDrop);
    if (isPlinkoPerfMode() && new URLSearchParams(window.location.search).get('stress') === '24') {
      this.save = { version: SAVE_VERSION, activeAction: null, pendingDrop: null, game: {
        ...createInitialGameState(this.boardConfig, 67072000), cash: 50_000_000,
        plinkoCenterLevel: 2, plinkoMidLevel: 3, plinkoJackpotLevel: 3,
        plinkoAmplifierLevel: 5, plinkoReturnLevel: 4, plinkoSplitterLevel: 5,
        plinkoJackpotBiasLevel: 4,
      }};
    }
    this.refreshVisualSnapshot();

    const pendingAtLoad = this.save.pendingDrop;
    if (pendingAtLoad?.physics && !pendingAtLoad.physics.solver) {
      // Older pose-only snapshots cannot preserve the warmed solver's exact outcome.
      // Stop before constructing or persisting physics; keep the original save intact.
      this.save = null;
      this.showStatus('Сохранение каскада устарело. Данные не изменены; продолжение этого броска недоступно.');
      this.game.canvas.setAttribute('aria-label', 'Казино Plinko');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);
      return;
    }
    this.random = new SeededRandom(
      pendingAtLoad?.physics === null
        ? pendingAtLoad.rngStateAtCommit
        : this.save.game.rngState,
    );
    this.runtime = createBarePlinko(this, this.boardConfig, { next: () => this.random!.next() }, {
      onPocket: (index, body) => {
        const multiplier =
          this.visualSnapshot?.pocketMultipliers[index] ??
          this.boardConfig.plinko.basePockets[index] ??
          1;
        this.audio?.pocket(
          multiplier,
          getPocketVisualRole(index, this.boardConfig) === 'jackpot',
        );
        this.enqueueCascadeMutation(() =>
          this.resolvePocket(index, body),
        );
      },
      onPeg: (pegId, body) => {
        this.effects?.hit(body.position.x, body.position.y);
        this.enqueueCascadeMutation(() => this.resolvePeg(pegId, body));
      },
      onFixedTick: (fixedTicksElapsed) => {
        // Derive passive cascade minutes from saved solver ticks, so reload does
        // not reset the minute phase or change the outcome. Barry freezes time.
        if (this.save?.pendingDrop && !isPlinkoPerfMode()) {
          const ticksPerMinute = 60 * this.boardConfig.time.realSecondsPerGameMinute;
          if (Math.floor(fixedTicksElapsed / ticksPerMinute) >
              Math.floor((fixedTicksElapsed - 1) / ticksPerMinute)) this.advanceCasinoTime(1, false);
        }
        const probe = window.__PLINKO_PERF__;
        if (probe?.phase === 'running') {
          probe.activeBallCount = this.balls.size;
          probe.maxActiveBallCount = Math.max(probe.maxActiveBallCount ?? 0, this.balls.size);
        }
        if (
          this.save?.pendingDrop &&
          fixedTicksElapsed - this.lastPersistedPhysicsTick >= 15
        ) {
          void this.persistPendingPhysics(false);
        }
      },
    });
    this.runtime.setJackpotBiasLevel(
      pendingAtLoad?.specialLevelsAtCommit.jackpotBiasLevel ??
        this.save.game.plinkoJackpotBiasLevel,
    );

    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        void this.persistPendingPhysics(true);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.drawStaticBoard();
    this.installPocketLabels();
    this.installCasinoControls();

    if (pendingAtLoad) {
      assertDropBoardCompatible(pendingAtLoad, this.boardConfig, this.save.game);
      this.runtime.setJackpotBiasLevel(
        pendingAtLoad.specialLevelsAtCommit.jackpotBiasLevel,
      );

      if (pendingAtLoad.physics && pendingAtLoad.physics.balls.length > 0) {
        this.runtime.setFixedTicksElapsed(pendingAtLoad.physics.fixedTicksElapsed);
        this.lastPersistedPhysicsTick = pendingAtLoad.physics.fixedTicksElapsed;

        for (const snapshot of pendingAtLoad.physics.balls) {
          const body = this.runtime.restoreBall(snapshot);
          this.balls.set(body, this.metadataFromSnapshot(snapshot));
        }
        if (pendingAtLoad.physics.solver) this.runtime.restoreSolver(pendingAtLoad.physics.solver, this.balls);

        this.showStatus(
          `RESTORED DROP ${pendingAtLoad.dropId} at fixed tick ${pendingAtLoad.physics.fixedTicksElapsed}.`,
        );
      } else {
        const timed = advancePendingDropTime(
          this.save.game,
          pendingAtLoad,
          this.boardConfig,
        );
        this.save = {
          ...this.save,
          game: timed.state,
          pendingDrop: timed.pendingDrop,
        };
        await this.enqueueSave(true);

        if (this.save.game.terminalReason === null) {
          const body = this.runtime.spawnBall();
          this.balls.set(
            body,
            createRootBallState(pendingAtLoad.dropId),
          );
          this.save = {
            ...this.save,
            game: {
              ...this.save.game,
              rngState: this.random.snapshot().state,
            },
          };
          await this.persistPendingPhysics(true);
          this.showStatus(
            `REPLAYED COMMITTED DROP ${pendingAtLoad.dropId} from its durable commit RNG state.`,
          );
        } else {
          this.showStatus(
            `DROP ${pendingAtLoad.dropId} stopped by terminal run state before physics spawn.`,
          );
        }
      }
    }

    this.renderAll();
    this.game.canvas.setAttribute('aria-label', 'Казино Plinko');
      this.game.events.emit(GAME_PRESENTABLE_EVENT);

    if (isPlinkoPerfMode() && !this.save.pendingDrop) {
      this.installPerfProbe();
    }
  }

  private installCasinoControls(): void {
    if (!this.casinoLayer) return;

    this.betPanel = createCasinoBetPanel(
      this,
      (preview) => {
        if (preview.lockedReason !== null) {
          this.showStatus(preview.lockedReason);
          return;
        }
        this.audio?.prime();
        this.enqueueCascadeMutation(() => this.commitAndSpawn(preview.fraction));
      },
      this.casinoLayer,
    );

    this.upgradePanel = createCasinoUpgradePanel(
      this,
      (id) => {
        void this.purchaseUpgrade(id);
      },
      this.casinoLayer,
    );

    const leaveButton = this.add
      .text(1040, 640, '[ НА КАРТУ ]', {
        color: visualHex('textMain'),
        backgroundColor: visualHex('inkRaised'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.leaveCasino());
    this.casinoLayer.add(leaveButton);
  }

  private advanceCasinoTime(minutes: number, persist = true): void {
    if (!this.save || this.save.game.barryInterruptPending || this.save.game.terminalReason !== null || this.save.game.victory) return;
    const advanced = advanceRunTime(this.save.game, null, minutes, this.boardConfig);
    this.save = { ...this.save, game: advanced.state };
    // Event checkpoints and Plinko share the authoritative RNG stream.
    this.random = new SeededRandom(this.save.game.rngState);
    // A pending cascade writes time together with the matching solver tick in
    // persistPendingPhysics below. An intermediate old-tick/new-clock save
    // would charge the same minute again after a crash at the boundary.
    if (persist) void this.enqueueSave(false);
    this.renderAll();
  }

  private installMapLayer(): void {
    if (!this.mapLayer) return;
    const map = addProductionImage(this, 'map', 640, 360, 1280, 720);
    const source = map.texture.getSourceImage();
    const cover = Math.max(1280 / source.width, 720 / source.height);
    map.setDisplaySize(source.width * cover, source.height * cover);
    this.mapLayer.add(map);
    const beforeHud = this.children.list.length;
    this.mapHud = new PersistentHud(this, this.boardConfig);
    this.mapLayer.add(this.children.list.slice(beforeHud));

    const title = this.add
      .text(40, 172, 'ШАРЫ ЕЩЁ НА ДОСКЕ', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '24px',
      })
      .setOrigin(0, 0);

    this.mapText = this.add
      .text(40, 218, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '18px',
        lineSpacing: 6,
      })
      .setOrigin(0, 0);

    this.mapMessageText = this.add
      .text(40, 330, '', {
        color: visualHex('textMuted'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '17px',
        wordWrap: { width: 900 },
      })
      .setOrigin(0, 0);

    const returnButton = this.add
      .text(40, 620, '[ ВЕРНУТЬСЯ В КАЗИНО ]', {
        color: visualHex('textMain'),
        backgroundColor: visualHex('inkRaised'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '17px',
        padding: { x: 10, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.returnToCasino());

    this.mapLayer.add([title, this.mapText, this.mapMessageText, returnButton]);
  }

  private async leaveCasino(): Promise<void> {
    if (!this.save || this.leaving) return;

    if (!this.save.pendingDrop) {
      this.leaving = true;
      await this.enqueueSave(true);
      this.scene.start('bootstrap');
      return;
    }

    this.game.canvas.setAttribute('aria-label', 'Карта: бросок продолжается');
    this.mapMode = true;
    this.casinoLayer?.setVisible(false);
    this.mapLayer?.setVisible(true);
    this.lastResultMessage =
      'Бросок продолжается. После выплаты откроется карта. Можно вернуться и досмотреть.';
    this.renderMap();
    this.renderTutorial();
  }

  private returnToCasino(): void {
    this.game.canvas.setAttribute('aria-label', 'Казино Plinko');
    this.mapMode = false;
    this.mapLayer?.setVisible(false);
    this.casinoLayer?.setVisible(true);
    this.renderCasino();
    this.renderTutorial();
  }

  private async purchaseUpgrade(
    id: CasinoUpgradeId,
  ): Promise<void> {
    if (!this.save || !this.repository || this.leaving) return;

    try {
      let game = this.save.game;

      if (id === 'maxBet') {
        game = purchaseMaxBetUpgrade(
          game,
          this.save.pendingDrop,
          this.boardConfig,
        );
      } else if (
        id === 'center' ||
        id === 'mid' ||
        id === 'jackpot'
      ) {
        game = purchasePocketUpgrade(
          game,
          this.save.pendingDrop,
          this.boardConfig,
          id,
        );
      } else if (
        id === 'amplifier' ||
        id === 'return' ||
        id === 'splitter' ||
        id === 'jackpotBias'
      ) {
        game = purchaseSpecialUpgrade(
          game,
          this.save.pendingDrop,
          this.boardConfig,
          id,
        );
      } else {
        game = purchaseInsuranceUpgrade(
          game,
          this.save.pendingDrop,
          this.boardConfig,
        );
      }

      this.save = {
        ...this.save,
        game,
      };
      this.refreshVisualSnapshot();
      this.runtime?.setJackpotBiasLevel(
        game.plinkoJackpotBiasLevel,
      );

      await this.enqueueSave(true);
      recordTutorialMilestone('UPGRADE_BOUGHT');
      this.showStatus('Апгрейд куплен.');
      this.renderAll();
    } catch (error: unknown) {
      this.showStatus(
        error instanceof Error ? error.message : String(error),
      );
      this.renderCasino();
    }
  }

  private async commitAndSpawn(fraction: BetFraction): Promise<void> {
    if (!this.save || !this.repository || !this.runtime || !this.random || this.leaving) return;
    if (this.save.activeAction) {
      this.showStatus('Finish the active non-Plinko action first.');
      return;
    }

    try {
      if (!canLaunchDrop(this.save.pendingDrop, this.boardConfig)) return;
      const previous = this.save.pendingDrop;
      const dropId = `${this.save.game.clock.gameDayIndex}:${this.save.game.clock.minuteOfDay}:${this.save.game.rngState}`;
      const committed = commitBareDrop(this.save.game, null, this.boardConfig, dropId, fraction);
      const timed = advancePendingDropTime(committed.state, committed.pendingDrop, this.boardConfig);
      this.save = { ...this.save, game: timed.state, pendingDrop: appendDrop(previous, timed.pendingDrop) };
      // Debit, scheduler, RNG and the spawned body become durable in one checkpoint.
      // Before that write a crash restores the previous world, without charging this click.
      this.random = new SeededRandom(this.save.game.rngState);
      if (!previous) {
        this.runtime.setJackpotBiasLevel(committed.pendingDrop.specialLevelsAtCommit.jackpotBiasLevel);
        this.runtime.setFixedTicksElapsed(0);
        this.lastPersistedPhysicsTick = 0;
      }
      const body = this.runtime.spawnBall();
      this.balls.set(body, createRootBallState(dropId));
      this.save.game = { ...this.save.game, rngState: this.random.snapshot().state };
      this.capturePendingPhysics();
      await this.enqueueSave(true);
      this.worldAudio?.play('cashSpend');
      if (committed.pendingDrop.insuranceAtCommit) this.audio?.insuranceActivation();
      this.refreshVisualSnapshot();
      this.renderAll();
    } catch (error: unknown) {
      this.showStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private async resolvePeg(
    pegId: string,
    body: MatterJS.BodyType,
  ): Promise<void> {
    if (
      !this.save?.pendingDrop ||
      !this.runtime ||
      !this.random
    ) {
      return;
    }

    const current = this.balls.get(body);
    if (!current) return;

    const cleared = clearSplitterBlockAfterPeg(current, pegId);
    if (cleared !== current) {
      this.balls.set(body, cleared);
    }

    const pending = this.save.pendingDrop;
    const active = deriveActiveSpecialPins(
      this.boardConfig,
      pending.specialLevelsAtCommit,
    );
    let ball = this.balls.get(body);
    if (!ball) return;

    if (
      active.amplifier &&
      active.amplifier.pegIds.includes(pegId) &&
      canAmplifyAt(ball, pegId)
    ) {
      const lineageId = ball.lineageId;

      for (const [candidateBody, candidate] of this.balls) {
        if (candidate.lineageId !== lineageId) continue;

        this.balls.set(
          candidateBody,
          markAmplifierProc(
            candidate,
            pegId,
            active.amplifier.multiplier,
            candidateBody === body,
          ),
        );
      }

      this.audio?.amplifier();
      await this.persistPendingPhysics(true);
      return;
    }

    ball = this.balls.get(body);
    if (!ball) return;

    if (
      active.return &&
      active.return.pegIds.includes(pegId) &&
      canReturnLineage(ball)
    ) {
      const lineageId = ball.lineageId;

      for (const [candidateBody, candidate] of this.balls) {
        if (candidate.lineageId !== lineageId) continue;
        this.balls.set(candidateBody, markReturnUsed(candidate));
      }

      this.runtime.returnBall(body);
      this.save = {
        ...this.save,
        game: {
          ...this.save.game,
          rngState: this.random.snapshot().state,
        },
      };
      this.audio?.returnCue();
      await this.persistPendingPhysics(true);
      return;
    }

    ball = this.balls.get(body);
    if (!ball) return;

    if (
      active.splitter &&
      active.splitter.pegIds.includes(pegId) &&
      canSplitAt(ball, pegId, this.balls.size, this.boardConfig)
    ) {
      const [leftState, rightState] = createSplitChildren(
        ball,
        pegId,
        active.splitter.childValue,
      );
      const [leftBody, rightBody] = this.runtime.splitBall(body);

      this.balls.delete(body);
      this.balls.set(leftBody, leftState);
      this.balls.set(rightBody, rightState);

      this.audio?.splitter();
      await this.persistPendingPhysics(true);
    }
  }

  private async resolvePocket(
    index: number,
    body: MatterJS.BodyType,
  ): Promise<void> {
    if (
      !this.save ||
      !this.repository ||
      !this.runtime ||
      !this.save.pendingDrop
    ) {
      return;
    }

    const metadata = this.balls.get(body);
    if (!metadata) return;

    const worldPending = this.save.pendingDrop;
    const pending = findBallDrop(worldPending, metadata.lineageId);
    const priorPayout =
      pending.physics?.alreadySettledPayout ?? 0;
    const ballPayout = calculateBallPocketPayout(
      pending,
      metadata.currentValue,
      index,
      this.boardConfig,
    );
    const aggregatePayout = priorPayout + ballPayout;
    this.effects?.payout(body.position.x, this.runtime.layout.pocketTopY - 12, ballPayout);

    this.balls.delete(body);
    this.runtime.removeBall(body);

    this.save.pendingDrop = recordDropPayout(worldPending, pending.dropId, aggregatePayout);
    const lineageStillActive = Array.from(this.balls.values()).some((ball) => ball.lineageId === metadata.lineageId);
    if (lineageStillActive) {
      this.capturePendingPhysics();
      await this.enqueueSave(true);
      return;
    }

    const previousBarryTotal = this.save.game.totalBarryPaid;
    const previousBarryPaymentIndex = this.save.game.barryPaymentIndex;
    const remaining = removeSettledDrop(this.save.pendingDrop, pending.dropId);
    const result = remaining
      ? settleAggregateDrop(this.save.game, pending, aggregatePayout, this.boardConfig)
      : settleAggregatePendingDropAndResumeTime(this.save.game, pending, aggregatePayout, this.boardConfig);
    this.save = { ...this.save, game: result.state, pendingDrop: remaining };
    this.capturePendingPhysics();
    this.refreshVisualSnapshot();
    if (!remaining) this.runtime.setJackpotBiasLevel(this.save.game.plinkoJackpotBiasLevel);
    await this.enqueueSave(true);

    (this.game.registry.get(GAME_ANALYTICS_KEY) as GameAnalytics | undefined)?.track('plinko_resolved', result.state, {
      bet: pending.originalStake, payout: result.payout, board_hash: pending.boardFingerprint,
      cash_before: this.save.game.cash - result.payout + result.state.totalBarryPaid - previousBarryTotal + pending.originalStake,
      cash_after: result.state.cash, seed: pending.rngStateAtCommit, drop_id: pending.dropId,
      cascade_fixed_ticks: this.runtime.getFixedTicksElapsed(), cascade_active_balls: this.balls.size,
      insurance_top_up: result.insuranceTopUp,
    });

    recordTutorialMilestone('DROP_RESOLVED');
    if (
      result.state.terminalReason === null &&
      result.state.barryPaymentIndex >
        previousBarryPaymentIndex
    ) {
      recordTutorialMilestone('BARRY_PAID');
    }

    if (result.payout > 0) {
      this.audio?.payoutCount();
      this.worldAudio?.play('cashGain');
    }
    this.audio?.result(
      result.losing,
      shouldUseBigJackpotStinger(
        result.multiplier,
        Math.max(...this.boardConfig.plinko.basePockets),
      ),
    );
    this.lastResultMessage = formatCasinoResult({
      stake: pending.originalStake, payout: result.payout, multiplier: result.multiplier,
      losing: result.losing, insuranceApplied: result.insuranceApplied, insuranceTopUp: result.insuranceTopUp,
    });

    publishCasinoPayoutToast({
      stake: pending.originalStake,
      payout: result.payout,
      multiplier: result.multiplier,
      losing: result.losing,
      insuranceApplied: result.insuranceApplied,
      insuranceTopUp: result.insuranceTopUp,
    });

    this.showStatus('');
    this.resultText
      ?.setText(this.lastResultMessage)
      .setColor(
        result.losing
          ? visualHex('warning')
          : visualHex('mustard'),
      )
      .setVisible(true);

    if (window.__PLINKO_PERF__?.phase === 'running') {
      window.__PLINKO_PERF__.phase = 'resolved';
      window.__PLINKO_PERF__.resolvedAtMs = performance.now();
      window.__PLINKO_PERF__.activeBallCount = this.balls.size;
    }

    this.renderAll();

    if (!this.save.pendingDrop && this.boardConfig !== balance && !this.mapMode) {
      // The old paid world is now durably empty; new launches use current geometry.
      this.scene.restart();
      return;
    }

    if (this.mapMode && !this.save.pendingDrop) {
      this.time.delayedCall(250, () => {
        if (this.mapMode && !this.save?.pendingDrop && !this.leaving) this.scene.start('bootstrap');
      });
    }
  }

  private installPerfProbe(): void {
    if (!this.save || !this.runtime) return;

    window.__PLINKO_PERF__ = {
      phase: 'ready',
      startedAtMs: null,
      resolvedAtMs: null,
      activeBallCount: this.balls.size,
      maxActiveBallCount: this.balls.size,
      error: null,
      diagnostics: () => ({ bodies: this.matter.world.getAllBodies().length, audioListeners: this.game.events.listenerCount(GAME_AUDIO_BLOCKED_EVENT), pointerListeners: this.input.listenerCount('pointerdown'), textures: this.textures.getTextureKeys().length, ...Object.fromEntries(Object.entries(this.audio?.diagnostics() ?? {}).map(([key,value]) => [`plinko_${key}`, value])), ...Object.fromEntries(Object.entries(this.worldAudio?.diagnostics() ?? {}).map(([key,value]) => [`world_${key}`, value])) }),
      start: async () => {
        const probe = window.__PLINKO_PERF__;
        if (!probe || (probe.phase !== 'ready' && probe.phase !== 'resolved')) return;

        probe.phase = 'running';
        probe.maxActiveBallCount = 0;
        probe.resolvedAtMs = null;
        probe.startedAtMs = performance.now();

        try {
          await this.commitAndSpawn(1);
          if (!this.save?.pendingDrop) {
            probe.phase = 'error';
            probe.error = 'Drop was not committed; resolve gameplay blockers before measuring';
            return;
          }
          if (this.runtime && this.save?.pendingDrop && new URLSearchParams(window.location.search).get('stress') === '24') {
            // Performance build only: synthetic cap concurrency, preserving the original total stake.
            const roots = this.boardConfig.plinko.maxActiveBalls;
            for (const metadata of this.balls.values()) metadata.currentValue = 1 / roots;
            for (let index = this.balls.size; index < roots; index += 1) {
              const body = this.runtime.spawnBall();
              this.balls.set(body, {...createRootBallState(this.save.pendingDrop.dropId), ballId: `perf:${index}`, currentValue: 1 / roots});
            }
            await this.persistPendingPhysics(true);
          }
          probe.activeBallCount = this.balls.size;
          probe.maxActiveBallCount = Math.max(probe.maxActiveBallCount ?? 0, this.balls.size);
          if (this.save?.game.terminalReason !== null) {
            probe.phase = 'error';
            probe.error = this.save?.game.terminalReason ?? 'terminal';
          }
        } catch (error: unknown) {
          probe.phase = 'error';
          probe.error = error instanceof Error ? error.message : String(error);
        }
      },
    };
  }

  private readonly handleAudioPrime = (): void => {
    this.audio?.prime();
    this.worldAudio?.prime();
  };

  private readonly handleAudioBlocked = (
    blocked: boolean,
  ): void => {
    this.audio?.setBlocked(blocked);
  };

  private readonly handleAudioCollision = (
    _event: unknown,
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
  ): void => {
    const ball = this.balls.has(bodyA)
      ? bodyA
      : this.balls.has(bodyB)
        ? bodyB
        : null;
    if (!ball) return;

    const other = bodyA === ball ? bodyB : bodyA;
    if (other.label.startsWith('plinko:pocket:')) return;

    this.audio?.bounce();
  };

  private metadataFromSnapshot(
    snapshot: DropBallSnapshot,
  ): DropBallState {
    return {
      ballId: snapshot.ballId,
      currentValue: snapshot.currentValue,
      lineageId: snapshot.lineageId,
      splitDepth: snapshot.splitDepth,
      amplifierProcIds: [...snapshot.amplifierProcIds],
      returnUsed: snapshot.returnUsed,
      blockedSplitterId: snapshot.blockedSplitterId,
    };
  }

  private enqueueCascadeMutation(
    mutation: () => Promise<void> | void,
  ): void {
    this.cascadeMutationChain = this.cascadeMutationChain
      .then(async () => {
        await mutation();
      })
      .catch((error: unknown) => {
        this.showStatus(
          error instanceof Error ? error.message : String(error),
        );
      });
  }

  private async enqueueSave(flush: boolean): Promise<void> {
    if (!this.save || !this.repository) return;

    const repository = this.repository;
    const snapshot = structuredClone(this.save);

    this.saveWriteChain = this.saveWriteChain.then(async () => {
      await repository.write(snapshot);
      if (flush) await repository.flush();
    });

    await this.saveWriteChain;
  }

  private async persistPendingPhysics(flush: boolean): Promise<void> {
    if (
      this.physicsSaveQueued ||
      !this.save?.pendingDrop ||
      !this.runtime ||
      !this.repository
    ) {
      return;
    }

    this.physicsSaveQueued = true;

    try {
      this.capturePendingPhysics();
      await this.enqueueSave(flush);
    } finally {
      this.physicsSaveQueued = false;
    }
  }

  private capturePendingPhysics(): void {
    if (!this.save?.pendingDrop || !this.runtime) return;
      const pending = this.save.pendingDrop;
      const physics = {
        fixedTicksElapsed: this.runtime.getFixedTicksElapsed(),
        alreadySettledPayout: pending.physics?.alreadySettledPayout ?? 0,
        solver: this.runtime.snapshotSolver(this.balls),
        balls: Array.from(this.balls.entries()).map(([body, metadata]) =>
          this.runtime!.snapshotBall(body, metadata),
        ),
      };

      this.save = {
        ...this.save,
        pendingDrop: setDropPhysicsSnapshot(pending, physics),
      };
      this.lastPersistedPhysicsTick = physics.fixedTicksElapsed;
  }

  private refreshVisualSnapshot(): void {
    this.visualSnapshot =
      this.save === null
        ? null
        : derivePlinkoVisualSnapshot(
            this.save.game,
            this.save.pendingDrop,
            this.boardConfig,
          );

    if (this.runtime) {
      this.installPocketLabels();
      this.drawStaticBoard();
    }
  }

  private renderAll(): void {
    this.renderCasino();
    this.renderMap();
    this.renderTutorial();

    if (this.save) {
      this.worldAudio?.syncBarry(
        this.save.game.barryInterruptPending,
      );
      this.worldAudio?.syncNeeds(
        this.save.game.needs,
        this.boardConfig.needs.lowThreshold,
      );
    }
  }

  private renderCasino(): void {
    if (!this.infoText || !this.save) return;

    const snapshot = this.visualSnapshot;
    this.casinoHud?.render(this.save.game);
    this.infoText.setText([
      `На доске: ${activeDrops(this.save.pendingDrop).length} / ${this.boardConfig.plinko.maxConcurrentDrops}`,
      ...(snapshot?.insuranceArmed ? ['Щит готов'] : []),
    ]);

    this.betPanel?.render(
      buildCasinoQuickBets(
        this.save.game,
        this.save.pendingDrop,
        this.boardConfig,
      ),
    );
    this.upgradePanel?.render(
      buildCasinoUpgradePreviews(
        this.save.game,
        this.save.pendingDrop,
        this.boardConfig,
      ),
    );

    if (this.lastResultMessage) {
      this.resultText
        ?.setText(this.lastResultMessage)
        .setVisible(true);
    }
  }

  private renderMap(): void {
    if (!this.mapText || !this.mapMessageText || !this.save) return;

    this.mapHud?.render(this.save.game);
    this.mapText.setText(`${activeDrops(this.save.pendingDrop).length} бросков · вернись в казино, чтобы продолжить`)
      .setBackgroundColor(visualHex('inkPanel')).setPadding(12, 10);

    this.mapMessageText.setBackgroundColor(visualHex('inkPanel')).setPadding(12, 10).setText(
      this.lastResultMessage ||
        (this.save.pendingDrop
          ? 'Действия на карте станут доступны после завершения бросков.'
          : 'Броски завершены.'),
    );
  }

  private renderTutorial(): void {
    if (!this.tutorialCard || !this.save) return;

    if (
      this.save.game.terminalReason !== null ||
      this.save.game.victory || this.mapMode || this.save.pendingDrop !== null
    ) {
      this.tutorialCard.render(null);
      return;
    }

    const step = deriveTutorialStep(
      loadTutorialProgress(),
    );
    if (step !== 'DONE') this.resultText?.setVisible(false);
    this.tutorialCard.render(
      buildTutorialCard(
        step,
        this.mapMode ? 'map' : 'casino',
      ),
    );
  }

  private showStatus(message: string): void {
    this.statusText?.setText(message);
  }

  private installPocketLabels(): void {
    if (
      !this.runtime ||
      !this.casinoLayer ||
      !this.visualSnapshot
    ) {
      return;
    }

    const snapshot = this.visualSnapshot;
    const pockets = snapshot.pocketMultipliers;

    if (this.pocketLabels.length === 0) {
      this.runtime.layout.pocketCenters.forEach(
        (pocket, index) => {
          const label = this.add
            .text(
              pocket.x,
              this.runtime!.layout.pocketBottomY + 18,
              `${pockets[index]}x`,
              {
                color: visualHex('textMuted'),
                fontFamily: VISUAL_FONT.mono,
                fontSize: '16px',
                backgroundColor: visualHex('inkDeep'),
                padding: { x: 1, y: 2 },
              },
            )
            .setOrigin(0.5, 0);
          this.casinoLayer!.add(label);
          this.pocketLabels.push(label);
        },
      );
    }

    this.pocketLabels.forEach((label, index) => {
      const role = getPocketVisualRole(index, this.boardConfig);
      const upgraded =
        (role === 'jackpot' &&
          snapshot.pocketLevels.jackpotLevel > 0) ||
        (role === 'mid' &&
          snapshot.pocketLevels.midLevel > 0) ||
        (role === 'center' &&
          snapshot.pocketLevels.centerLevel > 0) ||
        (role === 'inner' &&
          (snapshot.pocketLevels.centerLevel > 0 ||
            snapshot.pocketLevels.midLevel > 0));

      const color =
        role === 'jackpot' && upgraded
          ? visualHex('mustard')
          : role === 'mid' && upgraded
            ? visualHex('cold')
            : role === 'center' && upgraded
              ? visualHex('paperOld')
              : upgraded
                ? visualHex('textMain')
                : visualHex('textMain');

      label
        .setText(`${pockets[index]}x`)
        .setColor(color)
        .setFontStyle(upgraded ? 'bold' : 'normal')
        .setFontSize(upgraded ? 14 : 13);
    });
  }

  private drawStaticBoard(): void {
    if (
      !this.staticBoardGraphics ||
      !this.runtime ||
      !this.visualSnapshot
    ) {
      return;
    }

    const graphics = this.staticBoardGraphics;
    graphics.clear();
    const geometry = this.boardConfig.plinko.geometry;
    const layout = this.runtime.layout;
    const snapshot = this.visualSnapshot;

    for (const [index, peg] of layout.pegs.entries()) {
      const role = getPegVisualRole(peg.id, snapshot.pegRoles);
      const texture = `67m:pin:${role}`;
      const image = this.pegImages[index] ?? (this.pegImages[index] = this.add.image(peg.x, peg.y, texture));
      if (!image.parentContainer) this.casinoLayer!.addAt(image, 4);
      if (image.texture.key !== texture) image.setTexture(texture);
      image.setPosition(peg.x, peg.y);
    }

    const biasGeometry = deriveJackpotBiasGeometry(
      this.boardConfig,
      snapshot.specialLevels.jackpotBiasLevel,
    );

    for (const deflector of biasGeometry) {
      const half = deflector.length / 2;
      const dx =
        Math.cos(deflector.angleRadians) * half;
      const dy =
        Math.sin(deflector.angleRadians) * half;

      graphics.lineStyle(
        deflector.thickness,
        SPECIAL_PIN_STYLE.jackpotBias.color,
        1,
      );
      graphics.strokeLineShape(
        new Phaser.Geom.Line(
          deflector.x - dx,
          deflector.y - dy,
          deflector.x + dx,
          deflector.y + dy,
        ),
      );
    }

    graphics.lineStyle(
      2,
      visualColor('lineDirty'),
      1,
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(
        layout.leftWallX,
        geometry.topPegY,
        layout.leftWallX,
        geometry.topPegY + geometry.boardAreaHeight,
      ),
    );
    graphics.strokeLineShape(
      new Phaser.Geom.Line(
        layout.rightWallX,
        geometry.topPegY,
        layout.rightWallX,
        geometry.topPegY + geometry.boardAreaHeight,
      ),
    );

    for (
      let index = 0;
      index < layout.pocketCenters.length - 1;
      index += 1
    ) {
      const left = layout.pocketCenters[index]!;
      const right =
        layout.pocketCenters[index + 1]!;
      const x = (left.x + right.x) / 2;
      graphics.strokeLineShape(
        new Phaser.Geom.Line(
          x,
          layout.pocketTopY,
          x,
          layout.pocketBottomY,
        ),
      );
    }
  }

}
