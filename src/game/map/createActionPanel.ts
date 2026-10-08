import Phaser from 'phaser';
import { fitPanelText } from '../ui/fitPanelText';
import type { ActionPreview } from '../actions/actionPreviews';
import { isCompactViewport, logicalPointer } from '../visual/scenePresentation';
import { VISUAL_FONT, visualColor, visualHex, type VisualColorToken } from '../visual/visualTheme';

export const ACTION_PANEL_VISIBILITY_EVENT = 'action-panel-visibility';

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
  const cards = new Map<string, Phaser.GameObjects.Rectangle>();
  const controls = new Map<string, Phaser.GameObjects.Text>();
  const handlers = new Map<string, () => void>();
  let lastSignature = '', currentTitle = '';
  let currentActions: ActionPreview[] = [];
  let actionOrder: string[] = [];
  let navigationAction: ActionPreview | undefined;
  let offset = 0;
  let drag: { y: number; offset: number; moved: boolean } | null = null;
  let suppressTap = false;
  let scrollTop = 236, scrollBottom = 688;
  let rowHeight = 180;
  const maxScroll = () => Math.max(0, currentActions.length * rowHeight - (scrollBottom - scrollTop));
  let previewId: string | null = null;
  const text = (x: number, y: number, label: string, size: number, color: VisualColorToken = 'textMain') =>
    scene.add.text(x, y, label, { fontFamily: VISUAL_FONT.sans, fontSize: size, color: visualHex(color) });
  const draw = (): void => {
    dynamic.splice(0).forEach(object => object.destroy());
    controls.forEach(control => control.setVisible(false));
    cards.forEach(card => card.setVisible(false));
    handlers.clear();
    const compact = isCompactViewport(scene);
    const left = compact ? 28 : 310, width = compact ? 1224 : 906;
    rowHeight = compact || currentActions.some(action => action.id.startsWith('work:')) ? 180 : 152;
    scrollTop = compact ? 236 : 202;
    scrollBottom = 688;
    offset = Phaser.Math.Clamp(offset, 0, maxScroll());
    onPreview(currentActions.find(action => action.id === previewId) ?? null);
    const listWidth = width - (maxScroll() > 0 ? (compact ? 100 : 60) : 0);
    const targets: Record<string, { x: number; y: number }> = {};
    const add = (...objects: Phaser.GameObjects.GameObject[]) => { container.add(objects); dynamic.push(...objects); };
    const button = (id: string, x: number, y: number, w: number, label: string, action: () => void, primary = false, enabled = true) => {
      const h = compact ? 88 : 46;
      let control = controls.get(id);
      if (!control) {
        control = text(x, y, label, compact ? 28 : 21);
        control.on('pointerup', () => { if (!suppressTap) handlers.get(id)?.(); });
        controls.set(id, control); container.add(control);
      }
      fitPanelText(control.setPosition(x, y).setText(label).setFontSize(compact ? 28 : 21), w - 16, h - 20, false)
        .setColor(visualHex(primary ? 'inkDeep' : 'textMain'))
        .setPadding(8, Math.floor((h - control.height) / 2)).setFixedSize(w, h).setAlign('center')
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
    currentActions.forEach((action, index) => {
      const y = scrollTop + index * rowHeight - offset;
      if (!single && (y + rowHeight - 12 <= scrollTop || y >= scrollBottom)) return;
      const rowStart = dynamic.length;
      const height = single ? (compact ? 356 : 340) : rowHeight - 12;
      const ctaWidth = compact ? 320 : 262;
      const contentWidth = listWidth - ctaWidth - 72;
      let card = cards.get(action.id);
      if (!card) {
        card = scene.add.rectangle(0, 0, 1, 1, visualColor('inkPanel')).setStrokeStyle(1, visualColor('lineDirty'));
        cards.set(action.id, card); container.add(card);
        card.on('pointerup', () => { if (!suppressTap) handlers.get(`preview:${action.id}`)?.(); })
          .on('pointerover', () => handlers.get(`hover:${action.id}`)?.())
          .on('pointerout', () => { if (!previewId) onPreview(null); });
      }
      const clippedTop = Math.max(scrollTop, y), clippedBottom = Math.min(scrollBottom, y + height);
      card.setPosition(left + listWidth / 2, (clippedTop + clippedBottom) / 2).setSize(listWidth - 32, clippedBottom - clippedTop).setVisible(true);
      container.bringToTop(card);
      add(fitPanelText(text(left + 28, y + 8, action.title, compact ? 30 : 22).setFontStyle('bold'), contentWidth, compact ? 36 : 28, false),
        fitPanelText(text(left + 28, y + (compact ? 48 : 36), (single ? action.summary : action.summary.slice(0, 2)).join('\n'), compact ? 25 : 18)
          .setLineSpacing(2), contentWidth, height - (compact ? 48 : 36) - (action.forecast ? (compact ? 42 : 28) : 12)));
      const toggle = () => { previewId = previewId === action.id ? null : action.id; draw(); };
      if (action.forecast) {
        card.setInteractive({ useHandCursor: true });
        handlers.set(`preview:${action.id}`, toggle);
        handlers.set(`hover:${action.id}`, () => { if (!previewId) onPreview(action); });
        add(fitPanelText(text(left + 28, y + height - (compact ? 36 : 23), previewId === action.id ? 'Нажми, чтобы скрыть прогноз ↑' : 'Нажми на карточку: прогноз ↑', compact ? 24 : 16, 'cold'), contentWidth, compact ? 30 : 20, false));
        if (y >= scrollTop && y + height <= scrollBottom) targets[`preview:${action.id}`] = { x: left + 80, y: y + height - 16 };
      }
      const ctaX = left + listWidth - ctaWidth - 28;
      if (action.timing) add(fitPanelText(text(ctaX, y + 4, action.timing, compact ? 21 : 16, action.timing.startsWith('Барри') ? 'warning' : 'textMuted'), ctaWidth, 46));
      if (action.lockedReason) {
        add(fitPanelText(text(ctaX, y + 56, action.lockedReason, compact ? 28 : 22, 'warning').setAlign('center'), ctaWidth, height - 68));
      } else button(action.id, ctaX, y + (single ? height - (compact ? 110 : 68) : compact ? 56 : 58), ctaWidth, action.cta ?? 'Открыть', () => onAction(action), true);
      for (const object of dynamic.slice(rowStart)) {
        if (object instanceof Phaser.GameObjects.Text && (object.y < scrollTop || object.y + object.height > scrollBottom)) object.setVisible(false);
      }
      const cta = controls.get(action.id);
      if (cta && (cta.y < scrollTop || cta.y + cta.height > scrollBottom)) { cta.setVisible(false).disableInteractive(); delete targets[action.id]; }
    });
    if (maxScroll() > 0) {
      button('previous', left + width - (compact ? 96 : 56), scrollBottom - (compact ? 188 : 104), compact ? 88 : 48, '↑', () => { offset -= rowHeight; draw(); }, false, offset > 0);
      button('next', left + width - (compact ? 96 : 56), scrollBottom - (compact ? 88 : 46), compact ? 88 : 48, '↓', () => { offset += rowHeight; draw(); }, false, offset < maxScroll());
      const trackHeight = scrollBottom - scrollTop - (compact ? 204 : 120);
      const thumbHeight = trackHeight * (scrollBottom - scrollTop) / (currentActions.length * rowHeight);
      add(scene.add.rectangle(left + width - (compact ? 52 : 32), scrollTop + trackHeight / 2, 4, trackHeight, visualColor('lineDirty')),
        scene.add.rectangle(left + width - (compact ? 52 : 32), scrollTop + thumbHeight / 2 + (trackHeight - thumbHeight) * offset / maxScroll(), 6, thumbHeight, visualColor('mustard')));
    }
    controls.forEach(control => { if (control.visible) container.bringToTop(control); });
    scene.game.canvas.setAttribute('aria-label', currentTitle);
    scene.game.canvas.setAttribute('data-panel-scroll', `${Math.round(offset)}`);
    scene.game.canvas.setAttribute('data-action-targets', JSON.stringify(targets));
  };
  const inside = (pointer: Phaser.Input.Pointer) => {
    const p = logicalPointer(scene, pointer);
    return container.visible && p.x >= (isCompactViewport(scene) ? 28 : 310) && p.x <= 1252 && p.y >= scrollTop && p.y <= scrollBottom;
  };
  const down = (pointer: Phaser.Input.Pointer) => {
    suppressTap = false;
    if (inside(pointer)) drag = { y: logicalPointer(scene, pointer).y, offset, moved: false };
  };
  const move = (pointer: Phaser.Input.Pointer) => {
    if (!drag || !pointer.isDown) return;
    const delta = logicalPointer(scene, pointer).y - drag.y;
    if (Math.abs(delta) > 8) drag.moved = suppressTap = true;
    if (drag.moved) { offset = drag.offset - delta; draw(); }
  };
  const up = () => { drag = null; };
  const wheel = (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
    if (inside(pointer)) { offset += dy; draw(); }
  };
  scene.input.on('pointerdown', down).on('pointermove', move).on('pointerup', up).on('gameout', up).on('wheel', wheel);
  const resize = () => { if (container.visible) draw(); };
  scene.scale.on('resize', resize);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', resize);
    scene.input.off('pointerdown', down).off('pointermove', move).off('pointerup', up).off('gameout', up).off('wheel', wheel);
    scene.game.canvas.removeAttribute('data-action-targets');
    scene.game.events.emit(ACTION_PANEL_VISIBILITY_EVENT);
  });
  return {
    show: (heading, actions, navigation) => {
      navigationAction = navigation;
      if (heading !== currentTitle || !container.visible) {
        offset = 0; previewId = null; drag = null; suppressTap = false;
        // Available shifts first on entry; clock refreshes never move a CTA under a finger.
        const ordered = actions.every(action => action.id.startsWith('work:'))
          ? [...actions].sort((a, b) => Number(a.lockedReason !== null) - Number(b.lockedReason !== null)) : actions;
        actionOrder = ordered.map(action => action.id);
      }
      const signature = JSON.stringify([heading, actions, navigation]);
      if (signature === lastSignature && container.visible) return;
      currentTitle = heading; currentActions = [...actions].sort((a, b) => actionOrder.indexOf(a.id) - actionOrder.indexOf(b.id)); lastSignature = signature;
      draw(); container.setVisible(true);
      scene.game.events.emit(ACTION_PANEL_VISIBILITY_EVENT);
    },
    hide: () => { previewId = null; onPreview(null); container.setVisible(false); dynamic.splice(0).forEach(object => object.destroy()); scene.game.canvas.removeAttribute('data-action-targets'); scene.game.events.emit(ACTION_PANEL_VISIBILITY_EVENT); },
    isVisible: () => container.visible,
  };
};
