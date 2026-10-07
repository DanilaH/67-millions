import Phaser from 'phaser';
import type { ActionPreview } from '../actions/actionPreviews';
import { sceneViewport } from '../visual/scenePresentation';
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
  // Keep controls alive across clock refreshes/page turns so consecutive taps
  // cannot hit a destroyed object while Phaser refreshes its input list.
  const controls = new Map<string, Phaser.GameObjects.Text>();
  const handlers = new Map<string, () => void>();
  let lastSignature = '', currentTitle = '';
  let currentActions: ActionPreview[] = [];
  let navigationAction: ActionPreview | undefined;
  let page = 0;
  let previewId: string | null = null;
  const text = (x: number, y: number, label: string, size: number, color: VisualColorToken = 'textMain') =>
    scene.add.text(x, y, label, { fontFamily: VISUAL_FONT.sans, fontSize: size, color: visualHex(color) });
  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    controls.forEach(control => control.setVisible(false));
    handlers.clear();
    const compact = sceneViewport(scene).scale < 0.8;
    const pageSize = 2;
    const left = compact ? 28 : 310, width = compact ? 1224 : 906;
    const pages = Math.max(1, Math.ceil(currentActions.length / pageSize));
    page = Math.min(page, pages - 1);
    const visible = currentActions.slice(page * pageSize, (page + 1) * pageSize);
    onPreview(visible.find(action => action.id === previewId) ?? null);
    const targets: Record<string, { x: number; y: number }> = {};
    const add = (...objects: Phaser.GameObjects.GameObject[]) => { container.add(objects); dynamic.push(...objects); };
    const button = (id: string, x: number, y: number, w: number, label: string, action: () => void, primary = false, enabled = true) => {
      const h = compact ? 88 : 46;
      let control = controls.get(id);
      if (!control) {
        control = text(x, y, label, compact ? 28 : 21);
        control.on('pointerup', () => handlers.get(id)?.());
        controls.set(id, control); container.add(control);
      }
      control.setPosition(x, y).setText(label).setFontSize(compact ? 28 : 21)
        .setColor(visualHex(primary ? 'inkDeep' : 'textMain'))
        .setFixedSize(w, h).setPadding(8, compact ? 24 : 10).setAlign('center')
        .setBackgroundColor(visualHex(primary ? 'mustard' : 'inkRaised')).setAlpha(enabled ? 1 : 0.45).setVisible(true);
      if (enabled) { control.setInteractive({ useHandCursor: true }); handlers.set(id, action); }
      else control.disableInteractive();
      container.bringToTop(control);
      targets[id] = { x: x + w / 2, y: y + h / 2 };
    };
    add(scene.add.rectangle(left + width / 2, 410, width, 568, visualColor('inkDeep'), 0.985)
      .setStrokeStyle(2, visualColor('lineDirty')).setInteractive());
    button('back', left + 16, 136, compact ? 230 : 150, '← Город', onBack);
    add(text(left + (compact ? 270 : 184), 153, currentTitle, compact ? 32 : 26).setFontStyle('bold'));
    if (navigationAction) button('section', left + width - (compact ? 320 : 245), 136, compact ? 304 : 229, navigationAction.title, () => onAction(navigationAction!));
    const single = currentActions.length === 1;
    visible.forEach((action, index) => {
      const y = (compact ? 236 : 202) + index * 180;
      const height = single ? (compact ? 356 : 340) : 168;
      const ctaWidth = compact ? 320 : 262;
      const contentWidth = width - ctaWidth - 88;
      const card = scene.add.rectangle(left + width / 2, y + height / 2, width - 32, height, visualColor('inkPanel')).setStrokeStyle(1, visualColor('lineDirty'));
      add(card, text(left + 28, y + 8, action.title, compact ? 30 : 24).setFontStyle('bold'),
        text(left + 28, y + (compact ? 48 : 43), (single ? action.summary : action.summary.slice(0, 2)).join('\n'), compact ? 25 : 21)
          .setWordWrapWidth(contentWidth).setLineSpacing(2));
      const toggle = () => { previewId = previewId === action.id ? null : action.id; draw(); };
      if (action.forecast) {
        card.setInteractive({ useHandCursor: true }).on('pointerup', toggle)
          .on('pointerover', () => { if (!previewId) onPreview(action); })
          .on('pointerout', () => { if (!previewId) onPreview(null); });
        add(text(left + 28, y + height - (compact ? 36 : 27), previewId === action.id ? 'Нажми, чтобы скрыть прогноз ↑' : 'Нажми на карточку: прогноз ↑', compact ? 24 : 18, 'cold'));
        targets[`preview:${action.id}`] = { x: left + 80, y: y + height - 16 };
      }
      const ctaX = left + width - ctaWidth - 28;
      if (action.lockedReason) {
        add(text(ctaX, y + 20, action.lockedReason, compact ? 28 : 22, 'warning').setWordWrapWidth(ctaWidth).setAlign('center'));
      } else button(action.id, ctaX, y + (single ? height - (compact ? 110 : 68) : compact ? 56 : 58), ctaWidth, action.cta ?? 'Открыть', () => onAction(action), true);
    });
    if (pages > 1) {
      button('previous', left + 16, 600, compact ? 180 : 100, '←', () => { page--; draw(); }, false, page > 0);
      button('next', left + width - (compact ? 196 : 116), 600, compact ? 180 : 100, '→', () => { page++; draw(); }, false, page + 1 < pages);
      add(text(left + width / 2, 625, `${page + 1} / ${pages}`, compact ? 30 : 24).setOrigin(0.5, 0));
    }
    controls.forEach(control => { if (control.visible) container.bringToTop(control); });
    scene.game.canvas.setAttribute('aria-label', currentTitle);
    scene.game.canvas.setAttribute('data-panel-page', `${page + 1}`);
    scene.game.canvas.setAttribute('data-action-targets', JSON.stringify(targets));
  };
  const resize = () => { if (container.visible) draw(); };
  scene.scale.on('resize', resize);
  scene.events.once('shutdown', () => scene.scale.off('resize', resize));
  return {
    show: (heading, actions, navigation) => {
      navigationAction = navigation;
      if (heading !== currentTitle || !container.visible) { page = 0; previewId = null; }
      const signature = JSON.stringify([heading, actions, navigation]);
      if (signature === lastSignature && container.visible) return;
      currentTitle = heading; currentActions = actions; lastSignature = signature;
      draw(); container.setVisible(true);
    },
    hide: () => { previewId = null; onPreview(null); container.setVisible(false); dynamic.splice(0).forEach(object => object.destroy()); scene.game.canvas.removeAttribute('data-action-targets'); },
    isVisible: () => container.visible,
  };
};
