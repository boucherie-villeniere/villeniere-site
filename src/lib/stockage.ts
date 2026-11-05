// Enregistrement des commandes dans Cloudflare D1 (base SQLite, offre gratuite).
// La table est créée au premier usage : pas de migration à lancer à la main.

import type { LigneValidee } from './commande';

export type Statut = 'a-preparer' | 'prete' | 'retiree' | 'annulee';

export const STATUTS: Record<Statut, string> = {
  'a-preparer': 'À préparer',
  prete: 'Prête',
  retiree: 'Retirée',
  annulee: 'Annulée',
};

export interface CommandeEnregistree {
  id: string;
  creeLe: string;
  date: string;
  creneau: string;
  nom: string;
  telephone: string;
  email: string | null;
  remarque: string | null;
  lignes: LigneValidee[];
  total: number;
  statut: Statut;
}

interface Ligne {
  id: string;
  cree_le: string;
  date: string;
  creneau: string;
  nom: string;
  telephone: string;
  email: string | null;
  remarque: string | null;
  lignes: string;
  total: number;
  statut: Statut;
}

let tablePrete: Promise<unknown> | undefined;

function preparer(db: D1Database) {
  tablePrete ??= db
    .batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS commandes (
        id TEXT PRIMARY KEY,
        cree_le TEXT NOT NULL,
        date TEXT NOT NULL,
        creneau TEXT NOT NULL,
        nom TEXT NOT NULL,
        telephone TEXT NOT NULL,
        email TEXT,
        remarque TEXT,
        lignes TEXT NOT NULL,
        total REAL NOT NULL,
        statut TEXT NOT NULL DEFAULT 'a-preparer'
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS commandes_date ON commandes (date)'),
    ])
    .catch((e) => {
      tablePrete = undefined;
      throw e;
    });
  return tablePrete;
}

const versObjet = (l: Ligne): CommandeEnregistree => ({
  id: l.id,
  creeLe: l.cree_le,
  date: l.date,
  creneau: l.creneau,
  nom: l.nom,
  telephone: l.telephone,
  email: l.email,
  remarque: l.remarque,
  lignes: JSON.parse(l.lignes),
  total: l.total,
  statut: l.statut,
});

export async function enregistrerCommande(db: D1Database, c: Omit<CommandeEnregistree, 'id' | 'creeLe' | 'statut'>) {
  await preparer(db);
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO commandes (id, cree_le, date, creneau, nom, telephone, email, remarque, lignes, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, new Date().toISOString(), c.date, c.creneau, c.nom, c.telephone, c.email ?? null, c.remarque ?? null, JSON.stringify(c.lignes), c.total)
    .run();
  return id;
}

/** Commandes dont la date de retrait est comprise entre `du` et `au` (inclus). */
export async function commandesEntre(db: D1Database, du: string, au: string) {
  await preparer(db);
  const { results } = await db.prepare('SELECT * FROM commandes WHERE date BETWEEN ? AND ? ORDER BY date, cree_le').bind(du, au).all<Ligne>();
  return results.map(versObjet);
}

export async function changerStatut(db: D1Database, id: string, statut: Statut) {
  if (!(statut in STATUTS)) throw new Error('Statut inconnu');
  await preparer(db);
  await db.prepare('UPDATE commandes SET statut = ? WHERE id = ?').bind(statut, id).run();
}

/** Trie par créneau dans l'ordre défini dans l'admin, puis par heure de commande. */
export function trierParCreneau(commandes: CommandeEnregistree[], creneaux: string[]) {
  const rang = (c: string) => {
    const i = creneaux.indexOf(c);
    return i === -1 ? creneaux.length : i;
  };
  return [...commandes].sort((a, b) => a.date.localeCompare(b.date) || rang(a.creneau) - rang(b.creneau) || a.creeLe.localeCompare(b.creeLe));
}

/** Quantités totales à préparer par plat (hors commandes annulées). */
export function totauxParPlat(commandes: CommandeEnregistree[]) {
  const totaux = new Map<string, { quantite: number; unite: string }>();
  for (const c of commandes) {
    if (c.statut === 'annulee') continue;
    for (const l of c.lignes) {
      const t = totaux.get(l.nom) ?? { quantite: 0, unite: l.unite };
      t.quantite += l.quantite;
      totaux.set(l.nom, t);
    }
  }
  return [...totaux].map(([nom, t]) => ({ nom, ...t })).sort((a, b) => b.quantite - a.quantite);
}
