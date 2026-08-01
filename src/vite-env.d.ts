/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_PROXY?: string;
  readonly VITE_ANTHROPIC_PROXY_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
