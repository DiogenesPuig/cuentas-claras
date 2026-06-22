/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Base URL del microservicio de ingesta (F2-1). Opcional: si falta, el OCR avisa. */
  readonly VITE_INGESTA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
