export interface NamedContent {
  title: string;
  description: string;
}

export interface EventContent {
  title: string;
  body: string;
  choiceA: string;
  choiceB: string;
}

export const FOOD_CONTENT: Record<
  string,
  NamedContent
> = {
  FOOD_01: {
    title: 'ХОЛОДНАЯ ЛАПША',
    description: 'Дёшево, долго и немного грустно.',
  },
  FOOD_02: {
    title: 'ПИРОЖОК У ОКНА',
    description: 'Быстрый перекус без лишних вопросов.',
  },
  FOOD_03: {
    title: 'ГОРЯЧАЯ КАША',
    description: 'Просто, сытно и почти по-домашнему.',
  },
  FOOD_04: {
    title: 'ШАУРМА «НОЧНАЯ»',
    description: 'Быстро возвращает силы и настроение.',
  },
  FOOD_05: {
    title: 'ОБЕД В СТОЛОВОЙ',
    description: 'Нормальная еда среди ненормального дня.',
  },
  FOOD_06: {
    title: 'БОЛЬШАЯ ТАРЕЛКА',
    description: 'Серьёзная порция перед длинным забегом.',
  },
  FOOD_07: {
    title: 'ГОРЯЧИЙ УЖИН',
    description: 'Почти полностью закрывает голод.',
  },
  FOOD_08: {
    title: 'ПРАЗДНИЧНЫЙ СТОЛ',
    description: 'Дорого, долго, зато жизнь снова терпима.',
  },
  FOOD_09: {
    title: 'ЭНЕРГЕТИК И СУХАРИКИ',
    description: 'Бодрит быстро. Организм не благодарит.',
  },
  FOOD_10: {
    title: 'ПОЗДНИЙ ЗАВТРАК',
    description: 'Медленно, сытно и неожиданно приятно.',
  },
};

export const ENTERTAINMENT_CONTENT: Record<
  string,
  NamedContent
> = {
  FREE_FUN: {
    title: 'ПОСИДЕТЬ ВО ДВОРЕ',
    description: 'Бесплатно. Иногда этого достаточно.',
  },
  PC_CLUB: {
    title: 'НОЧНОЙ КОМПЬЮТЕРНЫЙ КЛУБ',
    description: 'Шумно, тесно, зато голова отключается.',
  },
  CINEMA: {
    title: 'СТАРЫЙ КИНОЗАЛ',
    description: 'Два часа чужих проблем вместо своих.',
  },
};

export const LOCATION_CONTENT: Record<
  | 'work'
  | 'food'
  | 'home'
  | 'entertainment'
  | 'dumpster'
  | 'shower'
  | 'casino',
  NamedContent
> = {
  work: {
    title: 'ПОДРАБОТКИ',
    description: 'Посуда · мусор · курьер',
  },
  food: {
    title: 'ЗАКУСОЧНАЯ',
    description: 'Еда от дешёвой до почти нормальной',
  },
  home: {
    title: 'КОМНАТА',
    description: 'Сон и восстановление',
  },
  entertainment: {
    title: 'КВАРТАЛ ОТДЫХА',
    description: 'Вернуть немного счастья',
  },
  dumpster: {
    title: 'ЗАДНИЙ ДВОР',
    description: 'Рискованный аварийный ресурс',
  },
  shower: {
    title: 'БАННЫЙ БЛОК',
    description: 'Смыть статус ВОНЮЧИЙ',
  },
  casino: {
    title: 'КРИВОЕ КАЗИНО',
    description: 'Plinko · ставки · апгрейды',
  },
};

export const BARRY_CONTENT = {
  name: 'Барри Вайлд',
  dueTitle: 'БАРРИ ПРИШЁЛ',
  dueBody:
    '09:00. Барри забирает обязательный платёж. Не заплатишь — забег закончится.',
  paid: 'Барри забрал деньги и ушёл до следующего утра.',
  failed:
    'Барри не получил платёж. На этом твоя отсрочка закончилась.',
} as const;

