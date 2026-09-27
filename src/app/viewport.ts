import {
  BrowserViewportWatcher,
  resolveInitialLandscapeGameCssSize,
  resolveLandscapeGameCssSize,
  resolveViewportState,
  type ViewportState,
} from '@danilah/mini-games-kit/layout';
import type { GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import type Phaser from 'phaser';

const readSize = (width: number, height: number) => ({ width, height });

export const readInitialViewport = (): ViewportState => {
  const visual = window.visualViewport;
  return resolveViewportState(
    visual ? readSize(visual.width, visual.height) : null,
    readSize(window.innerWidth, window.innerHeight),
    readSize(document.documentElement.clientWidth, document.documentElement.clientHeight),
    typeof window.matchMedia === 'function' ? window.matchMedia('(orientation: portrait)').matches : null,
  );
};

export const getInitialGameSize = (): { width: number; height: number } =>
  resolveInitialLandscapeGameCssSize(readInitialViewport());

export interface ViewportRuntimeHandle {
  destroy(): void;
}

export const installViewportRuntime = (
  game: Phaser.Game,
  activity: Pick<GameplayActivityCoordinator, 'setBlocked'>,
): ViewportRuntimeHandle => {
  const gate = document.querySelector<HTMLElement>('#rotate-gate');
  if (!gate) throw new Error('Missing #rotate-gate bootstrap element');

  const watcher = new BrowserViewportWatcher({
    onApply: (viewport, context) => {
      gate.setAttribute('aria-hidden', viewport.portrait ? 'false' : 'true');
      activity.setBlocked('orientation', viewport.portrait);
      if (viewport.portrait) return;

      const size = resolveLandscapeGameCssSize(viewport);
      game.canvas.style.width = `${Math.round(size.width)}px`;
      game.canvas.style.height = `${Math.round(size.height)}px`;
      if (context.changed) game.scale.resize(Math.round(size.width), Math.round(size.height));
      game.scale.refresh();
    },
  });
  watcher.start();

  return {
    destroy: () => {
      watcher.destroy();
      activity.setBlocked('orientation', false);
    },
  };
};
