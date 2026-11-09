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
  /** Nom du temps fort (ex. « Noël ») si la commande vient de sa carte. */
  evenement: string | null;
  arrhesRecues: boolean;
  /** Commande déjà saisie dans le logiciel de caisse. */
  apitic: boolean;
  /** Le client veut être prévenu par SMS. */
  sms: boolean;
  /** Date d'envoi du SMS automatique « commande prête ». */
  smsEnvoyeLe: string | null;
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
  evenement: string | null;
  arrhes_recues: number | null;
  apitic: number | null;
  sms: number | null;
  sms_envoye: string | null;
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
    // Colonne ajoutée après coup (commandes des temps forts) : sans effet si elle existe.
    .then(() => db.prepare('ALTER TABLE commandes ADD COLUMN evenement TEXT').run().catch(() => {}))
    .then(() => db.prepare('ALTER TABLE commandes ADD COLUMN arrhes_recues INTEGER DEFAULT 0').run().catch(() => {}))
    .then(() => db.prepare('ALTER TABLE commandes ADD COLUMN apitic INTEGER DEFAULT 0').run().catch(() => {}))
    .then(() => db.prepare('ALTER TABLE commandes ADD COLUMN sms INTEGER DEFAULT 0').run().catch(() => {}))
    .then(() => db.prepare('ALTER TABLE commandes ADD COLUMN sms_envoye TEXT').run().catch(() => {}))
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
  evenement: l.evenement ?? null,
  arrhesRecues: !!l.arrhes_recues,
  apitic: !!l.apitic,
  sms: !!l.sms,
  smsEnvoyeLe: l.sms_envoye ?? null,
});

export async function enregistrerCommande(
  db: D1Database,
  c: Omit<CommandeEnregistree, 'id' | 'creeLe' | 'statut' | 'arrhesRecues' | 'apitic' | 'sms' | 'smsEnvoyeLe'> & { sms?: boolean },
) {
  await preparer(db);
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO commandes (id, cree_le, date, creneau, nom, telephone, email, remarque, lignes, total, evenement, sms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, new Date().toISOString(), c.date, c.creneau, c.nom, c.telephone, c.email ?? null, c.remarque ?? null, JSON.stringify(c.lignes), c.total, c.evenement ?? null, c.sms ? 1 : 0)
    .run();
  return id;
}

/** Commandes dont la date de retrait est comprise entre `du` et `au` (inclus). */
export async function commandesEntre(db: D1Database, du: string, au: string) {
  await preparer(db);
  const { results } = await db.prepare('SELECT * FROM commandes WHERE date BETWEEN ? AND ? ORDER BY date, cree_le').bind(du, au).all<Ligne>();
  return results.map(versObjet);
}

/** Dernière commande reçue : la tablette de la boutique compare pour sonner à chaque nouvelle. */
export async function derniereCommande(db: D1Database) {
  await preparer(db);
  const l = await db.prepare('SELECT * FROM commandes ORDER BY cree_le DESC LIMIT 1').first<Ligne>();
  return l ? versObjet(l) : null;
}

export async function commandeParId(db: D1Database, id: string) {
  await preparer(db);
  const l = await db.prepare('SELECT * FROM commandes WHERE id = ?').bind(id).first<Ligne>();
  return l ? versObjet(l) : null;
}

export async function marquerSmsEnvoye(db: D1Database, id: string) {
  await preparer(db);
  await db.prepare('UPDATE commandes SET sms_envoye = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
}

export async function changerStatut(db: D1Database, id: string, statut: Statut) {
  if (!(statut in STATUTS)) throw new Error('Statut inconnu');
  await preparer(db);
  await db.prepare('UPDATE commandes SET statut = ? WHERE id = ?').bind(statut, id).run();
}

/** Commandes de temps forts à venir dont les arrhes ne sont pas encore reçues. */
export async function commandesSansArrhes(db: D1Database, depuis: string) {
  await preparer(db);
  const { results } = await db
    .prepare("SELECT * FROM commandes WHERE evenement IS NOT NULL AND COALESCE(arrhes_recues, 0) = 0 AND statut != 'annulee' AND date >= ? ORDER BY date, cree_le")
    .bind(depuis)
    .all<Ligne>();
  return results.map(versObjet);
}

export async function changerSuivi(db: D1Database, id: string, champ: 'arrhes' | 'apitic', valeur: boolean) {
  await preparer(db);
  // Le nom de colonne vient de cette liste fermée, jamais de la requête.
  const colonne = champ === 'arrhes' ? 'arrhes_recues' : 'apitic';
  await db.prepare(`UPDATE commandes SET ${colonne} = ? WHERE id = ?`).bind(valeur ? 1 : 0, id).run();
}

/** Supprime les commandes retirées avant `avant` (engagement des mentions légales). */
export async function purgerCommandes(db: D1Database, avant: string) {
  await preparer(db);
  const { meta } = await db.prepare('DELETE FROM commandes WHERE date < ?').bind(avant).run();
  return meta.changes ?? 0;
}

/** Trie par créneau dans l'ordre défini dans l'admin, puis par heure de commande. */
export function trierParCreneau(commandes: CommandeEnregistree[], creneaux: string[]) {
  const rang = (c: string) => {
    const h = c.match(/(\d{1,2})\s*h\s*(\d{2})?/);
    if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
    const i = creneaux.indexOf(c);
    return 10_000 + (i === -1 ? creneaux.length : i);
  };
  return [...commandes].sort((a, b) => a.date.localeCompare(b.date) || rang(a.creneau) - rang(b.creneau) || a.creeLe.localeCompare(b.creeLe));
}

/** Quantités restant à préparer par plat : une commande prête, retirée ou annulée n'y figure plus. */
export function totauxParPlat(commandes: CommandeEnregistree[]) {
  const totaux = new Map<string, { quantite: number; unite: string }>();
  for (const c of commandes) {
    if (c.statut !== 'a-preparer') continue;
    for (const l of c.lignes) {
      const t = totaux.get(l.nom) ?? { quantite: 0, unite: l.unite };
      t.quantite += l.quantite;
      totaux.set(l.nom, t);
    }
  }
  return [...totaux].map(([nom, t]) => ({ nom, ...t })).sort((a, b) => b.quantite - a.quantite);
}

/** Nombre de volailles restant à farcir, par farce. */
export function totauxParFarce(commandes: CommandeEnregistree[]) {
  const totaux = new Map<string, number>();
  for (const c of commandes) {
    if (c.statut !== 'a-preparer') continue;
    for (const l of c.lignes) if (l.farce) totaux.set(l.farce, (totaux.get(l.farce) ?? 0) + l.quantite);
  }
  return [...totaux].map(([nom, quantite]) => ({ nom, quantite }));
}

/** Nombre de plats à servir avec une sauce, par sauce. */
export function totauxParSauce(commandes: CommandeEnregistree[]) {
  const totaux = new Map<string, number>();
  for (const c of commandes) {
    if (c.statut !== 'a-preparer') continue;
    for (const l of c.lignes) if (l.sauce) totaux.set(l.sauce, (totaux.get(l.sauce) ?? 0) + l.quantite);
  }
  return [...totaux].map(([nom, quantite]) => ({ nom, quantite }));
}
