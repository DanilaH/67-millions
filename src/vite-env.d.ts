/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM?: 'mock' | 'yandex';
  readonly VITE_DEBUG_PANEL?: 'true' | 'false';
  readonly VITE_PERF_PROBE?: 'true' | 'false';
  readonly VITE_YANDEX_METRICA_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
