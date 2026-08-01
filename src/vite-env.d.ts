/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
