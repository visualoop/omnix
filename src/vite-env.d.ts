/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OMNIX_VARIANT?: "pro" | "dawa" | "retail" | "hospitality" | "hardware";
  readonly VITE_SKIP_LICENSE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
