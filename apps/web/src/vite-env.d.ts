/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUREN_REGISTRY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
