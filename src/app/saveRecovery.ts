import type { GameplayActivityCoordinator } from '@danilah/mini-games-kit/platform';
import type { SaveRecovery } from '../core/save/retryStorage';

export const createSaveRecovery = (
  activity: Pick<GameplayActivityCoordinator, 'setBlocked'>,
): SaveRecovery & { destroy(): void } => {
  const dialog = document.createElement('dialog');
  dialog.id = 'save-recovery';
  dialog.setAttribute('aria-labelledby', 'save-recovery-title');
  const title = document.createElement('h2');
  title.id = 'save-recovery-title';
  title.textContent = 'Не удалось сохранить игру';
  const body = document.createElement('p');
  body.textContent = 'Игра на паузе. Повтори сохранение. Если ошибка остаётся, проверь свободное место и разрешения браузера. Не закрывай вкладку: последние действия ещё не сохранены.';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Повторить сохранение';
  dialog.append(title, body, button);
  document.body.append(dialog);
  // Escape must not resume unsaved gameplay.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  let retry: (() => void) | undefined;
  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    const resolve = retry;
    retry = undefined;
    resolve?.();
  });
  return {
    waitForRetry: () => {
      activity.setBlocked('save-error', true);
      button.disabled = false;
      button.textContent = 'Повторить сохранение';
      if (!dialog.open) dialog.showModal();
      button.focus();
      return new Promise<void>((resolve) => { retry = resolve; });
    },
    recovered: () => {
      dialog.close();
      activity.setBlocked('save-error', false);
    },
    destroy: () => { dialog.remove(); },
  };
};
