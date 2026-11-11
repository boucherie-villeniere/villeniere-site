// Lecture des contenus édités dans Keystatic (fichiers YAML de src/content).
// Passer par import.meta.glob embarque les données dans le build, y compris
// dans la fonction serveur de commande, qui n'a pas accès au disque en ligne.
import { parse } from 'yaml';
import { enMinutes, type Jour, type MemeJour, type ProduitVente } from './commande';

const fichiers = import.meta.glob('/src/content/**/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function lire<T>(chemin: string): T {
  const brut = fichiers[`/src/content/${chemin}.yaml`];
  if (brut === undefined) throw new Error(`Contenu introuvable : ${chemin}`);
  return parse(brut) as T;
}

export type Image = string | null | '';

export interface Reglages {
  annonce?: string;
  adresse: string;
  codePostal: string;
  ville: string;
  telephone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  /** Identifiant de la fiche Google (horaires lus sur Google si la clé d'API est configurée). */
  googlePlaceId?: string;
  horaires: { jour: Jour; plages: string }[];
  /** Pages affichées dans le menu (on peut lancer le site sans certaines). */
  pages?: { laBoucherie?: boolean; nosProduits?: boolean };
  legal: { raisonSociale?: string; siret?: string; responsable?: string; hebergeur?: string };
}

export interface Bloc {
  titre: string;
  texte: string;
  image?: Image;
}

export interface Accueil {
  titre: string;
  sousTitre?: string;
  image?: Image;
  engagements: { titre: string; texte: string }[];
  sections: Bloc[];
}

export interface Boucherie {
  titre: string;
  chapo?: string;
  image?: Image;
  chapitres: Bloc[];
  galerie: Image[];
}

export interface Produits {
  titre: string;
  chapo?: string;
  questionViande: string;
  questionCuisson: string;
  messageFin?: string;
}

export interface Viande {
  slug: string;
  nom: string;
  provenance?: string;
  description?: string;
  image?: Image;
  ordre: number;
}

export interface Cuisson {
  slug: string;
  nom: string;
  description?: string;
  pictogramme: 'flamme' | 'cocotte' | 'four' | 'poele' | 'couteau';
  ordre: number;
}

export interface Morceau {
  slug: string;
  nom: string;
  viande: string;
  cuissons: string[];
  description?: string;
  conseil?: string;
  temps?: string;
  personnes?: string;
  image?: Image;
  surCommande: boolean;
  actif: boolean;
  ordre: number;
  /** Aussi vendu en click & collect, avec la même fiche. */
  vente?: Vente & { actif?: boolean };
}

/** Réglages de vente communs aux plats et aux morceaux. */
export interface Vente {
  prix?: number | null;
  unite?: 'piece' | 'part' | 'barquette' | 'kg';
  precision?: string;
  variantes?: { nom?: string; prix?: number | null }[];
  jours?: Jour[];
  quantiteMax?: number | null;
  memeJour?: { actif?: boolean; ouverture?: string; fin?: string; delai?: number | null };
}

export interface ClickCollect {
  actif: boolean;
  messageFerme: string;
  intro?: string;
  emailCommandes: string;
  joursRetrait: Jour[];
  creneaux: string[];
  creneauxParJour: { jour: Jour; creneaux: string[] }[];
  heureLimite: number;
  joursAvance: number;
  fermetures: string[];
  mentionPaiement?: string;
  emailClientObjet?: string;
  emailClientTitre?: string;
  emailClientIntro?: string;
  emailClientFin?: string;
}

export interface Plat {
  slug: string;
  nom: string;
  actif: boolean;
  description?: string;
  prix: number;
  unite: 'piece' | 'part' | 'barquette' | 'kg';
  precision?: string;
  image?: Image;
  jours: Jour[];
  quantiteMax: number;
  allergenes: string[];
  ordre: number;
  rubrique?: string;
  variantes?: Vente['variantes'];
  memeJour?: Vente['memeJour'];
}

