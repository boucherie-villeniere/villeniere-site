// Côté navigateur : horaires de la fiche Google, demandés une seule fois par page.
// Renvoie null si la fiche n'est pas reliée (le site garde alors les horaires de l'admin).
import type { HorairesGoogle } from './google';

let demande: Promise<HorairesGoogle | null> | undefined;

export function chargerHoraires() {
  demande ??= fetch('/api/horaires')
    .then((r) => (r.status === 200 ? (r.json() as Promise<HorairesGoogle>) : null))
    .catch(() => null);
  return demande;
}

/** Jour de la semaine à Paris, au format des réglages (« lun », « mar »…). */
export function jourParis() {
  const court = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Paris' }).format(new Date());
  return ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'][['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(court)];
}
