// Commande en ligne de la carte d'un temps fort (ex. menu de Noël).
// Les produits de la carte sont convertis en « plats » commandables, ce qui
// réutilise toute la chaîne du click & collect (validation, e-mails, planning).

import type { PlatCommandable, ReglesRetrait } from './commande';
import { prixCarte, UNITES_CARTE, type ClickCollect, type ProduitCarte, type TempsFort } from './data';

export interface ProduitCommandable extends PlatCommandable {
  /** Texte d'aide : prix au kilo, poids estimé… */
  info: string;
}

export const slugifier = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Identifiant d'une ligne de la carte (et de sa variante, ex. la farce). */
export const idProduit = (p: ProduitCarte, variante?: number) => `${slugifier(p.nom)}${variante != null ? `~${variante}` : ''}`;

const estIntertitre = (p: ProduitCarte) => p.prix == null && !p.detail && !(p.prixVariantes ?? []).some((x) => x != null);

export function produitsCommandables(t: TempsFort): ProduitCommandable[] {
  const liste: ProduitCommandable[] = [];
  for (const r of t.carte?.rubriques ?? []) {
    const colonnes = (r.colonnes ?? []).filter(Boolean);
    for (const p of r.produits ?? []) {
      if (estIntertitre(p) || p.commandable === false) continue;
      const max = p.quantiteMax ?? 10;
      if (colonnes.length > 0) {
        colonnes.forEach((c, i) => {
          const prix = p.prixVariantes?.[i];
          if (prix == null) return;
          liste.push({ slug: idProduit(p, i), nom: `${p.nom} — ${c.toLowerCase()}`, prix, unite: 'piece', jours: [], quantiteMax: max, info: p.detail ?? '' });
        });
        continue;
      }
      if (p.prix == null) continue;
      if ((p.unite ?? 'kg') === 'kg') {
        // Au kilo : prix estimé d'après le poids moyen, ajusté à la pesée.
        const poids = p.poids ?? null;
        liste.push({
          slug: idProduit(p),
          nom: p.nom,
          prix: poids ? Math.round(p.prix * poids * 100) / 100 : 0,
          unite: 'piece',
          jours: [],
          quantiteMax: max,
          aLaPesee: true,
          info: `${prixCarte(p.prix)} ${UNITES_CARTE.kg}${poids ? ` · env. ${String(poids).replace('.', ',')} kg la pièce` : ' · prix à la pesée'}`,
        });
      } else {
        liste.push({ slug: idProduit(p), nom: p.nom, prix: p.prix, unite: 'piece', jours: [], quantiteMax: max, info: p.detail ?? '' });
      }
    }
  }
  return liste;
}

/** Règles de retrait : celles du click & collect, limitées à la fenêtre du temps fort. */
export function reglesEvenement(t: TempsFort, cc: ClickCollect): ReglesRetrait {
  const c = t.carte?.commande;
  return {
    actif: !!(cc.actif && c?.actif),
    joursRetrait: cc.joursRetrait,
    creneaux: cc.creneaux,
    heureLimite: cc.heureLimite,
    joursAvance: cc.joursAvance,
    fermetures: cc.fermetures,
    du: c?.retraitDu ?? null,
    au: c?.retraitAu ?? null,
    limite: c?.dateLimite ?? null,
  };
}
