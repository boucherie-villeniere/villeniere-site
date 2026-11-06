// Lecture des contenus édités dans Keystatic (fichiers YAML de src/content).
// Passer par import.meta.glob embarque les données dans le build, y compris
// dans la fonction serveur de commande, qui n'a pas accès au disque en ligne.
import { parse } from 'yaml';
import type { Jour } from './commande';

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
  sms?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  horaires: { jour: Jour; plages: string }[];
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
}

export interface ClickCollect {
  actif: boolean;
  messageFerme: string;
  intro?: string;
  emailCommandes: string;
  joursRetrait: Jour[];
  creneaux: string[];
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
}

export const getReglages = () => lire<Reglages>('reglages');
export const getAccueil = () => lire<Accueil>('accueil');
export const getBoucherie = () => lire<Boucherie>('boucherie');
export const getProduits = () => lire<Produits>('produits');
export const getClickCollect = () => {
  const c = lire<ClickCollect>('click-collect');
  return { ...c, creneaux: c.creneaux ?? [], fermetures: (c.fermetures ?? []).filter(Boolean), joursRetrait: c.joursRetrait ?? [] };
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

export interface FarceCarte {
  nom: string;
  /** Prix aux 100 g, modifiable dans l'admin. */
  prix100g?: number | null;
  /** Montant par volaille, calculé (prix aux 100 g × quantité de farce). */
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
  commande?: { actif?: boolean; dateLimite?: string | null; retraitDu?: string | null; retraitAu?: string | null; message?: string };
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

/** Découpe un texte multi-lignes en paragraphes. */
export const paragraphes = (texte?: string) =>
  (texte ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
