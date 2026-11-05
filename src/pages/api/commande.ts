import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import { getClickCollect, getPlats, getReglages } from '../../lib/data';
import { formaterDate, formaterPrix, validerCommande, type Commande } from '../../lib/commande';
import { bouton, encadreRetrait, envoyerEmail, echapper, gabarit, paragraphesHtml, tableauLignes } from '../../lib/emails';
import { enregistrerCommande } from '../../lib/stockage';

export const prerender = false;

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
  const r = getReglages();
  const plats = getPlats();
  const resultat = validerCommande(commande, cc, plats);
  if (!resultat.ok) return reponse(422, { erreur: resultat.erreur });

  const { lignes, total } = resultat;
  const c = commande as Commande;
  const quand = `${formaterDate(c.date)}, ${c.creneau}`;
  const auPoids = lignes.some((l) => l.unite === 'kg');
  const origine = new URL(request.url).origin;
  const cle = getSecret('RESEND_API_KEY');
  const expediteur = getSecret('COMMANDES_EXPEDITEUR');

  // 1. On enregistre la commande (planning /commandes). Si la base est
  //    indisponible, l'e-mail à la boucherie part quand même : rien n'est perdu.
  let enregistree = false;
  try {
    await enregistrerCommande(env.DB, {
      date: c.date,
      creneau: c.creneau,
      nom: c.nom.trim(),
      telephone: c.telephone.trim(),
      email: c.email?.trim() || null,
      remarque: c.remarque?.trim() || null,
      lignes,
      total,
    });
    enregistree = true;
  } catch (e) {
    console.error('[commande] échec enregistrement', e);
  }

  // 2. E-mail à la boucherie.
  const pourBoucherie = gabarit({
    origine,
    r,
    titre: 'Nouvelle commande',
    apercu: `${c.nom} — ${quand} — ${formaterPrix(total)}`,
    contenu: `
      ${encadreRetrait(quand, r)}
      <p style="margin:0 0 4px"><strong style="color:#15181B">${echapper(c.nom)}</strong></p>
      <p style="margin:0 0 20px"><a href="tel:${echapper(c.telephone.replace(/\s/g, ''))}" style="color:#15181B">${echapper(c.telephone)}</a>${
        c.email ? `<br><a href="mailto:${echapper(c.email)}" style="color:#15181B">${echapper(c.email)}</a>` : ''
      }</p>
      ${tableauLignes(lignes, total, auPoids ? '* au poids : montant ajusté à la pesée' : '')}
      ${c.remarque ? `<p style="margin:0 0 24px;padding:12px 16px;background:#faf7f1"><strong>Remarque :</strong><br>${echapper(c.remarque).replace(/\n/g, '<br>')}</p>` : ''}
      ${enregistree ? bouton(`${origine}/commandes?jour=${c.date}`, 'Voir le planning') : ''}`,
  });
  try {
    await envoyerEmail(cle, { to: cc.emailCommandes, sujet: `Commande — ${c.nom} — ${quand}`, html: pourBoucherie, replyTo: c.email, expediteur });
  } catch (e) {
    console.error('[commande] échec envoi boucherie', e);
    if (!enregistree) return reponse(502, { erreur: 'La commande n’a pas pu être transmise. Merci de réessayer ou de nous appeler.' });
  }

  // 3. Récapitulatif au client (textes modifiables dans l'admin). Son échec
  //    ne doit pas annuler la commande.
  if (c.email) {
    const pourClient = gabarit({
      origine,
      r,
      titre: cc.emailClientTitre || 'Merci pour votre commande !',
      apercu: `Votre commande sera prête ${quand}.`,
      contenu: `
        <p style="margin:0 0 14px">Bonjour ${echapper(c.nom)},</p>
        ${paragraphesHtml(cc.emailClientIntro || 'Nous avons bien reçu votre commande, nous vous la préparons avec soin.')}
        ${encadreRetrait(quand, r)}
        ${tableauLignes(lignes, total, auPoids ? '* au poids : le montant exact est ajusté à la pesée' : '')}
        ${cc.mentionPaiement ? `<p style="margin:0 0 14px"><strong style="color:#15181B">${echapper(cc.mentionPaiement)}</strong></p>` : ''}
        ${paragraphesHtml(cc.emailClientFin || 'Un empêchement ? Appelez-nous, tout simplement. À très vite à la boutique !')}`,
    });
    await envoyerEmail(cle, {
      to: c.email,
      sujet: cc.emailClientObjet || 'Votre commande à la boucherie Villenière',
      html: pourClient,
      replyTo: cc.emailCommandes,
      expediteur,
    }).catch((e) => console.error('[commande] échec envoi client', e));
  }

  // Pas de données personnelles dans les journaux.
  console.info(`[commande] ${quand} — ${lignes.map((l) => `${l.quantite}× ${l.nom}`).join(', ')} — ${formaterPrix(total)}`);
  return reponse(200, { ok: true, total });
};
