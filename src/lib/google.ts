// Horaires lus sur la fiche Google de la boutique (Google Business Profile),
// via l'API Places (New). La bouchère met à jour ses horaires et ses fermetures
// exceptionnelles sur Google uniquement, le site suit.
//
// Réglages : identifiant de la fiche (« Place ID ») dans l'admin, et clé d'API
// dans le secret Cloudflare GOOGLE_MAPS_CLE. Sans eux, le site garde les horaires
// saisis dans l'admin.
//
// Coût : le champ horaires relève de « Place Details Enterprise », dont les
// 1 000 premières lectures du mois sont offertes. On ne lit Google qu'une fois
// toutes les 6 heures (cache), soit environ 120 lectures par mois.

import { ORDRE_JOURS, type Jour } from './commande';

export interface HorairesGoogle {
  /** Texte des horaires des 7 prochains jours, par jour de la semaine. */
  jours: Partial<Record<Jour, string>>;
  /** Jours de la semaine à venir dont les horaires sont exceptionnels. */
  exceptions: Jour[];
  ouvertMaintenant: boolean | null;
}

const DUREE_CACHE = 6 * 3600;

/** « 09:00–13:00, 15:30–19:30 » → « 9h – 13h / 15h30 – 19h30 » */
export function formaterPlages(t: string) {
  if (/ferm/i.test(t)) return 'Fermé';
  if (/24/.test(t) && /heures/i.test(t)) return 'Ouvert 24 h/24';
  return t
    .replace(/(\d{1,2}):(\d{2})/g, (_, h: string, m: string) => `${Number(h)}h${m === '00' ? '' : m}`)
    .replace(/\s*[–—-]\s*/g, ' – ')
    .replace(/\s*,\s*/g, ' / ');
}

type ReponsePlaces = {
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
    specialDays?: { date?: { year: number; month: number; day: number } }[];
  };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

export function lireReponse(d: ReponsePlaces): HorairesGoogle {
  const descriptions = d.currentOpeningHours?.weekdayDescriptions ?? d.regularOpeningHours?.weekdayDescriptions ?? [];
  const jours: HorairesGoogle['jours'] = {};
  // Google donne les jours du lundi au dimanche : « lundi: 09:00–19:00 ».
  descriptions.slice(0, 7).forEach((ligne, i) => {
    const plages = ligne.slice(ligne.indexOf(':') + 1).trim();
    if (plages) jours[ORDRE_JOURS[i]] = formaterPlages(plages);
  });
  const exceptions = (d.currentOpeningHours?.specialDays ?? [])
    .map((s) => s.date)
    .filter((x): x is { year: number; month: number; day: number } => !!x)
    .map((x) => ORDRE_JOURS[(new Date(Date.UTC(x.year, x.month - 1, x.day)).getUTCDay() + 6) % 7]);
  return { jours, exceptions, ouvertMaintenant: d.currentOpeningHours?.openNow ?? null };
}

export async function horairesGoogle(placeId: string, cle: string): Promise<HorairesGoogle | null> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const cleCache = new Request(`https://cache.villeniere/horaires/${encodeURIComponent(placeId)}`);
  const enCache = await cache?.match(cleCache);
  if (enCache) return enCache.json();

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr`, {
    headers: { 'X-Goog-Api-Key': cle, 'X-Goog-FieldMask': 'currentOpeningHours,regularOpeningHours' },
  });
  if (!res.ok) {
    console.error('[google] horaires indisponibles', res.status, await res.text());
    return null;
  }
  const horaires = lireReponse(await res.json());
  await cache?.put(cleCache, new Response(JSON.stringify(horaires), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${DUREE_CACHE}` } }));
  return horaires;
}
