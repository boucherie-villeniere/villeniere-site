// Secrets saisis dans le tableau de bord Cloudflare (absents de wrangler.jsonc,
// donc inconnus de `wrangler types`).
interface Env {
  DB: D1Database;
  SITE_URL: string;
  RESEND_API_KEY?: string;
  COMMANDES_EXPEDITEUR?: string;
  COMMANDES_MOT_DE_PASSE?: string;
  OVH_APP_KEY?: string;
  OVH_APP_SECRET?: string;
  OVH_CONSUMER_KEY?: string;
  OVH_SMS_SERVICE?: string;
  OVH_SMS_EXPEDITEUR?: string;
}

// Même chose pour `env` importé de « cloudflare:workers ».
declare namespace Cloudflare {
  interface Env {
    COMMANDES_MOT_DE_PASSE?: string;
    OVH_APP_KEY?: string;
    OVH_APP_SECRET?: string;
    OVH_CONSUMER_KEY?: string;
    OVH_SMS_SERVICE?: string;
    OVH_SMS_EXPEDITEUR?: string;
    GOOGLE_MAPS_CLE?: string;
  }
}
