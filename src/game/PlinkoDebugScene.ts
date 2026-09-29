import Phaser from 'phaser';

import { balance } from '../config/balance';
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
  getMaxBetForLevel,
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
import {
  getSceneGameAnalytics,
} from './analytics/sceneGameAnalytics';
import type { GameAnalytics } from '../analytics/GameAnalytics';

export class PlinkoDebugScene extends Phaser.Scene {
  private runtime: BarePlinkoRuntime | null = null;
  private random: SeededRandom | null = null;
  private save: SaveState | null = null;
  private repository: SaveRepository | null = null;
  private analytics: GameAnalytics | null = null;
  private readonly balls = new Map<MatterJS.BodyType, DropBallState>();
  private saveWriteChain: Promise<void> = Promise.resolve();
  private cascadeMutationChain: Promise<void> = Promise.resolve();
  private physicsSaveQueued = false;
  private lastPersistedPhysicsTick = 0;
  private visibilityHandler: (() => void) | null = null;
  private audio: PlinkoAudio | null = null;
  private worldAudio: SceneAudio | null = null;

  private casinoLayer?: Phaser.GameObjects.Container;
  private mapLayer?: Phaser.GameObjects.Container;
  private graphics?: Phaser.GameObjects.Graphics;
  private infoText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private mapMessageText?: Phaser.GameObjects.Text;
  private mapMode = false;
  private lastResultMessage = '';
  private betPanel?: CasinoBetPanel;
  private upgradePanel?: CasinoUpgradePanel;
  private resultText?: Phaser.GameObjects.Text;
  private readonly pocketLabels: Phaser.GameObjects.Text[] = [];
  private tutorialCard?: TutorialCard;
  private visualSnapshot: PlinkoVisualSnapshot | null = null;
  private dropResumed = false;
  private sessionSplitEvents = 0;
  private sessionAmplifierEvents = 0;
  private sessionReturnEvents = 0;
  private sessionPeakActiveBalls = 0;

  public constructor() {
    super('plinko-debug');
  }

  public create(): void {
    this.casinoLayer = this.add.container(0, 0);
    this.mapLayer = this.add.container(0, 0).setVisible(false);

    this.graphics = this.add.graphics();
    this.casinoLayer.add(this.graphics);

    this.infoText = this.add.text(28, 20, 'Loading Plinko state…', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.mono,
      fontSize: '16px',
      lineSpacing: 5,
    });
    this.casinoLayer.add(this.infoText);

