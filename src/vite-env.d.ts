/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_RELEASE_SHA?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_REF?: string;
  readonly VITE_APP_ORIGIN?: string;
  readonly VITE_DEPLOYMENT_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