export const getReglages = () => lire<Reglages>('reglages');
/** Pages facultatives : affichées sauf si la case est décochée dans l'admin. */
export const pagesVisibles = (r: Reglages = getReglages()) => ({
  laBoucherie: r.pages?.laBoucherie !== false,
  nosProduits: r.pages?.nosProduits !== false,
});
export const getAccueil = () => lire<Accueil>('accueil');
export const getBoucherie = () => lire<Boucherie>('boucherie');
export const getProduits = () => lire<Produits>('produits');
export const getClickCollect = () => {
  const c = lire<ClickCollect>('click-collect');
  return {
    ...c,
    creneaux: c.creneaux ?? [],
    creneauxParJour: (c.creneauxParJour ?? []).map((e) => ({ jour: e.jour, creneaux: e.creneaux ?? [] })), fermetures: (c.fermetures ?? []).filter(Boolean),
    joursRetrait: c.joursRetrait ?? [],
  };
};

/** Lit tous les fichiers d'une collection Keystatic, triés par ordre puis par nom. */
function collection<T extends { slug: string; nom: string; ordre: number }>(dossier: string): T[] {
  return Object.entries(fichiers)
    .filter(([chemin]) => chemin.startsWith(`/src/content/${dossier}/`))
    .map(([chemin, brut]) => {
      const d = parse(brut) as Omit<T, 'slug'>;
      return { ...d, slug: chemin.slice(`/src/content/${dossier}/`.length, -'.yaml'.length), ordre: d.ordre ?? 10 } as T;
    })
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));
}

export interface TempsFort {
  slug: string;
  nom: string;
  actif: boolean;
  debut?: string | null;
  fin?: string | null;
  affichage: 'les-deux' | 'popup' | 'accueil' | 'page';
  decor: 'flocons' | 'citrouilles' | 'couronne' | 'etoiles' | 'aucun';
  surtitre?: string;
  titre: string;
  accroche?: string;
  image?: string | null;
  texte?: string;
  bouton?: { texte?: string; lien?: string };
  ordre: number;
  carte?: Carte;
}

export interface ProduitCarte {
  nom: string;
  detail?: string;
  prix?: number | null;
  unite?: 'kg' | 'piece' | 'la-piece' | 'pers';
  prixVariantes?: (number | null)[];
  commandable?: boolean;
  /** Ce qu'on demande au client : compteur simple, nombre de personnes ou poids. */
  saisie?: 'piece' | 'personnes' | 'poids';
  personnesMin?: number | null;
  personnesMax?: number | null;
  /** Poids servant à estimer le prix : par personne, ou d'une pièce. */
  poids?: number | null;
  /** Volaille entière : propose le choix de la farce. */
  farce?: boolean;
  /** Accompagnement sans prix propre (ex. sauce), compris avec le plat choisi. */
  accompagnement?: boolean;
  /** Ce plat peut être servi avec l'accompagnement. */
  avecSauce?: boolean;
  allergenes?: string[];
  quantiteMax?: number;
}

/** Prix au kilo d'une farce (accepte l'ancien prix aux 100 g). */
export const prixKgFarce = (f: { prixKg?: number | null; prix100g?: number | null }) =>
  f.prixKg ?? (f.prix100g != null ? Math.round(f.prix100g * 1000) / 100 : null);

export interface FarceCarte {
  nom: string;
  /** Prix au kilo, modifiable dans l'admin. */
  prixKg?: number | null;
  /** Ancien champ (prix aux 100 g), lu seulement si prixKg est vide. */
  prix100g?: number | null;
  /** Montant par volaille, calculé (prix au kilo × quantité de farce). */
  supplement?: number | null;
}

export interface RubriqueCarte {
  titre: string;
  intro?: string;
  encadres?: { illustration: 'melon' | 'roti-allonge' | 'volaille' | 'aucun'; titre?: string; texte?: string }[];
  colonnes?: string[];
  produits?: ProduitCarte[];
  note?: string;
  nouvellePage?: boolean;
}

export interface Carte {
  titre?: string;
  rubriques?: RubriqueCarte[];
  piedDeCarte?: string;
  mentionAllergenes?: string;
  lienQR?: string;
  /** Farces proposées sur les volailles entières. */
  farces?: FarceCarte[];
  /** Quantité de farce par volaille, en grammes. */
  farceGrammes?: number | null;
  commande?: { actif?: boolean; dateLimite?: string | null; retraitDu?: string | null; retraitAu?: string | null; message?: string; mentionArrhes?: string; montantArrhes?: number | null; modalitesArrhes?: string };
}

