import type { GameState } from '../../core/state/GameState';
import { getFoodActionDefinition } from '../../core/actions/foodEntertainment';
import type { BalanceConfig } from '../../config/balance.schema';
import { LOCATION_CONTENT } from '../content/contentCatalog';

export type MainMapLocationId =
  | 'work'
  | 'food'
  | 'home'
  | 'entertainment'
  | 'dumpster'
  | 'shower'
  | 'casino';

export interface MainMapLocation {
  id: MainMapLocationId;
  label: string;
  description: string;
  x: number;
  y: number;
  timeCostMinutes: number;
}

const LOCATIONS = [
  {
    id: 'work',
    label: LOCATION_CONTENT.work.title,
    description: LOCATION_CONTENT.work.description,
    x: 430,
    y: 220,
  },
  {
    id: 'food',
    label: LOCATION_CONTENT.food.title,
    description: LOCATION_CONTENT.food.description,
    x: 675,
    y: 190,
  },
  {
    id: 'home',
    label: LOCATION_CONTENT.home.title,
    description: LOCATION_CONTENT.home.description,
    x: 920,
    y: 220,
  },
  {
    id: 'entertainment',
    label: LOCATION_CONTENT.entertainment.title,
    description: LOCATION_CONTENT.entertainment.description,
    x: 430,
    y: 430,
  },
  {
    id: 'dumpster',
    label: LOCATION_CONTENT.dumpster.title,
    description: LOCATION_CONTENT.dumpster.description,
    x: 675,
    y: 470,
  },
  {
    id: 'shower',
    label: LOCATION_CONTENT.shower.title,
    description: LOCATION_CONTENT.shower.description,
    x: 920,
    y: 430,
  },
  {
    id: 'casino',
    label: LOCATION_CONTENT.casino.title,
    description: LOCATION_CONTENT.casino.description,
    x: 1080,
    y: 325,
  },
] as const;

export const deriveMainMapLocations = (
  config: BalanceConfig,
): MainMapLocation[] =>
  LOCATIONS.map((location) => ({
    ...location,
    timeCostMinutes: config.time.navigationTimeMinutes,
  }));

/** Presentation only: prices come from the same definitions as purchases. */
export const deriveMainMapHints = (state: GameState, config: BalanceConfig): {
  labels: Record<MainMapLocationId, string>;
  suggested: MainMapLocationId | null;
} => {
  const foodPrice = Math.min(...config.food.map(entry => getFoodActionDefinition(state, entry).price));
  const money = (value: number) => value.toLocaleString('ru-RU');
  const labels: Record<MainMapLocationId, string> = {
    work: 'Выбрать смену', food: `Еда от ${money(foodPrice)} ₽`,
    home: 'Сон · бесплатно', entertainment: 'Есть бесплатный отдых',
    dumpster: 'Поиск · риск для здоровья', shower: `Душ · ${money(config.shower.price)} ₽`,
    casino: state.eventModifiers.plinkoLockRemainingMinutes > 0 ? 'Временно закрыто' : 'Ставки и улучшения',
  };
  let suggested: MainMapLocationId | null = null;
  if (state.needs.satiety <= config.needs.lowThreshold) {
    suggested = 'food'; labels.food = `Голод · еда от ${money(foodPrice)} ₽`;
  } else if (state.needs.energy <= config.needs.lowThreshold) {
    suggested = 'home'; labels.home = 'Мало сил · пора поспать';
  } else if (state.statuses.SMELLY) {
    suggested = 'shower'; labels.shower = `Смыть запах · ${money(config.shower.price)} ₽`;
  } else if (state.needs.happiness <= config.needs.lowThreshold) {
    suggested = 'entertainment'; labels.entertainment = 'Мало счастья · отдохни';
  }
  return { labels, suggested };
};
