// Envoi et mise en page des e-mails (Resend). Gabarit en tableaux et styles en
// ligne : c'est ce que les messageries (Gmail, Outlook, Apple Mail) affichent
// le plus fidèlement. Pas de SVG ni de polices web : logo en PNG, Georgia pour
// les titres (proche de la typo du site), Arial pour le texte.

import { formaterPrix, libelleTotal, sansEstimation, type LigneValidee } from './commande';
import type { Reglages } from './data';

export const EXPEDITEUR_DEFAUT = 'Boucherie Villenière <commandes@boucherie-villeniere.fr>';

const C = {
  or: '#C2A063',
  orFonce: '#8a6a32',
  encre: '#15181B',
  gris: '#4E4B48',
  papier: '#faf7f1',
  filet: '#e6dccb',
};

export const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Texte saisi dans l'admin → paragraphes HTML (lignes vides = nouveaux paragraphes). */
export const paragraphesHtml = (texte = '', style = '') =>
  texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;${style}">${echapper(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

export async function envoyerEmail(
  cle: string | undefined,
  { to, sujet, html, replyTo, expediteur }: { to: string; sujet: string; html: string; replyTo?: string; expediteur?: string },
) {
  if (!cle) {
    // En local sans clé : on signale l'e-mail dans la console au lieu de l'envoyer.
    console.info(`\n[e-mail] non envoyé (RESEND_API_KEY absente)\nÀ : ${to}\nObjet : ${sujet}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: expediteur || EXPEDITEUR_DEFAUT,
      to,
      subject: sujet,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status} : ${await res.text()}`);
}

/** Tableau des plats commandés. */
export function tableauLignes(lignes: LigneValidee[], total?: number, noteTotal = '') {
  const rangees = lignes
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.filet};font:15px/1.4 Arial,sans-serif;color:${C.encre}">
          <strong>${l.quantite} ×</strong> ${echapper(l.nom)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${C.filet};font:15px/1.4 Arial,sans-serif;color:${C.encre};text-align:right;white-space:nowrap">
          ${sansEstimation(l) ? 'à la pesée' : `${formaterPrix(l.total)}${l.unite === 'kg' || l.aLaPesee ? '*' : ''}`}
        </td>
      </tr>`,
    )
    .join('');
  const ligneTotal =
    total === undefined
      ? ''
      : `
      <tr>
        <td style="padding:14px 0 0;font:bold 16px/1.4 Arial,sans-serif;color:${C.encre}">Total estimé</td>
        <td style="padding:14px 0 0;font:bold 16px/1.4 Arial,sans-serif;color:${C.encre};text-align:right">${echapper(libelleTotal(lignes))}</td>
      </tr>
      ${noteTotal ? `<tr><td colspan="2" style="padding:4px 0 0;font:13px/1.4 Arial,sans-serif;color:${C.gris}">${noteTotal}</td></tr>` : ''}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 24px">${rangees}${ligneTotal}</table>`;
}

/** Encadré « retrait » : date, créneau, adresse. */
export function encadreRetrait(quand: string, r: Reglages) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 24px;background:${C.papier};border-left:3px solid ${C.or}">
      <tr><td style="padding:16px 20px">
        <p style="margin:0 0 4px;font:bold 11px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${C.orFonce}">Retrait en boutique</p>
        <p style="margin:0 0 6px;font:22px/1.3 Georgia,serif;color:${C.encre}">${echapper(quand)}</p>
        <p style="margin:0;font:14px/1.5 Arial,sans-serif;color:${C.gris}">${echapper(`${r.adresse}, ${r.codePostal} ${r.ville}`)}</p>
      </td></tr>
    </table>`;
}

export const bouton = (href: string, texte: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr>
    <td style="background:${C.encre};border-radius:999px">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font:bold 13px/1 Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none">${texte}</a>
    </td>
  </tr></table>`;

/**
 * Gabarit commun : logo, filet doré, contenu, pied avec adresse et téléphone.
 * `origine` = adresse du site (sert au logo et aux liens).
 */
export function gabarit({ origine, titre, contenu, r, apercu = '' }: { origine: string; titre: string; contenu: string; r: Reglages; apercu?: string }) {
  const adresse = `${r.adresse}, ${r.codePostal} ${r.ville}`;
  const plan = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Boucherie Villenière ${adresse}`)}`;
  const tel = r.telephone ? `<a href="tel:${r.telephone.replace(/\s/g, '')}" style="color:${C.encre};text-decoration:none">${echapper(r.telephone)}</a>` : '';
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:${C.papier}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${echapper(apercu)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.papier}">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.filet}">
        <tr><td align="center" style="padding:36px 32px 24px">
          <a href="${origine}"><img src="${origine}/brand/logo-email.png" width="200" height="46" alt="Villenière — Boucherie" style="display:block;border:0"></a>
        </td></tr>
        <tr><td style="padding:0 32px"><div style="height:1px;background:${C.or};line-height:1px;font-size:0">&nbsp;</div></td></tr>
        <tr><td style="padding:32px 32px 8px">
          <h1 style="margin:0 0 20px;font:normal 28px/1.25 Georgia,serif;font-style:italic;color:${C.encre}">${echapper(titre)}</h1>
          <div style="font:15px/1.6 Arial,sans-serif;color:${C.gris}">${contenu}</div>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;background:${C.encre}">
          <p style="margin:0 0 6px;font:bold 11px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${C.or}">Boucherie Villenière</p>
          <p style="margin:0;font:14px/1.6 Arial,sans-serif;color:#d9d4cb">
            ${echapper(adresse)}<br>
            ${tel ? `${tel.replace(`color:${C.encre}`, 'color:#ffffff')}<br>` : ''}
            <a href="${plan}" style="color:${C.or}">Voir le plan</a> · <a href="${origine}" style="color:${C.or}">boucherie-villeniere.fr</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
