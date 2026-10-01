/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_METRICA_COUNTER_ID?: string;
  readonly VITE_PLATFORM?: 'mock' | 'yandex';
  readonly VITE_DEBUG_PANEL?: 'true' | 'false';
  readonly VITE_PERF_PROBE?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
