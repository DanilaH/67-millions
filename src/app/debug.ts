import { copyOrExposeText } from '@danilah/mini-games-kit/startup';
import type { DebugCommand } from '../core/state/debugCommands';
import { isDebugBuild } from './startup';

export interface DebugPanelHandle { setVisible(visible: boolean): void; destroy(): void; }

export const installDebugPanel = (
  getPayload: () => unknown,
  apply: (command: DebugCommand) => Promise<void>,
  pause: (paused: boolean) => void,
): DebugPanelHandle => {
  const root = document.querySelector<HTMLElement>('#debug-root');
  if (!root || !isDebugBuild()) return { setVisible: () => undefined, destroy: () => undefined };
  root.hidden = false;
  // Phaser listens for releases on window; DOM controls must not release into the map.
  const inputEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend'] as const;
  const stopInput = (event: Event) => event.stopPropagation();
  inputEvents.forEach(name => root.addEventListener(name, stopInput));
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '⚙ Плейтест';
  const controls = document.createElement('div');
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  status.textContent = 'Игра на паузе, пока панель открыта. Команды — с карты.';
  const amount = document.createElement('input');
  amount.type = 'number'; amount.value = '10000'; amount.step = '1'; amount.min = '1';
  amount.setAttribute('aria-label', 'Сумма денег');
  const minutes = document.createElement('input');
  minutes.type = 'number'; minutes.value = '60'; minutes.min = '1'; minutes.max = '1440'; minutes.step = '1';
  minutes.setAttribute('aria-label', 'Минуты промотки');
  let busy = false;
  const execute = async (command: DebugCommand) => {
    if (busy) return;
    busy = true;
    try { await apply(command); status.textContent = 'Сохранено. Закрой панель, чтобы продолжить.'; }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  };
  const button = (label: string, action: () => void) => {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
    element.addEventListener('click', action); return element;
  };
  const money = (sign: number) => {
    const value = amount.valueAsNumber;
    if (!Number.isSafeInteger(value) || value <= 0) { status.textContent = 'Введи положительную целую сумму'; return; }
    void execute({ kind: 'cash', amount: sign * value });
  };
  const resetConfirm = button('Да, удалить текущий забег', () => { resetConfirm.hidden = true; void execute({ kind: 'reset' }); });
  resetConfirm.hidden = true;
  controls.append(amount, button('+ Деньги', () => money(1)), button('− Деньги', () => money(-1)), minutes,
    button('Промотать минуты', () => { void execute({ kind: 'time', amount: minutes.valueAsNumber }); }),
    button('Вызвать платёж Барри', () => { void execute({ kind: 'barry' }); }),
    button('Сбросить сейв', () => { resetConfirm.hidden = !resetConfirm.hidden; }), resetConfirm,
    button('Скопировать диагностику', () => { void copyOrExposeText(JSON.stringify(getPayload()), { container: controls, ariaLabel: 'Startup diagnostics JSON' }); }), status);
  details.append(summary, controls); root.append(details);
  details.addEventListener('toggle', () => pause(details.open));
  return {
    setVisible: (visible) => {
      root.hidden = !visible;
      if (!visible && details.open) { details.open = false; pause(false); }
    },
    destroy: () => { inputEvents.forEach(name => root.removeEventListener(name, stopInput)); pause(false); root.replaceChildren(); root.hidden = true; },
  };
};
