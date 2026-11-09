import { useMemo } from 'react';
import { ajouterJours, creneauxDuJour, formaterDate, jourDeSemaine, ORDRE_JOURS, type ReglesRetrait } from '../lib/commande';

// Choix du retrait façon planning : un calendrier de jours, puis les horaires
// du jour choisi. Les jours sont de vrais boutons radio : clavier et lecteurs d'écran OK.

interface Props {
  dates: string[];
  date: string;
  surDate: (d: string) => void;
  regles: Pick<ReglesRetrait, 'creneaux' | 'creneauxParJour'>;
  creneau: string;
  surCreneau: (c: string) => void;
  /** Horaires proposés pour une date (le jour même, seulement ceux qui laissent le temps de préparer). */
  creneauxDe?: (iso: string) => string[];
}

const format = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** Du lundi de la première date au dimanche de la dernière. */
function semaines(dates: string[]) {
  if (dates.length === 0) return [];
  const debut = ajouterJours(dates[0], -ORDRE_JOURS.indexOf(jourDeSemaine(dates[0])));
  const derniere = dates[dates.length - 1];
  const liste: string[][] = [];
  for (let lundi = debut; lundi <= derniere; lundi = ajouterJours(lundi, 7)) {
    liste.push(Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i)));
  }
  return liste;
}

export default function ChoixRetrait({ dates, date, surDate, regles, creneau, surCreneau, creneauxDe = (iso) => creneauxDuJour(regles, iso) }: Props) {
  const grille = useMemo(() => semaines(dates), [dates]);
  const possibles = useMemo(() => new Set(dates), [dates]);
  const mois = [...new Set(grille.flat().filter((d) => possibles.has(d)).map((d) => format(d, { month: 'long', year: 'numeric' })))].join(' – ');

  function choisirJour(d: string) {
    surDate(d);
    // L'horaire déjà choisi n'existe pas forcément ce jour-là.
    if (!creneauxDe(d).includes(creneau)) surCreneau('');
  }

  return (
    <div className="cr">
      <p className="cr-mois">{mois}</p>
      <div className="cr-jours" role="radiogroup" aria-label="Jour de retrait">
        {grille.flat().map((d) => {
          const libre = possibles.has(d);
          return (
            <label key={d} className={`cr-jour${date === d ? ' actif' : ''}${libre ? '' : ' ferme'}`}>
              <input type="radio" name="jour" value={d} checked={date === d} disabled={!libre} onChange={() => choisirJour(d)} aria-label={formaterDate(d)} />
              <span className="cr-jour-nom">{format(d, { weekday: 'short' }).replace('.', '')}</span>
              <span className="cr-jour-num">{format(d, { day: 'numeric' })}</span>
            </label>
          );
        })}
      </div>

      {date ? (
        <div className="cr-horaires">
          <p className="cr-horaires-titre">Horaires disponibles le {formaterDate(date)}</p>
          <div className="cc-creneaux" role="radiogroup" aria-label="Créneau de retrait">
            {creneauxDe(date).map((c) => (
              <label key={c} className={`cc-creneau${creneau === c ? ' actif' : ''}`}>
                <input type="radio" name="creneau" value={c} checked={creneau === c} onChange={() => surCreneau(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="cr-aide">Choisissez un jour pour voir les horaires disponibles.</p>
      )}
    </div>
  );
}
