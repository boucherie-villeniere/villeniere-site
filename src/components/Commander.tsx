import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ALLERGENES_LABELS,
  CLE_PANIER,
  UNITES,
  creneauxPossibles,
  datesDeRetrait,
  formaterDate,
  formaterHeure,
  formaterPrix,
  libelleTotal,
  platDisponible,
  telephoneValide,
  versCommandables,
  type Commande,
  type PlatCommandable,
  type ProduitVente,
  type ReglesRetrait,
} from '../lib/commande';
import ChoixRetrait from './ChoixRetrait';
import Etapes from './Etapes';

interface Props {
  produits: ProduitVente[];
  regles: ReglesRetrait;
  mentionPaiement?: string;
  adresse: string;
}

type Etat =
  | { type: 'saisie' }
  | { type: 'envoi' }
  | { type: 'erreur'; message: string }
  | { type: 'ok'; total: string; date: string; creneau: string; lignes: { nom: string; quantite: number }[] };

const ETAPES = ['Retrait', 'Vos plats', 'Coordonnées'];

export default function Commander({ produits, regles, mentionPaiement, adresse }: Props) {
  // Une ligne commandable par variante (demi petit, demi gros…).
  const plats = useMemo(() => versCommandables(produits), [produits]);
  const variantesDe = (p: ProduitVente) => plats.filter((c) => c.slug === p.slug || c.slug.startsWith(`${p.slug}~`));
  // Les dates sont calculées dans le navigateur : la page est statique et
  // l'heure limite doit être évaluée au moment de la visite.
  const dates = useMemo(() => datesDeRetrait(regles, plats), [regles, plats]);
  const [rubrique, setRubrique] = useState('');
  const [date, setDate] = useState('');
  const [creneau, setCreneau] = useState('');
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [etat, setEtat] = useState<Etat>({ type: 'saisie' });
  const [restaure, setRestaure] = useState(false);
  const [etape, setEtape] = useState(0);
  const racine = useRef<HTMLFormElement>(null);
  const zoneErreur = useRef<HTMLParagraphElement>(null);
  const zoneMerci = useRef<HTMLDivElement>(null);

  const dispo = (c: PlatCommandable) => !date || platDisponible(c, date, undefined, creneau || undefined);
  const platsDuJour = plats.filter(dispo);
  const lignes = platsDuJour.filter((p) => (quantites[p.slug] ?? 0) > 0);
  const produitsDuJour = produits.filter((p) => variantesDe(p).some(dispo));
  const rubriques = [...new Set(produitsDuJour.map((p) => p.rubrique))];
  const rubriqueActive = rubriques.includes(rubrique) ? rubrique : rubriques[0];
  const nbDansRubrique = (r: string) =>
    produitsDuJour.filter((p) => p.rubrique === r).reduce((n, p) => n + variantesDe(p).reduce((m, c) => m + (quantites[c.slug] ?? 0), 0), 0);
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

  function changerEtape(i: number) {
    setEtape(i);
    setEtat({ type: 'saisie' });
    racine.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('site')) return; // champ piège anti-robots
    const telephone = String(f.get('telephone') ?? '');
    // On revient sur l'étape qui pose problème, avec le message à l'écran.
    const probleme = !date
      ? { etape: 0, message: 'Choisissez le jour de retrait.' }
      : !creneau
        ? { etape: 0, message: 'Choisissez un horaire de retrait.' }
        : lignes.length === 0
          ? { etape: 1, message: 'Ajoutez au moins un produit à votre commande.' }
          : etape < 2
            ? null
            : !String(f.get('nom') ?? '').trim()
              ? { etape: 2, message: 'Indiquez votre nom.' }
              : !telephoneValide(telephone)
                ? { etape: 2, message: 'Le numéro de téléphone semble incorrect : indiquez 10 chiffres, par exemple 06 12 34 56 78.' }
                : null;
    if (probleme && probleme.etape <= etape) {
      setEtape(probleme.etape);
      setEtat({ type: 'erreur', message: probleme.message });
      return;
    }
    if (etape < 2) {
      setEtat({ type: 'saisie' });
      changerEtape(etape + 1);
      return;
    }
    const commande: Commande = {
      date,
      creneau,
      lignes: lignes.map((p) => ({ slug: p.slug, quantite: quantites[p.slug] })),
      sms: f.get('sms') === 'oui',
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
    <form className="cc" ref={racine} onSubmit={envoyer} noValidate>
      <Etapes etapes={ETAPES} courante={etape} surChoix={changerEtape} />
      <fieldset className="cc-etape" hidden={etape !== 0}>
        <legend>Quand passez-vous ?</legend>
        <ChoixRetrait
          dates={dates}
          date={date}
          surDate={setDate}
          regles={regles}
          creneau={creneau}
          surCreneau={setCreneau}
          creneauxDe={(iso) => creneauxPossibles(regles, plats, iso)}
        />
      </fieldset>

      <fieldset className="cc-etape" hidden={etape !== 1}>
        <legend>Votre commande</legend>
        {rubriques.length > 1 && (
          <div className="cc-rubriques" role="tablist" aria-label="Rubriques">
            {rubriques.map((r) => {
              const n = nbDansRubrique(r);
              return (
                <button key={r} type="button" role="tab" aria-selected={r === rubriqueActive} className={r === rubriqueActive ? 'actif' : ''} onClick={() => setRubrique(r)}>
                  {r}
                  {n > 0 && <span className="cc-rubrique-n">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        <ul className="cc-plats">
          {produitsDuJour
            .filter((p) => p.rubrique === rubriqueActive)
            .map((p) => {
              const versions = variantesDe(p).filter(dispo);
              const q = versions.reduce((n, c) => n + (quantites[c.slug] ?? 0), 0);
              const quantite = (c: PlatCommandable, libelle: string) => {
                const n = quantites[c.slug] ?? 0;
                return (
                  <div className="cc-quantite">
                    <button type="button" onClick={() => changer(c.slug, -1, c.quantiteMax)} disabled={n === 0} aria-label={`Retirer : ${libelle}`}>
                      −
                    </button>
                    <output aria-live="polite" aria-label={`Quantité : ${libelle}`}>{n}</output>
                    <button type="button" onClick={() => changer(c.slug, 1, c.quantiteMax)} disabled={n >= c.quantiteMax} aria-label={`Ajouter : ${libelle}`}>
                      +
                    </button>
                  </div>
                );
              };
              return (
                <li key={p.slug} className={`${q > 0 ? 'choisi' : ''}${p.variantes.length > 0 ? ' a-variantes' : ''}`}>
                  {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="cc-vignette" aria-hidden="true" />}
                  <div className="cc-plat-texte">
                    <h3>{p.nom}</h3>
                    {p.description && <p>{p.description}</p>}
                    <p className="cc-meta">
                      {p.variantes.length === 0 && (
                        <strong>
                          {formaterPrix(p.prix)} / {UNITES[p.unite]}
                        </strong>
                      )}
                      {p.variantes.length === 0 && p.precision && ' · '}
                      {p.precision}
                    </p>
                    {p.memeJour && (
                      <p className="cc-jour-meme">
                        Aussi le jour même : commandez entre {formaterHeure(p.memeJour.ouverture)} et {formaterHeure(p.memeJour.fin)}
                      </p>
                    )}
                    {p.allergenes.length > 0 && (
                      <p className="cc-allergenes">Allergènes : {p.allergenes.map((a) => ALLERGENES_LABELS[a] ?? a).join(', ')}</p>
                    )}
                  </div>
                  {p.variantes.length === 0 ? (
                    quantite(versions[0], p.nom)
                  ) : (
                    <ul className="cc-variantes">
                      {versions.map((c) => {
                        const v = p.variantes[Number(c.slug.split('~')[1])];
                        return (
                          <li key={c.slug}>
                            <span className="cc-variante-nom">
                              {v.nom} <strong>{formaterPrix(v.prix)}</strong>
                              {p.unite !== 'piece' && <small> / {UNITES[p.unite]}</small>}
                            </span>
                            {quantite(c, `${p.nom}, ${v.nom}`)}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
        </ul>
      </fieldset>

      <fieldset className="cc-etape" hidden={etape !== 2}>
        <legend>Vos coordonnées</legend>
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
          <label className="cc-option cc-large">
            <input type="checkbox" name="sms" value="oui" />
            <span>Me prévenir par SMS quand ma commande est prête</span>
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
        <div className="cc-navigation">
          {etape > 0 && (
            <button type="button" className="cc-retour" onClick={() => changerEtape(etape - 1)}>
              ← Retour
            </button>
          )}
          <button className="bouton bouton--or sur-sombre" type="submit" disabled={etat.type === 'envoi'}>
            {etat.type === 'envoi' ? 'Envoi…' : etape < 2 ? 'Continuer' : 'Valider ma commande'}
          </button>
        </div>
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
