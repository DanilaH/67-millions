import { resolveRenderPixelRatio } from '@danilah/mini-games-kit/core';
import {
  BrowserViewportWatcher,
  resolveViewportState,
  type ViewportState,
} from '@danilah/mini-games-kit/layout';
import type { GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import type Phaser from 'phaser';
import { balance } from '../config/balance';

import { resolveGameViewport } from './viewportLayout';

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
  ({ width: balance.plinko.geometry.logicalViewportWidth, height: balance.plinko.geometry.logicalViewportHeight });

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
    onApply: (viewport) => {
      gate.setAttribute('aria-hidden', viewport.portrait ? 'false' : 'true');
      activity.setBlocked('orientation', viewport.portrait);
      if (viewport.portrait) return;

      const size = resolveGameViewport(viewport.width, viewport.height);
      const scale = size.scale;
      const density = Math.max(1, resolveRenderPixelRatio(scale * window.devicePixelRatio, 2));
      const backingWidth = Math.round(size.width * density);
      const backingHeight = Math.round(size.height * density);
      if (game.scale.width !== backingWidth || game.scale.height !== backingHeight) game.scale.resize(backingWidth, backingHeight);
      game.canvas.style.width = `${Math.round(size.width * scale)}px`;
      game.canvas.style.height = `${Math.round(size.height * scale)}px`;
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
