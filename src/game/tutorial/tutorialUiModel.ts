import { balance } from '../../config/balance';
import { BARRY_CONTENT } from '../content/contentCatalog';
import type { TutorialStep } from './tutorialProgress';

export type TutorialSurface = 'map' | 'casino';

export interface TutorialCardModel {
  step: TutorialStep;
  title: string;
  body: string;
  acknowledge: 'BARRY' | 'NEEDS' | null;
}

export const buildTutorialCard = (
  step: TutorialStep,
  surface: TutorialSurface,
): TutorialCardModel | null => {
  if (step === 'DONE') return null;
  // City obligations belong on the map; casino hints explain its controls.
  if (surface === 'casino' && step !== 'FIRST_DROP' && step !== 'CHEAP_UPGRADE') return null;

  if (step === 'BARRY') {
    return {
      step,
      title: BARRY_CONTENT.name.toUpperCase(),
      body:
        'Каждый день в 09:00 Барри приходит за обязательным платежом. Если денег не хватает — забег окончен.',
      acknowledge: 'BARRY',
    };
  }

  if (step === 'FIRST_WORK') {
    return {
      step,
      title: 'СНАЧАЛА ЗАРАБОТАЙ',
      body:
        surface === 'map'
          ? 'Открой ПОДРАБОТКИ и закончи любую смену. За успех получишь деньги, за провал — штраф.'
          : 'Вернись на карту и закончи любую работу перед первым серьёзным риском.',
      acknowledge: null,
    };
  }

  if (step === 'FIRST_DROP') {
    return {
      step,
      title: 'ПЕРВЫЙ БРОСОК',
      body:
        surface === 'casino'
          ? 'Выбери ставку внизу и нажми «Бросить». Каждый запуск — отдельная ставка.'
          : 'Теперь зайди в КАЗИНО и сделай первый бросок. Не трать запас на платёж Барри.',
      acknowledge: null,
    };
  }

  if (step === 'CHEAP_UPGRADE') {
    return {
      step,
      title: 'ПЕРВЫЙ АПГРЕЙД',
      body:
        surface === 'casino'
          ? `Лимит ставки L1: ${balance.plinko.maxBetLevels[1]!.price.toLocaleString('ru-RU')} ₽. Центр L1: ${balance.plinko.centerUpgrades[0]!.price.toLocaleString('ru-RU')} ₽. Покупка — кнопкой с ценой.`
          : 'Вернись в КАЗИНО и купи первый недорогой апгрейд.',
      acknowledge: null,
    };
  }

  if (step === 'NEEDS') {
    return {
      step,
      title: 'ПОТРЕБНОСТИ',
      body:
        surface === 'map'
          ? 'HP, сытость, энергия и счастье меняются со временем. HP = 0 означает Game Over.'
          : 'Вернись на карту: следующий шаг — разобраться с четырьмя шкалами потребностей.',
      acknowledge: surface === 'map' ? 'NEEDS' : null,
    };
  }

  if (step === 'RECOVERY') {
    return {
      step,
      title: 'ВОССТАНОВИСЬ',
      body:
        surface === 'map'
          ? 'Используй ЕДУ или СОН. Это покажет основной цикл восстановления между заработком и риском.'
          : 'Вернись на карту и восстановись через ЕДУ или СОН.',
      acknowledge: null,
    };
  }

  return {
    step,
    title: 'ПЕРВЫЙ ПЛАТЁЖ БАРРИ',
    body:
      surface === 'map'
        ? 'Сохрани деньги до 09:00 и заплати Барри. После первой выплаты обучение закончится.'
        : 'Следи за таймером Барри. Первая успешная выплата завершит обучение.',
    acknowledge: null,
  };
};
