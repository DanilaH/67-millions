import Phaser from 'phaser';
import type { ActionPreview } from '../actions/actionPreviews';
import { VISUAL_FONT, visualColor, visualHex, type VisualColorToken } from '../visual/visualTheme';

export interface ActionPanel {
  show(title: string, actions: ActionPreview[], navigation?: ActionPreview): void;
  hide(): void;
  isVisible(): boolean;
}

export const createActionPanel = (
  scene: Phaser.Scene,
  onBack: () => void,
  onAction: (action: ActionPreview) => void,
  onPreview: (action: ActionPreview | null) => void = () => {},
): ActionPanel => {
  const container = scene.add.container(0, 0).setDepth(200).setVisible(false);
  const dynamic: Phaser.GameObjects.GameObject[] = [];
  let lastSignature = '';
  let currentTitle = '';
  let currentActions: ActionPreview[] = [];
  let page = 0;
  let previewId: string | null = null;
  const pageSize = 3;
  const background = scene.add.rectangle(763, 380, 1006, 520, visualColor('inkDeep'), 0.985)
    .setStrokeStyle(2, visualColor('lineDirty')).setInteractive();
  const text = (x: number, y: number, label: string, size: number, color: VisualColorToken = 'textMain') =>
    scene.add.text(x, y, label, { fontFamily: VISUAL_FONT.sans, fontSize: `${size}px`, color: visualHex(color) });
  const title = text(292, 135, '', 28).setFontStyle('bold');
  const back = text(1234, 131, 'Закрыть', 20).setOrigin(1, 0)
    .setBackgroundColor(visualHex('inkRaised')).setPadding(16, 10)
    .setInteractive({ useHandCursor: true }).on('pointerup', onBack);
  let navigationAction: ActionPreview | undefined;
  const section = text(850, 131, '', 22).setOrigin(0.5, 0).setPadding(16, 10).setBackgroundColor(visualHex('inkRaised')).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (navigationAction) onAction(navigationAction); });
  const count = text(763, 607, '', 22).setOrigin(0.5);
  const previous = text(292, 590, '←', 24).setPadding(16, 10).setBackgroundColor(visualHex('inkRaised'))
    .setInteractive({ useHandCursor: true }).on('pointerup', () => { if (page > 0) { page--; draw(); } });
  const next = text(1234, 590, '→', 24).setOrigin(1, 0).setPadding(16, 10).setBackgroundColor(visualHex('inkRaised'))
    .setInteractive({ useHandCursor: true }).on('pointerup', () => { if ((page + 1) * pageSize < currentActions.length) { page++; draw(); } });
  container.add([background, title, back, section, count, previous, next]);

  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    onPreview(currentActions.slice(page * pageSize, (page + 1) * pageSize).find(action => action.id === previewId) ?? null);
    const single = currentActions.length === 1;
    const width = single ? 740 : 906;
    const left = 763 - width / 2;
    const panelHeight = single ? 330 : 520;
    background.setPosition(763, 120 + panelHeight / 2).setSize(width, panelHeight);
    title.setPosition(left + 24, 135).setText(currentTitle);
    back.setX(left + width - 20);
    previous.setX(left + 24); next.setX(left + width - 20);
    const pages = Math.max(1, Math.ceil(currentActions.length / pageSize));
    page = Math.min(page, pages - 1);
    count.setText(pages > 1 ? `${page + 1} / ${pages}` : '').setVisible(pages > 1);
    previous.setVisible(pages > 1).setAlpha(page > 0 ? 1 : 0.35);
    next.setVisible(pages > 1).setAlpha(page + 1 < pages ? 1 : 0.35);
    scene.game.canvas.setAttribute('aria-label', currentTitle);
    scene.game.canvas.setAttribute('data-panel-page', `${page + 1}`);
    currentActions.slice(page * pageSize, (page + 1) * pageSize).forEach((action, index) => {
      const y = 190 + index * 130;
      const locked = action.lockedReason !== null;
      const height = single ? 240 : 120;
      const card = scene.add.rectangle(763, y + height / 2, width - 48, height, visualColor(locked ? 'inkPanel' : 'inkRaised'))
        .setStrokeStyle(2, visualColor(locked ? 'lineDirty' : 'cold'));
      const name = text(left + 36, y + 10, action.title, 24).setFontStyle('bold');
      const lock = text(left + width - 36, y + 12, action.lockedReason ?? action.cta ?? 'ВЫБРАТЬ →', 20, locked ? 'warning' : 'mustard')
        .setOrigin(1, 0).setWordWrapWidth(single ? 320 : 480).setAlign('right');
      const summary = text(left + 36, y + 47, (currentActions.length === 1 ? action.summary : action.summary.slice(0, 2)).join('\n'), 19, 'textMuted')
        .setWordWrapWidth(width - (action.forecast && !single ? 240 : 72)).setLineSpacing(2);
      if (!locked) card.setInteractive({ useHandCursor: true }).on('pointerup', () => onAction(action));
      let previewButton: Phaser.GameObjects.Text | undefined;
      if (action.forecast) {
        const preview = text(left + width - 36, single ? y + height - 52 : y + 72, previewId === action.id ? 'Скрыть прогноз' : 'Прогноз', 16)
          .setOrigin(1, 0).setPadding(12, 12).setBackgroundColor(visualHex('inkPanel'))
          .setInteractive({ useHandCursor: true }).on('pointerup', () => { previewId = previewId === action.id ? null : action.id; draw(); });
        previewButton = preview; container.add(preview); dynamic.push(preview);
        if (!locked) card.on('pointerover', () => { if (!previewId) onPreview(action); }).on('pointerout', () => { if (!previewId) onPreview(null); });
      }
      container.add([card, name, lock, summary]);
      dynamic.push(card, name, lock, summary);
      if (previewButton) container.bringToTop(previewButton);
    });
  };
  return {
    show: (heading, actions, navigation) => {
      navigationAction = navigation;
      section.setText(navigation?.title ?? '').setVisible(navigation !== undefined);
      if (heading !== currentTitle || !container.visible) { page = 0; previewId = null; }
      const signature = JSON.stringify([heading, actions]);
      if (signature === lastSignature && container.visible) return;
      currentTitle = heading; currentActions = actions; lastSignature = signature;
      draw(); container.setVisible(true);
    },
    hide: () => { previewId = null; onPreview(null); container.setVisible(false); dynamic.splice(0).forEach(object => object.destroy()); },
    isVisible: () => container.visible,
  };
};
