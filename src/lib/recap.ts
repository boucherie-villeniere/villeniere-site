// E-mail récapitulatif envoyé chaque matin à la boucherie (voir src/worker.ts).

import { formaterDate, jourDeSemaine, libelleTotal, UNITES } from './commande';
import { bouton, echapper, gabarit } from './emails';
import type { ClickCollect, Reglages } from './data';
import { totauxParFarce, totauxParPlat, totauxParSauce, trierParCreneau, type CommandeEnregistree } from './stockage';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export const uniteAffichee = (unite: string, n: number) => {
  const u = UNITES[unite] ?? '';
  return n > 1 && u && unite !== 'kg' ? `${u}s` : u;
};

export function recapDuJour({
  date,
  commandes,
  cc,
  r,
  origine,
}: {
  date: string;
  commandes: CommandeEnregistree[];
  cc: ClickCollect;
  r: Reglages;
  origine: string;
}) {
  const actives = trierParCreneau(
    commandes.filter((c) => c.statut !== 'annulee'),
    cc.creneaux,
  );
  const jour = formaterDate(date);
  const lienGestion = `${origine}/commandes?jour=${date}`;

  if (actives.length === 0) {
    return {
      sujet: `Aujourd’hui ${jour} : aucune commande en ligne`,
      html: gabarit({
        origine,
        r,
        titre: 'Pas de commande aujourd’hui',
        apercu: `Aucune commande click & collect pour ${jour}.`,
        contenu: `<p style="margin:0 0 20px">Aucune commande click &amp; collect n’est prévue pour <strong>${echapper(jour)}</strong>.</p>${bouton(lienGestion, 'Voir le planning')}`,
      }),
    };
  }

  const totaux = totauxParPlat(actives);
  const blocTotaux = `
    <p style="margin:0 0 8px;font:bold 11px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#8a6a32">À préparer</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 28px;background:#faf7f1">
      ${totaux
        .map(
          (t) => `<tr><td style="padding:10px 16px;border-bottom:1px solid #ffffff;font:15px/1.4 Arial,sans-serif;color:#15181B">${echapper(t.nom)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #ffffff;font:bold 18px/1.2 Georgia,serif;color:#15181B;text-align:right;white-space:nowrap">${t.quantite}<span style="font:13px Arial,sans-serif;color:#4E4B48"> ${echapper(uniteAffichee(t.unite, t.quantite))}</span></td></tr>`,
        )
        .join('')}
    </table>`;

  const farces = totauxParFarce(actives);
  const sauces = totauxParSauce(actives);
  const blocFarces =
    farces.length || sauces.length
      ? `<p style="margin:-16px 0 28px;font:14px/1.5 Arial,sans-serif;color:#4E4B48">${[
          farces.length ? `<strong>Farces :</strong> ${farces.map((f) => `${f.quantite} × ${echapper(f.nom)}`).join(', ')}` : '',
          ...sauces.map((f) => `<strong>${echapper(f.nom)} :</strong> ${f.quantite} plat${f.quantite > 1 ? 's' : ''}`),
        ]
          .filter(Boolean)
          .join('<br>')}</p>`
      : '';

  const parCreneau = new Map<string, CommandeEnregistree[]>();
  for (const c of actives) parCreneau.set(c.creneau, [...(parCreneau.get(c.creneau) ?? []), c]);

  const blocCreneaux = [...parCreneau]
    .map(
      ([creneau, liste]) => `
      <p style="margin:0 0 8px;font:normal 20px/1.3 Georgia,serif;font-style:italic;color:#15181B;border-bottom:1px solid #C2A063;padding-bottom:6px">${echapper(creneau)}</p>
      ${liste
        .map(
          (c) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
          <tr><td style="padding:4px 0;font:bold 15px/1.4 Arial,sans-serif;color:#15181B">${echapper(c.nom)}
            <span style="font-weight:normal;color:#4E4B48"> · <a href="tel:${echapper(c.telephone.replace(/\s/g, ''))}" style="color:#4E4B48">${echapper(c.telephone)}</a></span></td>
            <td style="padding:4px 0;font:15px/1.4 Arial,sans-serif;color:#15181B;text-align:right;white-space:nowrap">${echapper(libelleTotal(c.lignes))}</td></tr>
          <tr><td colspan="2" style="padding:0;font:14px/1.5 Arial,sans-serif;color:#4E4B48">${c.lignes.map((l) => `${l.quantite} × ${echapper(l.nom)}`).join('<br>')}
            ${c.remarque ? `<br><em style="color:#8a6a32">« ${echapper(c.remarque)} »</em>` : ''}</td></tr>
        </table>`,
        )
        .join('')}`,
    )
    .join('');

  const n = actives.length;
  return {
    sujet: `Aujourd’hui ${jour} : ${pluriel(n, 'commande')} à préparer`,
    html: gabarit({
      origine,
      r,
      titre: `${pluriel(n, 'commande')} aujourd’hui`,
      apercu: totaux.map((t) => `${t.quantite} ${t.nom}`).join(', '),
      contenu: `<p style="margin:0 0 24px">Voici les commandes click &amp; collect à retirer <strong>${echapper(jour)}</strong>.</p>${blocTotaux}${blocFarces}${blocCreneaux}${bouton(lienGestion, 'Ouvrir le planning')}`,
    }),
  };
}

/** Le récap n'a de sens que les jours où l'on peut retirer une commande. */
export const jourDeRetrait = (date: string, cc: ClickCollect) =>
  cc.joursRetrait.includes(jourDeSemaine(date)) && !cc.fermetures.includes(date);
