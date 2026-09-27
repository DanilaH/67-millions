import { copyOrExposeText } from '@danilah/mini-games-kit/startup';

import { isDebugBuild } from './startup';

export interface DebugPanelHandle {
  destroy(): void;
}

export const installDebugPanel = (getPayload: () => unknown): DebugPanelHandle => {
  const root = document.querySelector<HTMLElement>('#debug-root');
  if (!root || !isDebugBuild()) return { destroy: () => undefined };

  root.hidden = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Copy startup JSON';
  const status = document.createElement('span');
  status.textContent = ' ready';
  root.append(button, status);

  const handleClick = async (): Promise<void> => {
    const payload = JSON.stringify(getPayload());
    try {
      const result = await copyOrExposeText(payload, {
        container: root,
        ariaLabel: 'Startup diagnostics JSON',
      });
      status.textContent = result.method === 'exposed' ? ' select + copy JSON below' : ' copied';
    } catch (error: unknown) {
      status.textContent = ` export failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  button.addEventListener('click', handleClick);

  return {
    destroy: () => {
      button.removeEventListener('click', handleClick);
      root.replaceChildren();
      root.hidden = true;
    },
  };
};
