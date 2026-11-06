// Règles du click & collect, partagées entre le formulaire (navigateur)
// et l'API (serveur) pour que les deux calculent exactement la même chose.

export type Jour = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim';

export const JOURS_LABELS: Record<Jour, string> = {
  lun: 'Lundi',
  mar: 'Mardi',
  mer: 'Mercredi',
  jeu: 'Jeudi',
  ven: 'Vendredi',
  sam: 'Samedi',
  dim: 'Dimanche',
};

export const ORDRE_JOURS: Jour[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

export const UNITES: Record<string, string> = {
  piece: 'pièce',
  part: 'part',
  barquette: 'barquette',
  kg: 'kg',
};

export const ALLERGENES_LABELS: Record<string, string> = {
  gluten: 'gluten',
  crustaces: 'crustacés',
  oeufs: 'œufs',
  poissons: 'poissons',
  arachides: 'arachides',
  soja: 'soja',
  lait: 'lait',
  'fruits-a-coque': 'fruits à coque',
  celeri: 'céleri',
  moutarde: 'moutarde',
  sesame: 'sésame',
  sulfites: 'sulfites',
  lupin: 'lupin',
  mollusques: 'mollusques',
};

export interface ReglesRetrait {
  actif: boolean;
  joursRetrait: Jour[];
  creneaux: string[];
  heureLimite: number;
  joursAvance: number;
  fermetures: string[];
  /** Fenêtre d'un temps fort (ex. Noël) : retrait entre `du` et `au`, commandes jusqu'à `limite`. */
  du?: string | null;
  au?: string | null;
  limite?: string | null;
}

export interface PlatCommandable {
  slug: string;
  nom: string;
  prix: number;
  unite: string;
  jours: Jour[];
  quantiteMax: number;
  aLaPesee?: boolean;
  sansEstimation?: boolean;
  farce?: string;
}

/** Date (AAAA-MM-JJ) et heure actuelles à Paris, quel que soit le fuseau du serveur. */
export function maintenantParis(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, heure: Number(parts.hour) };
}

export function ajouterJours(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function jourDeSemaine(iso: string): Jour {
  return ORDRE_JOURS[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];
}

export function formaterDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

export const formaterPrix = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/** Numéro français : mêmes règles dans le navigateur et sur le serveur. */
export const telephoneValide = (t: string) => /^(\+33|0)[1-9]\d{8}$/.test(t.replace(/[\s.\-]/g, ''));

export const UNITES_CARTE: Record<string, string> = { kg: '€/kg', piece: '€', 'la-piece': '€ la pièce', pers: '€/pers.' };

/** Prix façon menu : « 95,00 ». */
export const prixCarte = (n: number) => n.toFixed(2).replace('.', ',');

/** Ligne dont le prix n'est connu qu'à la pesée (aucun montant à annoncer). */
export const sansEstimation = (l: { aLaPesee?: boolean; sansEstimation?: boolean; total: number }) =>
  !!l.sansEstimation || (!!l.aLaPesee && l.total === 0);

/** Total affiché : ne dit jamais « 0,00 € » quand des produits restent à peser. */
export function libelleTotal(lignes: { aLaPesee?: boolean; sansEstimation?: boolean; quantite: number; total: number }[]) {
  const total = lignes.reduce((s, l) => s + l.total, 0);
  const n = lignes.filter(sansEstimation).reduce((s, l) => s + l.quantite, 0);
  if (n === 0) return formaterPrix(total);
  const pesee = `${n} produit${n > 1 ? 's' : ''} à la pesée`;
  return total > 0 ? `${formaterPrix(total)} + ${pesee}` : pesee;
}

export const platDisponible = (plat: PlatCommandable, iso: string) =>
  plat.jours.length === 0 || plat.jours.includes(jourDeSemaine(iso));

/**
 * Dates de retrait possibles : à partir du lendemain si l'on commande avant
 * l'heure limite, sinon du surlendemain ; hors jours fermés et fermetures.
 */
export function datesDeRetrait(regles: ReglesRetrait, plats: PlatCommandable[], now = new Date()): string[] {
  if (!regles.actif) return [];
  const { date, heure } = maintenantParis(now);
  if (regles.limite && date > regles.limite) return [];
  const premier = heure < regles.heureLimite ? 1 : 2;
  const ecart = (iso: string) => Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000);
  const debut = regles.du ? Math.max(premier, ecart(regles.du)) : premier;
  const fin = regles.au ? ecart(regles.au) : regles.joursAvance;
  const dates: string[] = [];
  for (let i = debut; i <= fin; i++) {
    const iso = ajouterJours(date, i);
    if (!regles.joursRetrait.includes(jourDeSemaine(iso))) continue;
    if (regles.fermetures.includes(iso)) continue;
    if (!plats.some((p) => platDisponible(p, iso))) continue;
    dates.push(iso);
  }
  return dates;
}

