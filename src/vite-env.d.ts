/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM?: 'mock' | 'yandex';
  readonly VITE_DEBUG_PANEL?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
