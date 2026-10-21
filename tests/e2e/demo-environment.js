// Existing process values take precedence over .env and .env.local in Node/Vite.
// Explicit empty strings keep this suite in preview mode even on configured machines.
export const demoEnvironment = {
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  SUPABASE_SECRET_KEY: '',
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_SUPABASE_ANON_KEY: '',
};

// Dedicated ports keep the suite separate from a developer's connected local app.
export const apiPort = Number(process.env.E2E_API_PORT || 3101);
export const webPort = Number(process.env.E2E_WEB_PORT || 5183);