export interface Commande {
  date: string;
  creneau: string;
  lignes: { slug: string; quantite: number }[];
  nom: string;
  telephone: string;
  email?: string;
  remarque?: string;
  /** Slug du temps fort quand on commande sa carte (ex. « noel »). */
  evenement?: string;
}

export interface LigneValidee {
  nom: string;
  quantite: number;
  prix: number;
  unite: string;
  total: number;
  /** Prix estimé (produit au kilo, ajusté à la pesée). */
  aLaPesee?: boolean;
  /** Aucun montant estimé : le prix sera connu à la pesée. */
  sansEstimation?: boolean;
  /** Farce choisie (volaille entière). */
  farce?: string;
}

/** Vérifie une commande reçue ; renvoie les lignes chiffrées ou un message d'erreur. */
export function validerCommande(
  c: Partial<Commande>,
  regles: ReglesRetrait,
  plats: PlatCommandable[],
  now = new Date(),
): { ok: true; lignes: LigneValidee[]; total: number } | { ok: false; erreur: string } {
  if (!regles.actif) return { ok: false, erreur: 'Les commandes en ligne sont suspendues pour le moment.' };
  if (!c.nom?.trim() || c.nom.length > 120) return { ok: false, erreur: 'Merci d’indiquer votre nom.' };
  if (!telephoneValide(c.telephone ?? '')) return { ok: false, erreur: 'Le numéro de téléphone semble incorrect.' };
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return { ok: false, erreur: 'L’adresse e-mail semble incorrecte.' };
  if (!c.date || !datesDeRetrait(regles, plats, now).includes(c.date))
    return { ok: false, erreur: 'Cette date de retrait n’est plus disponible, merci d’en choisir une autre.' };
  if (!c.creneau || !regles.creneaux.includes(c.creneau)) return { ok: false, erreur: 'Merci de choisir un créneau de retrait.' };

  const lignes: LigneValidee[] = [];
  for (const l of c.lignes ?? []) {
    if (!l || !Number.isInteger(l.quantite) || l.quantite <= 0) continue;
    const plat = plats.find((p) => p.slug === l.slug);
    if (!plat || !platDisponible(plat, c.date))
      return { ok: false, erreur: 'Un des plats choisis n’est pas disponible ce jour-là.' };
    if (l.quantite > plat.quantiteMax)
      return { ok: false, erreur: `${plat.nom} : ${plat.quantiteMax} maximum par commande.` };
    lignes.push({
      nom: plat.nom,
      quantite: l.quantite,
      prix: plat.prix,
      unite: plat.unite,
      total: plat.prix * l.quantite,
      ...(plat.aLaPesee ? { aLaPesee: true } : {}),
      ...(plat.sansEstimation ? { sansEstimation: true } : {}),
      ...(plat.farce ? { farce: plat.farce } : {}),
    });
  }
  if (lignes.length === 0) return { ok: false, erreur: 'Votre commande est vide.' };
  if ((c.remarque ?? '').length > 1000) return { ok: false, erreur: 'La remarque est trop longue.' };
  return { ok: true, lignes, total: lignes.reduce((s, l) => s + l.total, 0) };
}