export const EVENT_CONTENT: Record<
  string,
  EventContent
> = {
  EVENT_01: {
    title: 'РАЗБИТАЯ ВИТРИНА',
    body:
      'У склада треснула витрина. Хозяин уже нашёл того, кто «точно был рядом».',
    choiceA: 'Заплатить и не спорить',
    choiceB: 'Разбираться самому: -20 счастья, +120 мин',
  },
  EVENT_02: {
    title: 'СМЕНА БЕЗ ПРЕМИИ',
    body:
      'Начальник предлагает закрыть вопрос деньгами или урезать две следующие выплаты.',
    choiceA: 'Откупиться',
    choiceB: 'Следующие 2 работы: доход ×0,7',
  },
  EVENT_03: {
    title: 'БАРРИ ПЕРЕСЧИТАЛ',
    body:
      'В записке Барри появилась новая строка. Можно закрыть её сейчас или оставить на завтра.',
    choiceA: 'Заплатить сейчас',
    choiceB: 'Следующий платёж Барри ×1,15',
  },
  EVENT_04: {
    title: 'ЛИФТ СДОХ',
    body:
      'До нужного этажа теперь только пешком. Можно тащить самому или срезать путь через опасную лестницу.',
    choiceA: 'Подняться пешком: -25 энергии',
    choiceB: 'Полезть коротким путём: -10 HP',
  },
  EVENT_05: {
    title: 'ПРОПАЛА НАКЛАДНАЯ',
    body:
      'Бумажка исчезла ровно тогда, когда понадобилась. Вопрос решается деньгами или временем.',
    choiceA: 'Заплатить за восстановление',
    choiceB: 'Искать самому: +180 мин',
  },
  EVENT_06: {
    title: 'СЛОМАННАЯ ТЕЛЕЖКА',
    body:
      'Грузовая тележка развалилась посреди двора. Можно вызвать помощь или дотащить всё на себе.',
    choiceA: 'Оплатить помощь',
    choiceB: 'Тащить самому: -15 HP',
  },
  EVENT_07: {
    title: 'ПРОТЁКШИЙ ПАКЕТ',
    body:
      'Во дворе потёк подозрительный пакет. Или платишь за уборку, или пахнуть будет уже от тебя.',
    choiceA: 'Оплатить уборку',
    choiceB: 'Убирать самому: статус ВОНЮЧИЙ',
  },
  EVENT_08: {
    title: 'ПРОВЕРКА КАЗИНО',
    body:
      'В кривое казино внезапно пришла проверка проводки. Можно ускорить процесс или ждать.',
    choiceA: 'Ускорить ремонт',
    choiceB: 'Казино закрыто на 180 мин',
  },
  EVENT_09: {
    title: 'НЕХВАТКА ЛЮДЕЙ',
    body:
      'Одна из подработок внезапно выпала из расписания. Деньги решают вопрос быстрее расписания.',
    choiceA: 'Договориться',
    choiceB: 'Случайная работа закрыта на 360 мин',
  },
  EVENT_10: {
    title: 'ДОРОГАЯ ПОСТАВКА',
    body:
      'Закусочная получила новую накладную и сразу переписала ценники.',
    choiceA: 'Закрыть разницу сейчас',
    choiceB: 'Еда дороже на 30% следующие 720 мин',
  },
};

export const getFoodContent = (
  id: string,
): NamedContent =>
  FOOD_CONTENT[id] ?? {
    title: id,
    description: '',
  };

export const getEntertainmentContent = (
  id: string,
): NamedContent =>
  ENTERTAINMENT_CONTENT[id] ?? {
    title: id,
    description: '',
  };

export const getEventContent = (
  id: string,
): EventContent => {
  const content = EVENT_CONTENT[id];
  if (!content) {
    throw new Error(`Missing event copy for ${id}`);
  }
  return content;
};
