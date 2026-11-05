import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { getClickCollect, getPlats } from '../../lib/data';
import { formaterDate, formaterPrix, validerCommande, type Commande, type LigneValidee } from '../../lib/commande';

export const prerender = false;

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function tableau(lignes: LigneValidee[]) {
  return lignes
    .map(
      (l) =>
        `<tr><td style="padding:6px 12px 6px 0"><strong>${l.quantite} ×</strong> ${echapper(l.nom)}</td><td style="padding:6px 0;text-align:right">${formaterPrix(l.total)}${l.unite === 'kg' ? ' (indicatif)' : ''}</td></tr>`,
    )
    .join('');
}

async function envoyerEmail(to: string, sujet: string, html: string, replyTo?: string) {
  // Lu à l'exécution (secret Cloudflare), pas figé au moment du build.
  const cle = getSecret('RESEND_API_KEY');
  if (!cle) {
    // En local sans clé : on affiche le mail dans la console au lieu de l'envoyer.
    console.info(`\n[commande] e-mail non envoyé (RESEND_API_KEY absente)\nÀ : ${to}\nObjet : ${sujet}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: getSecret('COMMANDES_EXPEDITEUR') || 'Boucherie Villenière <commandes@boucherie-villeniere.fr>',
      to,
      subject: sujet,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status} : ${await res.text()}`);
}

const reponse = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  let commande: Partial<Commande>;
  try {
    commande = await request.json();
  } catch {
    return reponse(400, { erreur: 'Requête invalide.' });
  }

  const cc = getClickCollect();
  const plats = getPlats();
  const resultat = validerCommande(commande, cc, plats);
  if (!resultat.ok) return reponse(422, { erreur: resultat.erreur });

  const { lignes, total } = resultat;
  const c = commande as Commande;
  const quand = `${formaterDate(c.date)}, ${c.creneau}`;
  const auPoids = lignes.some((l) => l.unite === 'kg');

  const pourBoucherie = `
    <h2 style="font-family:Georgia,serif">Nouvelle commande click &amp; collect</h2>
    <p><strong>Retrait :</strong> ${echapper(quand)}</p>
    <p><strong>Client :</strong> ${echapper(c.nom)}<br><strong>Tél :</strong> <a href="tel:${echapper(c.telephone)}">${echapper(c.telephone)}</a>${c.email ? `<br><strong>E-mail :</strong> ${echapper(c.email)}` : ''}</p>
    <table style="border-collapse:collapse;font-size:15px">${tableau(lignes)}
      <tr><td style="padding:10px 12px 0 0;border-top:1px solid #ccc"><strong>Total estimé</strong></td><td style="padding:10px 0 0;border-top:1px solid #ccc;text-align:right"><strong>${formaterPrix(total)}</strong></td></tr>
    </table>
    ${c.remarque ? `<p><strong>Remarque :</strong><br>${echapper(c.remarque).replace(/\n/g, '<br>')}</p>` : ''}`;

  const pourClient = `
    <h2 style="font-family:Georgia,serif">Merci pour votre commande !</h2>
    <p>Bonjour ${echapper(c.nom)},</p>
    <p>Votre commande sera prête le <strong>${echapper(quand)}</strong> à la boucherie Villenière.</p>
    <table style="border-collapse:collapse;font-size:15px">${tableau(lignes)}</table>
    <p><strong>Total estimé : ${formaterPrix(total)}</strong>${auPoids ? ' (ajusté à la pesée)' : ''}</p>
    <p>${echapper(cc.mentionPaiement ?? '')}</p>
    <p>Un empêchement ? Appelez-nous, tout simplement.</p>`;

  try {
    await envoyerEmail(cc.emailCommandes, `Commande — ${c.nom} — ${quand}`, pourBoucherie, c.email);
  } catch (e) {
    console.error('[commande] échec envoi boucherie', e);
    return reponse(502, { erreur: 'La commande n’a pas pu être transmise. Merci de réessayer ou de nous appeler.' });
  }
  if (c.email) {
    // Le récapitulatif client est un plus : son échec ne doit pas annuler la commande.
    await envoyerEmail(c.email, 'Votre commande à la boucherie Villenière', pourClient).catch((e) =>
      console.error('[commande] échec envoi client', e),
    );
  }

  // Pas de données personnelles dans les journaux.
  console.info(`[commande] ${quand} — ${lignes.map((l) => `${l.quantite}× ${l.nom}`).join(', ')} — ${formaterPrix(total)}`);
  return reponse(200, { ok: true, total });
};
