import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ALLERGENES_LABELS,
  UNITES,
  datesDeRetrait,
  formaterDate,
  formaterPrix,
  libelleTotal,
  platDisponible,
  telephoneValide,
  type Commande,
  type ReglesRetrait,
} from '../lib/commande';
import ChoixRetrait from './ChoixRetrait';
import type { Plat } from '../lib/data';

interface Props {
  plats: Plat[];
  regles: ReglesRetrait;
  mentionPaiement?: string;
  adresse: string;
}

type Etat =
  | { type: 'saisie' }
  | { type: 'envoi' }
  | { type: 'erreur'; message: string }
  | { type: 'ok'; total: string; date: string; creneau: string; lignes: { nom: string; quantite: number }[] };

const CLE_PANIER = 'commande-click-collect';

export default function Commander({ plats, regles, mentionPaiement, adresse }: Props) {
  // Les dates sont calculées dans le navigateur : la page est statique et
  // l'heure limite doit être évaluée au moment de la visite.
  const dates = useMemo(() => datesDeRetrait(regles, plats), [regles, plats]);
  const [date, setDate] = useState('');
  const [creneau, setCreneau] = useState('');
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [etat, setEtat] = useState<Etat>({ type: 'saisie' });
  const [restaure, setRestaure] = useState(false);
  const zoneErreur = useRef<HTMLParagraphElement>(null);
  const zoneMerci = useRef<HTMLDivElement>(null);

  const platsDuJour = plats.filter((p) => !date || platDisponible(p, date));
  const lignes = platsDuJour.filter((p) => (quantites[p.slug] ?? 0) > 0);
  const total = libelleTotal(lignes.map((p) => ({ quantite: quantites[p.slug], total: p.prix * quantites[p.slug] })));
  const auPoids = lignes.some((p) => p.unite === 'kg');

  const changer = (slug: string, delta: number, max: number) =>
    setQuantites((q) => ({ ...q, [slug]: Math.min(max, Math.max(0, (q[slug] ?? 0) + delta)) }));

  // Panier conservé le temps de la visite (rechargement, passage sur une autre page).
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(CLE_PANIER);
      if (brut) setQuantites(JSON.parse(brut));
    } catch {
      /* stockage indisponible : le panier reste simplement en mémoire */
    }
    setRestaure(true);
  }, []);
  useEffect(() => {
    if (!restaure) return;
    try {
      sessionStorage.setItem(CLE_PANIER, JSON.stringify(quantites));
    } catch {
      /* idem */
    }
  }, [quantites, restaure]);

  // Une erreur ou la confirmation arrive toujours à l'écran, avec le focus.
  useEffect(() => {
    const cible = etat.type === 'erreur' ? zoneErreur.current : etat.type === 'ok' ? zoneMerci.current : null;
    if (!cible) return;
    cible.scrollIntoView({ block: 'center', behavior: 'instant' });
    cible.focus({ preventScroll: true });
  }, [etat]);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('site')) return; // champ piège anti-robots
    const telephone = String(f.get('telephone') ?? '');
    const manque = !date
      ? 'Choisissez le jour de retrait, tout en haut du formulaire.'
      : !creneau
      ? 'Choisissez un horaire de retrait, tout en haut du formulaire.'
      : lignes.length === 0
        ? 'Ajoutez au moins un plat à votre commande.'
        : !String(f.get('nom') ?? '').trim()
          ? 'Indiquez votre nom.'
          : !telephoneValide(telephone)
            ? 'Le numéro de téléphone semble incorrect : indiquez 10 chiffres, par exemple 06 12 34 56 78.'
            : '';
    if (manque) {
      setEtat({ type: 'erreur', message: manque });
      return;
    }
    const commande: Commande = {
      date,
      creneau,
      lignes: lignes.map((p) => ({ slug: p.slug, quantite: quantites[p.slug] })),
      nom: String(f.get('nom') ?? ''),
      telephone: String(f.get('telephone') ?? ''),
      email: String(f.get('email') ?? '') || undefined,
      remarque: String(f.get('remarque') ?? '') || undefined,
    };
    setEtat({ type: 'envoi' });
    try {
      const res = await fetch('/api/commande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commande),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erreur ?? 'La commande n’a pas pu être envoyée.');
      setEtat({
        type: 'ok',
        total: data.totalAffiche ?? total,
        date,
        creneau,
        lignes: lignes.map((p) => ({ nom: p.nom, quantite: quantites[p.slug] })),
      });
      setQuantites({});
    } catch (err) {
      setEtat({ type: 'erreur', message: err instanceof Error ? err.message : 'Erreur inattendue.' });
    }
  }

  if (etat.type === 'ok') {
    return (
      <div className="cc-merci cadre" ref={zoneMerci} tabIndex={-1}>
        <div className="cadre-interieur">
          <h2>Merci, c’est noté !</h2>
          <p>
            À retirer le <strong>{formaterDate(etat.date)}</strong>, créneau <strong>{etat.creneau}</strong>
            <br />
            {adresse}
          </p>
          <ul className="cc-merci-lignes">
            {etat.lignes.map((l) => (
              <li key={l.nom}>
                <strong>{l.quantite} ×</strong> {l.nom}
              </li>
            ))}
          </ul>
          <p>
            Montant estimé : <strong>{etat.total}</strong>. {mentionPaiement}
          </p>
          <p>Un empêchement ? Appelez-nous, tout simplement.</p>
        </div>
      </div>
    );
  }

  if (dates.length === 0) {
    return <p className="cc-vide">Aucune date de retrait n’est disponible pour le moment. Appelez-nous, on s’arrange !</p>;
  }

  return (
    <form className="cc" onSubmit={envoyer} noValidate>
      <fieldset className="cc-etape">
        <legend>
          <span className="cc-num">1</span> Quand passez-vous ?
        </legend>
        <ChoixRetrait dates={dates} date={date} surDate={setDate} regles={regles} creneau={creneau} surCreneau={setCreneau} />
      </fieldset>

      <fieldset className="cc-etape">
        <legend>
          <span className="cc-num">2</span> Votre commande
        </legend>
        <ul className="cc-plats">
          {platsDuJour.map((p) => {
            const q = quantites[p.slug] ?? 0;
            return (
              <li key={p.slug} className={q > 0 ? 'choisi' : ''}>
                {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="cc-vignette" aria-hidden="true" />}
                <div className="cc-plat-texte">
                  <h3>{p.nom}</h3>
                  {p.description && <p>{p.description}</p>}
                  <p className="cc-meta">
                    <strong>
                      {formaterPrix(p.prix)} / {UNITES[p.unite]}
                    </strong>
                    {p.precision && <> · {p.precision}</>}
                  </p>
                  {p.allergenes.length > 0 && (
                    <p className="cc-allergenes">Allergènes : {p.allergenes.map((a) => ALLERGENES_LABELS[a] ?? a).join(', ')}</p>
                  )}
                </div>
                <div className="cc-quantite">
                  <button type="button" onClick={() => changer(p.slug, -1, p.quantiteMax)} disabled={q === 0} aria-label={`Retirer un ${p.nom}`}>
                    −
                  </button>
                  <output aria-live="polite" aria-label={`Quantité de ${p.nom}`}>{q}</output>
                  <button type="button" onClick={() => changer(p.slug, 1, p.quantiteMax)} disabled={q >= p.quantiteMax} aria-label={`Ajouter un ${p.nom}`}>
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="cc-etape">
        <legend>
          <span className="cc-num">3</span> Vos coordonnées
        </legend>
        <div className="cc-grille">
          <label className="cc-champ">
            <span>Nom *</span>
            <input name="nom" autoComplete="name" required maxLength={120} />
          </label>
          <label className="cc-champ">
            <span>Téléphone *</span>
            <input name="telephone" type="tel" autoComplete="tel" required inputMode="tel" placeholder="06 12 34 56 78" />
          </label>
          <label className="cc-champ">
            <span>E-mail (pour recevoir un récapitulatif)</span>
            <input name="email" type="email" autoComplete="email" />
          </label>
          <label className="cc-champ cc-large">
            <span>Une précision ?</span>
            <textarea name="remarque" rows={3} maxLength={1000} placeholder="Bien cuit, découpé…" />
          </label>
          <label className="cc-piege" aria-hidden="true">
            Site <input name="site" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </fieldset>

      {etat.type === 'erreur' && (
        <p className="cc-erreur" role="alert" ref={zoneErreur} tabIndex={-1}>
          {etat.message}
        </p>
      )}
      <div className="cc-recap" aria-live="polite">
        <div>
          <p className="cc-total">
            Total estimé : <strong>{total}</strong>
          </p>
          <p className="cc-mention">
            {mentionPaiement}
            {auPoids && ' Les produits au kilo sont ajustés à la pesée.'}
          </p>
        </div>
        <button className="bouton bouton--or sur-sombre" type="submit" disabled={etat.type === 'envoi'}>
          {etat.type === 'envoi' ? 'Envoi…' : 'Valider ma commande'}
        </button>
      </div>
      <p className="cc-rgpd">
        Vos coordonnées servent uniquement à préparer votre commande.{' '}
        <a href="/mentions-legales" target="_blank" rel="noopener">
          En savoir plus
        </a>
      </p>
    </form>
  );
}
