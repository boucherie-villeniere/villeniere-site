// Secrets saisis dans le tableau de bord Cloudflare (absents de wrangler.jsonc,
// donc inconnus de `wrangler types`).
interface Env {
  DB: D1Database;
  SITE_URL: string;
  RESEND_API_KEY?: string;
  COMMANDES_EXPEDITEUR?: string;
  COMMANDES_MOT_DE_PASSE?: string;
}
