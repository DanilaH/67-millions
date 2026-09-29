import type { BalanceConfig } from '../../config/balance.schema';

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
    label: 'РАБОТА',
    description: 'Посуда / мусор / курьер',
    x: 430,
    y: 220,
  },
  {
    id: 'food',
    label: 'ЕДА',
    description: 'Восстановить сытость',
    x: 675,
    y: 190,
  },
  {
    id: 'home',
    label: 'ДОМ',
    description: 'Сон и восстановление',
    x: 920,
    y: 220,
  },
  {
    id: 'entertainment',
    label: 'РАЗВЛЕЧЕНИЯ',
    description: 'Поднять счастье',
    x: 430,
    y: 430,
  },
  {
    id: 'dumpster',
    label: 'ПОМОЙКА',
    description: 'Аварийное восстановление',
    x: 675,
    y: 470,
  },
  {
    id: 'shower',
    label: 'ДУШ',
    description: 'Снять статус',
    x: 920,
    y: 430,
  },
  {
    id: 'casino',
    label: 'КАЗИНО',
    description: 'Plinko и апгрейды',
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
