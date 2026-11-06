// Commande en ligne de la carte d'un temps fort (ex. menu de Noël).
// Les produits de la carte sont convertis en « plats » commandables, ce qui
// réutilise toute la chaîne du click & collect (validation, e-mails, planning).
// Ce fichier est aussi chargé dans le navigateur : pas d'import de valeurs depuis data.ts.

import { formaterPrix, prixCarte, UNITES_CARTE, type PlatCommandable, type ReglesRetrait } from './commande';
import type { Carte, ClickCollect, FarceCarte, ProduitCarte, TempsFort } from './data';

export interface ProduitCommandable extends PlatCommandable {
  /** Texte d'aide : prix au kilo, précision… */
  info: string;
  saisie: 'piece' | 'personnes' | 'poids';
  prixKg?: number;
  poids?: number | null;
  personnesMin?: number;
  personnesMax?: number;
  avecFarce?: boolean;
  accompagnement?: boolean;
  avecSauce?: boolean;
}

export const slugifier = (s: string) =>
  s
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Identifiant d'une ligne de la carte (et de sa variante, ex. la farce d'un rôti). */
export const idProduit = (p: ProduitCarte, variante?: number) => `${slugifier(p.nom)}${variante != null ? `~${variante}` : ''}`;

const estIntertitre = (p: ProduitCarte) => p.prix == null && !p.detail && !(p.prixVariantes ?? []).some((x) => x != null);
const arrondi = (n: number) => Math.round(n * 100) / 100;
export const POIDS_MIN = 0.1;
export const POIDS_MAX = 30;

export function produitsCommandables(t: TempsFort): ProduitCommandable[] {
  const liste: ProduitCommandable[] = [];
  for (const r of t.carte?.rubriques ?? []) {
    const colonnes = (r.colonnes ?? []).filter(Boolean);
    for (const p of r.produits ?? []) {
      if (estIntertitre(p) || p.commandable === false) continue;
      const commun = { jours: [], quantiteMax: p.quantiteMax ?? 10, unite: 'piece', avecSauce: !!p.avecSauce };
      if (p.accompagnement) {
        liste.push({ ...commun, slug: idProduit(p), nom: p.nom, prix: 0, quantiteMax: 1, saisie: 'piece', info: p.detail ?? '', accompagnement: true, avecSauce: false });
        continue;
      }
      if (colonnes.length > 0) {
        colonnes.forEach((c, i) => {
          const prix = p.prixVariantes?.[i];
          if (prix == null) return;
          liste.push({ ...commun, slug: idProduit(p, i), nom: `${p.nom} — ${c.toLowerCase()}`, prix, saisie: 'piece', info: p.detail ?? '' });
        });
        continue;
      }
      if (p.prix == null) continue;
      if ((p.unite ?? 'kg') !== 'kg') {
        liste.push({ ...commun, slug: idProduit(p), nom: p.nom, prix: p.prix, saisie: 'piece', info: p.detail ?? '', avecFarce: !!p.farce });
        continue;
      }
      // Au kilo : on demande un poids ou un nombre de personnes selon le réglage du produit.
      const saisie = p.saisie === 'personnes' && p.personnesMin && p.personnesMax ? 'personnes' : p.saisie === 'piece' ? 'piece' : 'poids';
      liste.push({
        ...commun,
        slug: idProduit(p),
        nom: p.nom,
        prix: saisie === 'piece' && p.poids ? arrondi(p.prix * p.poids) : 0,
        aLaPesee: true,
        sansEstimation: saisie === 'piece' && !p.poids,
        saisie,
        prixKg: p.prix,
        poids: p.poids,
        personnesMin: p.personnesMin ?? undefined,
        personnesMax: p.personnesMax ?? undefined,
        avecFarce: !!p.farce,
        info: `${prixCarte(p.prix)} ${UNITES_CARTE.kg}${p.detail ? ` · ${p.detail}` : ''}`,
      });
    }
  }
  return liste;
}

export interface OptionsLigne {
  personnes?: number;
  poids?: number;
  farce?: number;
  sauce?: 0 | 1;
}

/** Une ligne du panier s'écrit « produit|p5|f1 » : le serveur recalcule tout à partir de cet identifiant. */
export function slugAvecOptions(slug: string, o: OptionsLigne) {
  return [slug, o.personnes != null && `p${o.personnes}`, o.poids != null && `k${o.poids}`, o.farce != null && `f${o.farce}`, o.sauce != null && `s${o.sauce}`].filter(Boolean).join('|');
}

