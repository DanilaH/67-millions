import { SAVE_STORAGE_KEY } from '../core/save/repository';

export const SAVE_SESSION_LOCK = `${SAVE_STORAGE_KEY}:session`;

export type RequestSaveLock = (
  name: string,
  options: { ifAvailable?: boolean },
  callback: (lock: object | null) => Promise<void>,
) => Promise<void>;

// Own the whole session, not individual writes: a stale in-memory game must
// never become a writer again. The browser releases this lock when the owning
// document is destroyed. Do not release on blur, visibility or pagehide: queued
// writes, paid roots and a BFCache document can still belong to that session.
export const acquireSaveSession = (
  request: RequestSaveLock | undefined,
  onWaiting: () => void,
): Promise<void> => {
  if (!request) {
    return Promise.reject(new Error('Для безопасного сохранения нужен современный браузер и HTTPS. Обнови браузер и открой игру по защищённой ссылке.'));
  }
  return new Promise<void>((resolve, reject) => {
    const own = async (lock: object | null): Promise<void> => {
      if (!lock) throw new Error('Не удалось получить доступ к сохранению');
      resolve();
      await new Promise<void>(() => {});
    };
    void request(SAVE_SESSION_LOCK, { ifAvailable: true }, async (lock) => {
      if (lock) return own(lock);
      onWaiting();
      return request(SAVE_SESSION_LOCK, {}, own);
    }).catch(reject);
  });
};

export const acquireBrowserSaveSession = async (): Promise<void> => {
  let dialog: HTMLDialogElement | undefined;
  try {
    await acquireSaveSession(navigator.locks?.request.bind(navigator.locks), () => {
      dialog = document.createElement('dialog');
      dialog.id = 'save-session-wait';
      dialog.setAttribute('aria-labelledby', 'save-session-title');
      const title = document.createElement('h2');
      title.id = 'save-session-title';
      title.textContent = 'Игра уже открыта в другой вкладке';
      const body = document.createElement('p');
      body.textContent = 'Продолжай там или закрой другую вкладку. Эта вкладка продолжит автоматически с последнего сохранения. Два забега одновременно не запускаются, чтобы сохранить твой прогресс.';
      dialog.append(title, body);
      dialog.addEventListener('cancel', (event) => event.preventDefault());
      document.body.append(dialog);
      dialog.showModal();
    });
  } finally {
    dialog?.remove();
  }
};
