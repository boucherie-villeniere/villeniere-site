// Point d'entrée du Worker Cloudflare : le site Astro (fetch) + la tâche
// planifiée du récapitulatif du matin (scheduled, voir "triggers" dans wrangler.jsonc).
import { handle } from '@astrojs/cloudflare/handler';
import { ajouterJours, maintenantParis } from './lib/commande';
import { getClickCollect, getReglages } from './lib/data';
import { envoyerEmail } from './lib/emails';
import { jourDeRetrait, recapDuJour } from './lib/recap';
import { commandesEntre, purgerCommandes } from './lib/stockage';

/** Heure (Paris) d'envoi du récapitulatif. */
const HEURE_RECAP = 8;
/** Durée de conservation annoncée dans les mentions légales : trois mois après le retrait. */
const JOURS_CONSERVATION = 90;

export default {
  fetch: handle,

  async scheduled(controleur, env, ctx) {
    // Le déclencheur tourne à 6 h et 7 h UTC ; on ne garde que celui qui tombe
    // à 8 h à Paris (heure d'hiver comme d'été).
    const { date, heure } = maintenantParis(new Date(controleur.scheduledTime));
    if (heure !== HEURE_RECAP) return;

    // Tous les jours, y compris quand la boutique est fermée.
    ctx.waitUntil(
      purgerCommandes(env.DB, ajouterJours(date, -JOURS_CONSERVATION))
        .then((n) => console.info(`[purge] ${n} commande(s) supprimée(s)`))
        .catch((e) => console.error('[purge] échec', e)),
    );

    const cc = getClickCollect();
    if (!cc.actif || !jourDeRetrait(date, cc)) return;

    ctx.waitUntil(
      (async () => {
        const commandes = await commandesEntre(env.DB, date, date);
        const { sujet, html } = recapDuJour({ date, commandes, cc, r: getReglages(), origine: env.SITE_URL });
        await envoyerEmail(env.RESEND_API_KEY, { to: cc.emailCommandes, sujet, html, expediteur: env.COMMANDES_EXPEDITEUR });
        console.info(`[récap] ${date} : ${commandes.length} commande(s)`);
      })().catch((e) => console.error('[récap] échec', e)),
    );
  },
} satisfies ExportedHandler<Env>;
