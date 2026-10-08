import { balance } from '../../config/balance';
import Phaser from 'phaser';
import { isCompactViewport, sceneViewport } from '../visual/scenePresentation';
import { fitPanelText } from '../ui/fitPanelText';

import { VISUAL_FONT, VISUAL_METRICS, visualColor, visualHex } from '../visual/visualTheme';

import type {
  PrincipalConfirmation,
  RunEndSummary,
} from './runEndModel';

export type RunEndOverlayMode =
  | 'hidden'
  | 'summary'
  | 'principal-confirm';

export interface RunEndOverlay {
  showSummary(summary: RunEndSummary): void;
  showPrincipalConfirmation(
    confirmation: PrincipalConfirmation,
  ): void;
  hide(): void;
  getMode(): RunEndOverlayMode;
}

export interface RunEndOverlayHandlers {
  onRestart(): void;
  onConfirmPrincipal(): void;
  onCancelPrincipal(): void;
}

export const createRunEndOverlay = (
  scene: Phaser.Scene,
  handlers: RunEndOverlayHandlers,
): RunEndOverlay => {
  const width = balance.plinko.geometry.logicalViewportWidth;
  const height = balance.plinko.geometry.logicalViewportHeight;
  let mode: RunEndOverlayMode = 'hidden';

  const container = scene.add
    .container(0, 0)
    .setDepth(VISUAL_METRICS.terminalDepth)
    .setVisible(false);

  const shade = scene.add
    .rectangle(
      width / 2,
      height / 2,
      width,
      height,
      visualColor('inkDeep'),
      0.86,
    )
    .setInteractive();

  const panel = scene.add
    .rectangle(
      width / 2,
      height / 2,
      760,
      560,
      visualColor('inkPanel'),
      1,
    )
    .setStrokeStyle(4, visualColor('lineDirty'), 1);

  const title = scene.add
    .text(width / 2, 112, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '34px',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5, 0);

  const reason = scene.add
    .text(width / 2, 166, '', {
      color: visualHex('textMuted'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '18px',
      align: 'center',
      wordWrap: { width: 650 },
    })
    .setOrigin(0.5, 0);

  const stats = scene.add
    .text(330, 244, '', {
      color: visualHex('textMain'),
      fontFamily: VISUAL_FONT.mono,
      fontSize: '16px',
      lineSpacing: 9,
      wordWrap: { width: 620 },
    })
    .setOrigin(0, 0);

  const primary = scene.add
    .text(width / 2, 586, '', {
      color: visualHex('textMain'),
      backgroundColor: visualHex('mold'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '20px',
      fontStyle: 'bold',
      padding: { x: 16, y: 11 },
    })
    .setOrigin(0.5, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => {
      if (mode === 'summary') {
        handlers.onRestart();
      } else if (mode === 'principal-confirm') {
        handlers.onConfirmPrincipal();
      }
    });

  const secondary = scene.add
    .text(width / 2, 642, '[ ОТМЕНА ]', {
      color: visualHex('textMain'),
      backgroundColor: visualHex('inkRaised'),
      fontFamily: VISUAL_FONT.sans,
      fontSize: '16px',
      padding: { x: 12, y: 8 },
    })
    .setOrigin(0.5, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => {
      if (mode === 'principal-confirm') {
        handlers.onCancelPrincipal();
      }
    });

  container.add([
    shade,
    panel,
    title,
    reason,
    stats,
    primary,
    secondary,
  ]);

  const layout = () => {
    const compact = isCompactViewport(scene), confirm = mode === 'principal-confirm';
    const w = compact ? 1120 : 900;
    shade.setSize(sceneViewport(scene).width, height);
    panel.setSize(w, confirm ? 500 : 620).setPosition(640, confirm ? 410 : 360);
    fitPanelText(title.setPosition(640, confirm ? 188 : 80).setFontSize(34), w - 48, 48, false);
    fitPanelText(reason.setPosition(640, confirm ? 248 : 140).setFontSize(compact ? 26 : 20), w - 64, 72);
    fitPanelText(stats.setPosition(640 - w / 2 + 32, confirm ? 344 : 226).setFontSize(compact ? 24 : 18).setLineSpacing(compact ? 6 : 9), w - 64, 300);
    const button = (control: Phaser.GameObjects.Text, x: number, buttonWidth: number) => {
      fitPanelText(control.setFontSize(compact ? 28 : 22), buttonWidth - 32, 42, false);
      control.setPadding(16, (88 - control.height) / 2).setFixedSize(buttonWidth, 88).setAlign('center').setPosition(x, 556);
      (control.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(buttonWidth, 88);
    };
    button(primary, confirm ? 860 : 640, 400);
    button(secondary, 420, 400);
    scene.game.canvas.setAttribute('data-end-targets', JSON.stringify({primary:{x:primary.x,y:600},secondary:{x:secondary.x,y:600}}));
  };
  scene.scale.on('resize', layout);
  scene.events.once('shutdown', () => {scene.scale.off('resize', layout);scene.game.canvas.removeAttribute('data-end-targets');});

  return {
    showSummary: (summary) => {
      mode = 'summary';
      title
        .setText(summary.title)
        .setColor(
          summary.kind === 'VICTORY'
            ? visualHex('mustard')
            : visualHex('warning'),
        );
      reason.setText(summary.reason);
      stats.setText(
        summary.stats
          .map(
            (stat) =>
              `${stat.label}: ${stat.value}`,
          )
          .join('\n'),
      );
      primary
        .setText('[ НОВЫЙ ЗАБЕГ ]')
        .setBackgroundColor(visualHex('mold'));
      secondary.setVisible(false);
      layout();
      container.setVisible(true);
    },

    showPrincipalConfirmation: (confirmation) => {
      mode = 'principal-confirm';
      title
        .setText(confirmation.title)
        .setColor(visualHex('mustard'));
      reason.setText(confirmation.warning);
      stats.setText(
        [
          `Сейчас: ${confirmation.cashBefore.toLocaleString('ru-RU')} ₽`,
          `Погашение: ${confirmation.amount.toLocaleString('ru-RU')} ₽`,
          `Останется: ${confirmation.cashAfter.toLocaleString('ru-RU')} ₽`,
        ].join('\n'),
      );
      primary
        .setText('[ ПОДТВЕРДИТЬ ]')
        .setBackgroundColor(visualHex('rust'));
      secondary.setVisible(true);
      layout();
      container.setVisible(true);
    },

    hide: () => {
      mode = 'hidden';
      container.setVisible(false);
      scene.game.canvas.removeAttribute('data-end-targets');
    },

    getMode: () => mode,
  };
};