    this.statusText = this.add
      .text(680, 28, '', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '14px',
        wordWrap: { width: 560 },
      })
      .setOrigin(0, 0);
    this.casinoLayer.add(this.statusText);

    this.resultText = this.add
      .text(680, 92, '', {
        color: visualHex('mustard'),
        backgroundColor: visualHex('inkPanel'),
        fontFamily: VISUAL_FONT.mono,
        fontSize: '14px',
        padding: { x: 10, y: 8 },
        wordWrap: { width: 545 },
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
    );
    void this.initialize();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      void this.persistPendingPhysics(true);
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
      this.matter.world.off('collisionstart', this.handleAudioCollision);
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

  public update(): void {
    if (!this.graphics || this.mapMode) return;

    this.graphics.clear();
    this.drawStaticBoard();

    for (const [ball, metadata] of this.balls) {
      const amplified = metadata.currentValue > 1;
      const split = metadata.splitDepth > 0;
      const fill = amplified
        ? visualColor('mustard')
        : split
          ? visualColor('paperOld')
          : visualColor('textMain');

      this.graphics.fillStyle(fill, 1);
      this.graphics.fillCircle(
        ball.position.x,
        ball.position.y,
        balance.plinko.geometry.ballRadius,
      );

      if (amplified || split) {
        this.graphics.lineStyle(
          2,
          amplified
            ? visualColor('rust')
            : visualColor('cold'),
          0.95,
        );
        this.graphics.strokeCircle(
          ball.position.x,
          ball.position.y,
          balance.plinko.geometry.ballRadius + 2,
        );
      }
    }
  }

  private async initialize(): Promise<void> {
    this.repository = getSceneSaveRepository(this);
    this.analytics = getSceneGameAnalytics(this);
    this.save = await this.repository.load();
    this.refreshVisualSnapshot();

    const pendingAtLoad = this.save.pendingDrop;
    this.dropResumed = pendingAtLoad !== null;
    this.random = new SeededRandom(
      pendingAtLoad?.physics === null
        ? pendingAtLoad.rngStateAtCommit
        : this.save.game.rngState,
    );
    this.runtime = createBarePlinko(this, balance, this.random, {
      onPocket: (index, body) => {
        const multiplier =
          this.visualSnapshot?.pocketMultipliers[index] ??
          balance.plinko.basePockets[index] ??
          1;
        this.audio?.pocket(
          multiplier,
          getPocketVisualRole(index, balance) === 'jackpot',
        );
        this.enqueueCascadeMutation(() =>
          this.resolvePocket(index, body),
        );
      },
      onPeg: (pegId, body) => {
        this.enqueueCascadeMutation(() => this.resolvePeg(pegId, body));
      },
      onFixedTick: (fixedTicksElapsed) => {
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
      assertDropBoardCompatible(pendingAtLoad, balance, this.save.game);
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
        this.sessionPeakActiveBalls =
          this.balls.size;

        this.showStatus(
          `RESTORED DROP ${pendingAtLoad.dropId} at fixed tick ${pendingAtLoad.physics.fixedTicksElapsed}.`,
        );
      } else {
        const timed = advancePendingDropTime(
          this.save.game,
          pendingAtLoad,
          balance,
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
          this.sessionPeakActiveBalls =
            Math.max(
              this.sessionPeakActiveBalls,
              this.balls.size,
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
        void this.commitAndSpawn(preview.fraction);
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
      .text(690, 650, '[ НА КАРТУ ]', {
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

  private installMapLayer(): void {
    if (!this.mapLayer) return;

    const title = this.add
      .text(40, 36, 'КАРТА · DROP РАЗРЕШАЕТСЯ', {
        color: visualHex('textMain'),
        fontFamily: VISUAL_FONT.sans,
        fontSize: '24px',
      })
      .setOrigin(0, 0);

    this.mapText = this.add
      .text(40, 100, '', {
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

  private leaveCasino(): void {
    if (!this.save) return;

    if (!this.save.pendingDrop) {
      this.scene.start('bootstrap');
      return;
    }

    this.mapMode = true;
    this.casinoLayer?.setVisible(false);
    this.mapLayer?.setVisible(true);
    this.lastResultMessage =
      'Drop is still physically resolving off-screen. All gameplay/cash actions are intentionally unavailable.';
    this.renderMap();
    this.renderTutorial();
  }

  private returnToCasino(): void {
    this.mapMode = false;
    this.mapLayer?.setVisible(false);
    this.casinoLayer?.setVisible(true);
    this.renderCasino();
    this.renderTutorial();
  }

  private async purchaseUpgrade(
    id: CasinoUpgradeId,
  ): Promise<void> {
    if (!this.save || !this.repository) return;

    try {
      const beforeGame = this.save.game;
      const beforePreview =
        buildCasinoUpgradePreviews(
          beforeGame,
          this.save.pendingDrop,
          balance,
        ).find(
          (preview) => preview.id === id,
        );
      let game = beforeGame;

      if (id === 'maxBet') {
        game = purchaseMaxBetUpgrade(
          game,
          this.save.pendingDrop,
          balance,
        );
      } else if (
        id === 'center' ||
        id === 'mid' ||
        id === 'jackpot'
      ) {
        game = purchasePocketUpgrade(
          game,
          this.save.pendingDrop,
          balance,
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
          balance,
          id,
        );
      } else {
        game = purchaseInsuranceUpgrade(
          game,
          this.save.pendingDrop,
          balance,
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

      const afterPreview =
        buildCasinoUpgradePreviews(
          game,
          this.save.pendingDrop,
          balance,
        ).find(
          (preview) => preview.id === id,
        );
      if (beforePreview && afterPreview) {
        this.analytics?.track(
          'upgrade_bought',
          {
            upgrade: id,
            from_level:
              beforePreview.currentLevel,
            to_level:
              afterPreview.currentLevel,
            price: Math.max(
              0,
              beforeGame.cash - game.cash,
            ),
            cash_after: game.cash,
          },
        );
      }

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
    if (!this.save || !this.repository || !this.runtime || !this.random) return;
    if (this.save.activeAction) {
      this.showStatus('Finish the active non-Plinko action first.');
      return;
    }

    try {
      const cashBefore =
        this.save.game.cash;
      const dropId =
        `${this.save.game.clock.gameDayIndex}:${this.save.game.clock.minuteOfDay}:${this.save.game.rngState}`;
      const committed = commitBareDrop(
        this.save.game,
        this.save.pendingDrop,
        balance,
        dropId,
        fraction,
      );

      this.save = {
        ...this.save,
        version: SAVE_VERSION,
        game: committed.state,
        pendingDrop: committed.pendingDrop,
      };
      this.refreshVisualSnapshot();
      this.lastResultMessage = '';
      this.resultText?.setVisible(false);

      // Stake + pendingDrop are durable before time or physical outcome generation.
      await this.enqueueSave(true);

      this.dropResumed = false;
      this.sessionSplitEvents = 0;
      this.sessionAmplifierEvents = 0;
      this.sessionReturnEvents = 0;
      this.sessionPeakActiveBalls = 0;
      this.analytics?.track(
        'plinko_drop',
        {
          drop_id:
            committed.pendingDrop.dropId,
          bet:
            committed.pendingDrop.originalStake,
          board_hash:
            committed.pendingDrop.boardFingerprint,
          cash_before: cashBefore,
          cash_after:
            committed.state.cash,
          rng_state_at_commit:
            committed.pendingDrop.rngStateAtCommit,
          max_bet_level:
            committed.pendingDrop.maxBetLevel,
        },
      );

      this.worldAudio?.play('cashSpend');

      if (
        committed.pendingDrop.insuranceAtCommit !== null
      ) {
        this.audio?.insuranceActivation();
      }

      const timed = advancePendingDropTime(
        this.save.game,
        committed.pendingDrop,
        balance,
      );
      this.save = {
        ...this.save,
        game: timed.state,
        pendingDrop: timed.pendingDrop,
      };
      await this.enqueueSave(true);

      if (this.save.game.terminalReason !== null) {
        this.showStatus(
          `Drop committed, but run ended with ${this.save.game.terminalReason} before physics spawn.`,
        );
        this.renderAll();
        return;
      }

      this.runtime.setJackpotBiasLevel(
        committed.pendingDrop.specialLevelsAtCommit.jackpotBiasLevel,
      );
      const body = this.runtime.spawnBall();
      this.balls.set(
        body,
        createRootBallState(committed.pendingDrop.dropId),
      );
      this.sessionPeakActiveBalls =
        Math.max(
          this.sessionPeakActiveBalls,
          this.balls.size,
        );

      this.save = {
        ...this.save,
        game: {
          ...this.save.game,
          rngState: this.random.snapshot().state,
        },
      };
      await this.persistPendingPhysics(true);
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
      balance,
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

      this.sessionAmplifierEvents += 1;
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
      this.sessionReturnEvents += 1;
      this.audio?.returnCue();
      await this.persistPendingPhysics(true);
      return;
    }

    ball = this.balls.get(body);
    if (!ball) return;

    if (
      active.splitter &&
      active.splitter.pegIds.includes(pegId) &&
      canSplitAt(ball, pegId, this.balls.size, balance)
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
      this.sessionSplitEvents += 1;
      this.sessionPeakActiveBalls =
        Math.max(
          this.sessionPeakActiveBalls,
          this.balls.size,
        );

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

    const pending = this.save.pendingDrop;
    const priorPayout =
      pending.physics?.alreadySettledPayout ?? 0;
    const ballPayout = calculateBallPocketPayout(
      pending,
      metadata.currentValue,
      index,
      balance,
    );
    const aggregatePayout = priorPayout + ballPayout;

    this.balls.delete(body);
    this.runtime.removeBall(body);

    if (this.balls.size > 0) {
      this.save = {
        ...this.save,
        pendingDrop: setDropPhysicsSnapshot(pending, {
          fixedTicksElapsed: this.runtime.getFixedTicksElapsed(),
          alreadySettledPayout: aggregatePayout,
          balls: Array.from(this.balls.entries()).map(
            ([activeBody, activeMetadata]) =>
              this.runtime!.snapshotBall(activeBody, activeMetadata),
          ),
        }),
      };
      await this.enqueueSave(true);
      this.renderAll();
      return;
    }

    const beforeSettlement =
      this.save.game;
    const previousBarryPaymentIndex =
      beforeSettlement.barryPaymentIndex;
    const physicsTicks =
      this.runtime.getFixedTicksElapsed();
    const cashBeforeDrop =
      beforeSettlement.cash +
      pending.originalStake;
    const result = settleAggregatePendingDropAndResumeTime(
      beforeSettlement,
      pending,
      aggregatePayout,
      balance,
    );

    this.save = {
      ...this.save,
      game: result.state,
      pendingDrop: null,
    };
    this.refreshVisualSnapshot();
    this.runtime.setJackpotBiasLevel(
      this.save.game.plinkoJackpotBiasLevel,
    );
    await this.enqueueSave(true);

    this.analytics?.track(
      'plinko_resolved',
      {
        drop_id: pending.dropId,
        bet: pending.originalStake,
        payout: result.payout,
        multiplier: result.multiplier,
        board_hash:
          pending.boardFingerprint,
        cash_before: cashBeforeDrop,
        cash_after: result.state.cash,
        rng_state_at_commit:
          pending.rngStateAtCommit,
        physics_ticks: physicsTicks,
        resumed: this.dropResumed,
        session_split_events:
          this.sessionSplitEvents,
        session_amplifier_events:
          this.sessionAmplifierEvents,
        session_return_events:
          this.sessionReturnEvents,
        session_peak_active_balls:
          this.sessionPeakActiveBalls,
        insurance_applied:
          result.insuranceApplied,
      },
    );

    recordTutorialMilestone('DROP_RESOLVED');
    if (
      result.state.terminalReason === null &&
      result.state.barryPaymentIndex >
        previousBarryPaymentIndex
    ) {
      recordTutorialMilestone('BARRY_PAID');
      this.analytics?.track(
        'barry_paid',
        {
          payment_index:
            result.state.barryPaymentIndex,
          amount: Math.max(
            0,
            result.state.totalBarryPaid -
              beforeSettlement.totalBarryPaid,
          ),
          cash_after: result.state.cash,
        },
      );
    }

    const terminalSuffix = result.state.terminalReason
      ? ` / GAME OVER: ${result.state.terminalReason}`
      : '';
    if (result.payout > 0) {
      this.audio?.payoutCount();
      this.worldAudio?.play('cashGain');
    }
    this.audio?.result(
      result.losing,
      shouldUseBigJackpotStinger(
        result.multiplier,
        Math.max(...balance.plinko.basePockets),
      ),
    );
    this.lastResultMessage =
      `PLINKO: ставка ${pending.originalStake.toLocaleString('ru-RU')} ₽ → выплата ${result.payout.toLocaleString('ru-RU')} ₽ · ${result.multiplier.toFixed(2)}x${result.insuranceApplied ? ` · страховка +${result.insuranceTopUp.toLocaleString('ru-RU')} ₽` : ''}${result.losing ? ' · Счастье -1' : ''}${terminalSuffix}`;

    publishCasinoPayoutToast({
      stake: pending.originalStake,
      payout: result.payout,
      multiplier: result.multiplier,
      losing: result.losing,
      insuranceApplied: result.insuranceApplied,
      insuranceTopUp: result.insuranceTopUp,
    });

    this.showStatus(this.lastResultMessage);
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

    if (this.mapMode) {
      this.time.delayedCall(250, () => {
        this.scene.start('bootstrap');
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
      error: null,
      start: async () => {
        const probe = window.__PLINKO_PERF__;
        if (!probe || probe.phase !== 'ready') return;

        probe.phase = 'running';
        probe.startedAtMs = performance.now();

        try {
          await this.commitAndSpawn(1);
          probe.activeBallCount = this.balls.size;
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
      const pending = this.save.pendingDrop;
      const physics = {
        fixedTicksElapsed: this.runtime.getFixedTicksElapsed(),
        alreadySettledPayout: pending.physics?.alreadySettledPayout ?? 0,
        balls: Array.from(this.balls.entries()).map(([body, metadata]) =>
          this.runtime!.snapshotBall(body, metadata),
        ),
      };

      this.save = {
        ...this.save,
        pendingDrop: setDropPhysicsSnapshot(pending, physics),
      };
      this.lastPersistedPhysicsTick = physics.fixedTicksElapsed;
      await this.enqueueSave(flush);
    } finally {
      this.physicsSaveQueued = false;
    }
  }

  private refreshVisualSnapshot(): void {
    this.visualSnapshot =
      this.save === null
        ? null
        : derivePlinkoVisualSnapshot(
            this.save.game,
            this.save.pendingDrop,
            balance,
          );

    if (this.runtime) {
      this.installPocketLabels();
    }
  }

  private renderAll(): void {
    this.renderCasino();
    this.renderMap();
    this.renderTutorial();

    if (this.save) {
      this.analytics?.observeState(
        this.save.game,
      );
      this.worldAudio?.syncBarry(
        this.save.game.barryInterruptPending,
      );
      this.worldAudio?.syncNeeds(
        this.save.game.needs,
        balance.needs.lowThreshold,
      );
    }
  }

  private renderCasino(): void {
    if (!this.infoText || !this.save) return;

    const snapshot = this.visualSnapshot;
    const maxBet = getMaxBetForLevel(
      balance,
      snapshot?.maxBetLevel ??
        this.save.game.plinkoMaxBetLevel,
    );

    const special = snapshot?.specialLevels;
    const insurance =
      snapshot === null
        ? `L${this.save.game.plinkoInsuranceLevel}`
        : `L${snapshot.insuranceLevel}${snapshot.insuranceArmed ? ' · ВЗВЕДЕНА' : ''}`;

    this.infoText.setText([
      'КАЗИНО / PLINKO',
      `Деньги: ${this.save.game.cash.toLocaleString('ru-RU')} ₽`,
      `Макс. ставка: ${maxBet.toLocaleString('ru-RU')} ₽`,
      `Drop: ${this.save.pendingDrop ? `${this.save.pendingDrop.originalStake.toLocaleString('ru-RU')} ₽ · ИДЁТ` : 'готов'}`,
      `Счастье: ${this.save.game.needs.happiness.toFixed(1)}`,
      special
        ? `AMP L${special.amplifierLevel} · RETURN L${special.returnLevel} · SPLIT L${special.splitterLevel} · BIAS L${special.jackpotBiasLevel}`
        : 'AMP L0 · RETURN L0 · SPLIT L0 · BIAS L0',
      `INSURANCE ${insurance}`,
    ]);

    this.betPanel?.render(
      buildCasinoQuickBets(
        this.save.game,
        this.save.pendingDrop,
        balance,
      ),
    );
    this.upgradePanel?.render(
      buildCasinoUpgradePreviews(
        this.save.game,
        this.save.pendingDrop,
        balance,
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

    this.mapText.setText([
      `Cash: ${this.save.game.cash.toLocaleString('ru-RU')} ₽`,
      `Principal: ${this.save.game.mainDebt.toLocaleString('ru-RU')} ₽`,
      `HP: ${this.save.game.needs.health.toFixed(1)}`,
      `Satiety: ${this.save.game.needs.satiety.toFixed(1)}`,
      `Energy: ${this.save.game.needs.energy.toFixed(1)}`,
      `Happiness: ${this.save.game.needs.happiness.toFixed(1)}`,
      `Pending Drop: ${this.save.pendingDrop ? `${this.save.pendingDrop.originalStake} ₽ resolving` : 'none'}`,
    ]);

    this.mapMessageText.setText(
      this.lastResultMessage ||
        (this.save.pendingDrop
          ? 'Drop is resolving. Read-only inspection only.'
          : 'No active Drop.'),
    );
  }

  private renderTutorial(): void {
    if (!this.tutorialCard || !this.save) return;

    if (
      this.save.game.terminalReason !== null ||
      this.save.game.victory
    ) {
      this.tutorialCard.render(null);
      return;
    }

    const step = deriveTutorialStep(
      loadTutorialProgress(),
    );
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
                fontSize: '13px',
              },
            )
            .setOrigin(0.5, 0);
          this.casinoLayer!.add(label);
          this.pocketLabels.push(label);
        },
      );
    }

    this.pocketLabels.forEach((label, index) => {
      const role = getPocketVisualRole(index, balance);
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
                : visualHex('textMuted');

      label
        .setText(`${pockets[index]}x`)
        .setColor(color)
        .setFontStyle(upgraded ? 'bold' : 'normal')
        .setFontSize(upgraded ? 14 : 13);
    });
  }

  private drawStaticBoard(): void {
    if (
      !this.graphics ||
      !this.runtime ||
      !this.visualSnapshot
    ) {
      return;
    }

    const graphics = this.graphics;
    const geometry = balance.plinko.geometry;
    const layout = this.runtime.layout;
    const snapshot = this.visualSnapshot;

    graphics.fillStyle(
      visualColor('lineDirty'),
      1,
    );
    for (const peg of layout.pegs) {
      if (
        getPegVisualRole(
          peg.id,
          snapshot.pegRoles,
        ) === 'regular'
      ) {
        graphics.fillCircle(
          peg.x,
          peg.y,
          geometry.pegRadius,
        );
      }
    }

    for (const peg of layout.pegs) {
      const role = getPegVisualRole(
        peg.id,
        snapshot.pegRoles,
      );
      if (role === 'regular') continue;

      if (role === 'amplifier') {
        graphics.fillStyle(
          SPECIAL_PIN_STYLE.amplifier.color,
          1,
        );
        graphics.fillCircle(
          peg.x,
          peg.y,
          geometry.pegRadius + 4,
        );
        graphics.fillStyle(
          visualColor('inkDeep'),
          1,
        );
        graphics.fillCircle(
          peg.x,
          peg.y,
          Math.max(2, geometry.pegRadius - 1),
        );
        continue;
      }

      if (role === 'return') {
        graphics.fillStyle(
          SPECIAL_PIN_STYLE.return.color,
          1,
        );
        graphics.fillCircle(
          peg.x,
          peg.y,
          geometry.pegRadius + 3,
        );
        graphics.lineStyle(
          2,
          visualColor('inkDeep'),
          1,
        );
        graphics.strokeLineShape(
          new Phaser.Geom.Line(
            peg.x,
            peg.y + 4,
            peg.x,
            peg.y - 5,
          ),
        );
        graphics.strokeLineShape(
          new Phaser.Geom.Line(
            peg.x,
            peg.y - 5,
            peg.x - 4,
            peg.y - 1,
          ),
        );
        graphics.strokeLineShape(
          new Phaser.Geom.Line(
            peg.x,
            peg.y - 5,
            peg.x + 4,
            peg.y - 1,
          ),
        );
        continue;
      }

      graphics.fillStyle(
        SPECIAL_PIN_STYLE.splitter.color,
        1,
      );
      graphics.fillCircle(
        peg.x,
        peg.y,
        geometry.pegRadius + 3,
      );
      graphics.lineStyle(
        2,
        visualColor('inkDeep'),
        1,
      );
      graphics.strokeLineShape(
        new Phaser.Geom.Line(
          peg.x,
          peg.y + 4,
          peg.x,
          peg.y,
        ),
      );
      graphics.strokeLineShape(
        new Phaser.Geom.Line(
          peg.x,
          peg.y,
          peg.x - 4,
          peg.y - 4,
        ),
      );
      graphics.strokeLineShape(
        new Phaser.Geom.Line(
          peg.x,
          peg.y,
          peg.x + 4,
          peg.y - 4,
        ),
      );
    }

    const biasGeometry = deriveJackpotBiasGeometry(
      balance,
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