export { prixCarte, UNITES_CARTE } from './commande';

/** Temps forts activés (les dates sont vérifiées dans le navigateur, voir TempsForts.astro). */
export const getTempsForts = () =>
  collection<TempsFort>('temps-forts')
    .filter((t) => t.actif !== false)
    .map((t) => ({ ...t, affichage: t.affichage ?? 'les-deux', decor: t.decor ?? 'etoiles' }));

/** Lien du bouton d'un temps fort : celui saisi, sinon sa propre page. */
export const lienTempsFort = (t: TempsFort) => t.bouton?.lien?.trim() || `/${t.slug}`;

export const getViandes = () => collection<Viande>('viandes');
export const getCuissons = () => collection<Cuisson>('cuissons');
export const getMorceaux = () =>
  collection<Morceau>('morceaux')
    .filter((m) => m.actif !== false)
    .map((m) => ({ ...m, cuissons: m.cuissons ?? [], surCommande: !!m.surCommande }));

export function getPlats({ tous = false } = {}): Plat[] {
  return Object.entries(fichiers)
    .filter(([chemin]) => chemin.startsWith('/src/content/plats/'))
    .map(([chemin, brut]) => {
      const p = parse(brut) as Omit<Plat, 'slug'>;
      return {
        ...p,
        slug: chemin.replace('/src/content/plats/', '').replace('.yaml', ''),
        jours: p.jours ?? [],
        allergenes: p.allergenes ?? [],
        quantiteMax: p.quantiteMax ?? 6,
        ordre: p.ordre ?? 10,
      };
    })
    .filter((p) => tous || p.actif)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));
}

function memeJourDe(m?: Vente['memeJour']): MemeJour | undefined {
  if (!m?.actif) return undefined;
  const ouverture = enMinutes(m.ouverture);
  const fin = enMinutes(m.fin);
  if (ouverture === null || fin === null || fin <= ouverture) return undefined;
  return { ouverture, fin, delai: Math.max(0, m.delai ?? 60) };
}
const variantesDe = (v?: Vente['variantes']) =>
  (v ?? []).filter((x) => x?.nom?.trim() && typeof x.prix === 'number').map((x) => ({ nom: x.nom!.trim(), prix: x.prix as number }));

/**
 * Tout ce qui se commande en click & collect : les plats, puis les morceaux
 * de la boucherie marqués « commandable », regroupés par viande.
 */
export function getProduitsVente(): ProduitVente[] {
  const plats: ProduitVente[] = getPlats().map((p) => ({
    slug: p.slug,
    nom: p.nom,
    description: p.description,
    prix: p.prix,
    unite: p.unite,
    precision: p.precision,
    image: p.image || null,
    jours: p.jours,
    quantiteMax: p.quantiteMax,
    allergenes: p.allergenes,
    rubrique: p.rubrique?.trim() || 'Rôtisserie & plats',
    variantes: variantesDe(p.variantes),
    memeJour: memeJourDe(p.memeJour),
  }));
  const viandes = getViandes();
  const morceaux: ProduitVente[] = getMorceaux()
    .filter((m) => m.vente?.actif && (typeof m.vente.prix === 'number' || variantesDe(m.vente.variantes).length > 0))
    .sort((a, b) => viandes.findIndex((v) => v.slug === a.viande) - viandes.findIndex((v) => v.slug === b.viande))
    .map((m) => {
      const v = m.vente!;
      return {
        slug: `morceau-${m.slug}`,
        nom: m.nom,
        description: m.description,
        prix: v.prix ?? 0,
        unite: v.unite ?? 'piece',
        precision: v.precision || m.personnes,
        image: m.image || null,
        jours: v.jours ?? [],
        quantiteMax: v.quantiteMax ?? 6,
        allergenes: [],
        rubrique: viandes.find((x) => x.slug === m.viande)?.nom ?? 'Boucherie',
        variantes: variantesDe(v.variantes),
        memeJour: memeJourDe(v.memeJour),
      };
    });
  return [...plats, ...morceaux];
}

/** Découpe un texte multi-lignes en paragraphes. */
export const paragraphes = (texte?: string) =>
  (texte ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