/** Farces de la carte avec leur montant par volaille (prix aux 100 g × quantité de farce). */
export function farcesAvecPrix(carte?: Carte): FarceCarte[] {
  const grammes = carte?.farceGrammes ?? 500;
  return (carte?.farces ?? []).map((f) => ({ ...f, supplement: f.prix100g ? arrondi((f.prix100g * grammes) / 100) : null }));
}

export const libelleFarce = (f: FarceCarte) =>
  f.supplement && f.prix100g ? `${f.nom} · ${prixCarte(f.prix100g)} €/100 g, soit ≈ ${formaterPrix(f.supplement)}` : f.nom;

/** Reconstruit une ligne (nom, prix) depuis son identifiant ; null si les choix ne sont pas valables. */
export function ligneDepuisSlug(produits: ProduitCommandable[], farces: FarceCarte[], slug: string): ProduitCommandable | null {
  const [base, ...morceaux] = slug.split('|');
  const p = produits.find((x) => x.slug === base);
  if (!p) return null;
  const o: OptionsLigne = {};
  for (const m of morceaux) {
    const n = Number(m.slice(1));
    if (!Number.isFinite(n)) return null;
    if (m[0] === 'p') o.personnes = n;
    else if (m[0] === 'k') o.poids = n;
    else if (m[0] === 'f') o.farce = n;
    else if (m[0] === 's' && (n === 0 || n === 1)) o.sauce = n;
    else return null;
  }

  const precisions: string[] = [];
  let prix = p.prix;
  let sansPrix = !!p.sansEstimation;

  if (p.saisie === 'personnes') {
    if (!Number.isInteger(o.personnes) || o.personnes! < p.personnesMin! || o.personnes! > p.personnesMax!) return null;
    precisions.push(`${o.personnes} pers.`);
    sansPrix = !p.poids;
    prix = p.poids ? arrondi(p.prixKg! * p.poids * o.personnes!) : 0;
  } else if (o.personnes != null) return null;

  if (p.saisie === 'poids') {
    if (o.poids == null || o.poids < POIDS_MIN || o.poids > POIDS_MAX) return null;
    precisions.push(`${String(o.poids).replace('.', ',')} kg`);
    prix = arrondi(p.prixKg! * o.poids);
  } else if (o.poids != null) return null;

  let farce: string | undefined;
  if (o.farce != null) {
    const f = p.avecFarce ? farces[o.farce] : undefined;
    if (!f) return null;
    farce = f.nom;
    precisions.push(`farce ${f.nom.toLowerCase()}`);
    prix = arrondi(prix + (f.supplement ?? 0));
  }

  let sauce: string | undefined;
  if (o.sauce != null) {
    const accompagnement = produits.find((x) => x.accompagnement);
    if (!p.avecSauce || !accompagnement) return null;
    precisions.push(`${o.sauce ? 'avec' : 'sans'} ${accompagnement.nom.toLowerCase()}`);
    if (o.sauce) sauce = accompagnement.nom;
  }

  return { ...p, slug, nom: [p.nom, ...precisions].join(' — '), prix, sansEstimation: sansPrix, ...(farce ? { farce } : {}), ...(sauce ? { sauce } : {}) };
}

/** Une ligne doit-elle passer par la fenêtre de choix avant d'entrer dans le panier ? */
export const demandeUnChoix = (p: ProduitCommandable) => p.saisie !== 'piece' || !!p.avecFarce;

/** Plats validables pour une commande : uniquement les lignes dont les choix sont corrects. */
export function platsDeLaCommande(t: TempsFort, lignes: { slug: string }[]) {
  const produits = produitsCommandables(t);
  return lignes
    .map((l) => ligneDepuisSlug(produits, farcesAvecPrix(t.carte), String(l?.slug ?? '')))
    // La sauce accompagne un plat : elle ne se commande pas seule.
    .filter((x): x is ProduitCommandable => !!x && !x.accompagnement);
}

/** Règles de retrait : celles du click & collect, limitées à la fenêtre du temps fort. */
export function reglesEvenement(t: TempsFort, cc: ClickCollect): ReglesRetrait {
  const c = t.carte?.commande;
  return {
    actif: !!(cc.actif && c?.actif),
    joursRetrait: cc.joursRetrait,
    creneaux: cc.creneaux,
    creneauxParJour: cc.creneauxParJour,
    heureLimite: cc.heureLimite,
    joursAvance: cc.joursAvance,
    fermetures: cc.fermetures,
    du: c?.retraitDu ?? null,
    au: c?.retraitAu ?? null,
    limite: c?.dateLimite ?? null,
  };
}
