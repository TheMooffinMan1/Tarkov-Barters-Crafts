/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOB_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
