/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOB_BASE?: string;
  /** Public site origin for canonical URLs, Open Graph, and sitemap (no trailing slash). */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
