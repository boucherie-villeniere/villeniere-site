import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { datesDeRetrait, formaterDate, formaterPrix, libelleTotal, prixLigne, telephoneValide, type Commande, type ReglesRetrait } from '../lib/commande';
import { demandeUnChoix, libelleFarce, ligneDepuisSlug, POIDS_MAX, POIDS_MIN, slugAvecOptions, type OptionsLigne, type ProduitCommandable } from '../lib/evenement';
import ChoixRetrait from './ChoixRetrait';
import type { FarceCarte } from '../lib/data';

// Commande directe depuis la carte d'un temps fort (ex. menu de Noël).
// Les boutons « + » sont dans la carte (CarteMenu, attribut data-ajouter) ;
// ce composant tient le panier, la barre du bas et les fenêtres de choix et de commande.

interface Props {
  evenement: string;
  nom: string;
  produits: ProduitCommandable[];
  farces: FarceCarte[];
  regles: ReglesRetrait;
  mentionPaiement?: string;
  adresse: string;
}

interface LigneResumee {
  nom: string;
  quantite: number;
}

type Etat =
  | { type: 'saisie' }
  | { type: 'envoi' }
  | { type: 'erreur'; message: string }
  | { type: 'ok'; total: string; date: string; creneau: string; lignes: LigneResumee[]; pesee: boolean };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const prixDeBase = (slug: string) => slug.split('|')[0];
const SANS_FARCE = -1;

export default function CommandeCarte({ evenement, nom, produits, farces, regles, mentionPaiement, adresse }: Props) {
  const dates = useMemo(() => datesDeRetrait(regles, produits), [regles, produits]);
  const ouverte = dates.length > 0;
  const cle = `commande-carte-${evenement}`;
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [restaure, setRestaure] = useState(false);
  const [date, setDate] = useState('');
  const [creneau, setCreneau] = useState('');
  const [etat, setEtat] = useState<Etat>({ type: 'saisie' });
  const [enChoix, setEnChoix] = useState<ProduitCommandable | null>(null);
  const [personnes, setPersonnes] = useState(0);
  const [poids, setPoids] = useState('1');
  const [farce, setFarce] = useState(SANS_FARCE);
  const [pulse, setPulse] = useState(0);
  const [sansSauce, setSansSauce] = useState<Record<string, boolean>>({});
  const fenetre = useRef<HTMLDialogElement>(null);
  const fenetreChoix = useRef<HTMLDialogElement>(null);
  const zoneErreur = useRef<HTMLParagraphElement>(null);

  const parId = useMemo(() => new Map(produits.map((p) => [p.slug, p])), [produits]);
  const lignes = Object.entries(panier)
    .filter(([, q]) => q > 0)
    .map(([slug, q]) => ({ p: ligneDepuisSlug(produits, farces, slug), q }))
    .filter((l): l is { p: ProduitCommandable; q: number } => !!l.p);
  const sauce = produits.find((p) => p.accompagnement);
  const sauceChoisie = !!sauce && (panier[sauce.slug] ?? 0) > 0;
  const plats = lignes.filter((l) => !l.p.accompagnement);
  const lignesTotal = plats.map((l) => ({ ...l.p, quantite: l.q, total: l.p.prix * l.q }));
  const nbArticles = lignes.reduce((s, l) => s + l.q, 0);
  const total = plats.length > 0 ? libelleTotal(lignesTotal) : 'ajoutez un plat';
  const aLaPesee = lignes.some((l) => l.p.aLaPesee);

  const changer = (slug: string, delta: number) => {
    const p = ligneDepuisSlug(produits, farces, slug);
    if (!p) return;
    setPanier((x) => ({ ...x, [slug]: Math.min(p.quantiteMax, Math.max(0, (x[slug] ?? 0) + delta)) }));
    setPulse((n) => n + 1);
  };

  // Panier conservé le temps de la visite (rechargement, passage sur une autre page).
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(cle);
      if (brut) setPanier(JSON.parse(brut));
    } catch {
      /* stockage indisponible : le panier reste simplement en mémoire */
    }
    setRestaure(true);
  }, [cle]);
  useEffect(() => {
    if (!restaure) return;
    try {
      sessionStorage.setItem(cle, JSON.stringify(panier));
    } catch {
      /* idem */
    }
  }, [panier, restaure, cle]);

  // Active les boutons de la carte et écoute leurs clics.
  useEffect(() => {
    if (!ouverte) {
      if (regles.actif) document.querySelectorAll<HTMLElement>('[data-commande-fermee]').forEach((el) => (el.hidden = false));
      return;
    }
    document.querySelectorAll('.carte-menu').forEach((c) => c.setAttribute('data-commande-ouverte', ''));
    document.querySelectorAll<HTMLElement>('[data-commande-aide]').forEach((el) => (el.hidden = false));
    const clic = (e: MouseEvent) => {
      const cible = e.target as HTMLElement;
      const plus = cible.closest<HTMLElement>('[data-ajouter]');
      const moins = cible.closest<HTMLElement>('[data-retirer]');
      if (plus) ajouter(plus.dataset.ajouter!);
      else if (moins) retirer(moins.dataset.retirer!);
    };
    document.addEventListener('click', clic);
    return () => document.removeEventListener('click', clic);
  }, [ouverte]);

  function ajouter(id: string) {
    const p = parId.get(id);
    if (!p) return;
    if (!demandeUnChoix(p)) return changer(id, 1);
    setEnChoix(p);
    setPersonnes(p.personnesMin ?? 0);
    setPoids('1');
    setFarce(SANS_FARCE);
    fenetreChoix.current?.showModal();
  }

  // Le − de la carte retire de la dernière ligne ajoutée pour ce produit.
  function retirer(id: string) {
    setPanier((x) => {
      const cles = Object.keys(x).filter((k) => prixDeBase(k) === id && x[k] > 0);
      const derniere = cles[cles.length - 1];
      return derniere ? { ...x, [derniere]: x[derniere] - 1 } : x;
    });
    setPulse((n) => n + 1);
  }

  // Quantité par produit, affichée sur les boutons de la carte.
  useEffect(() => {
    const parBase: Record<string, number> = {};
    for (const [k, q] of Object.entries(panier)) parBase[prixDeBase(k)] = (parBase[prixDeBase(k)] ?? 0) + q;
    document.querySelectorAll<HTMLElement>('[data-ajouter], [data-retirer]').forEach((b) => {
      const q = parBase[(b.dataset.ajouter ?? b.dataset.retirer)!] ?? 0;
      if (q > 0) b.dataset.quantite = String(q);
      else delete b.dataset.quantite;
    });
  }, [panier]);

  const optionsChoix = (): OptionsLigne | null => {
    if (!enChoix) return null;
    const o: OptionsLigne = {};
    if (enChoix.saisie === 'personnes') o.personnes = personnes;
    if (enChoix.saisie === 'poids') {
      const k = Number(poids.replace(',', '.'));
      if (!Number.isFinite(k) || k < POIDS_MIN || k > POIDS_MAX) return null;
      o.poids = Math.round(k * 100) / 100;
    }
    if (farce !== SANS_FARCE) o.farce = farce;
    return o;
  };
  const optionsActuelles = optionsChoix();
  const apercuChoix = enChoix && optionsActuelles ? ligneDepuisSlug(produits, farces, slugAvecOptions(enChoix.slug, optionsActuelles)) : null;

  function validerChoix(e: FormEvent) {
    e.preventDefault();
    if (!enChoix || !optionsActuelles) return;
    changer(slugAvecOptions(enChoix.slug, optionsActuelles), 1);
    fenetreChoix.current?.close();
  }

  // Une erreur apparaît toujours à l'écran et reçoit le focus.
  useEffect(() => {
    if (etat.type !== 'erreur') return;
    zoneErreur.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    zoneErreur.current?.focus({ preventScroll: true });
  }, [etat]);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('site')) return; // champ piège anti-robots
    const telephone = String(f.get('telephone') ?? '');
    const manque = plats.length === 0
      ? sauceChoisie
        ? `Ajoutez un plat : la ${sauce!.nom.toLowerCase()} l’accompagne et ne se commande pas seule.`
        : 'Ajoutez au moins un produit depuis la carte.'
      : !date
        ? 'Choisissez le jour de retrait.'
        : !creneau
          ? 'Choisissez un horaire de retrait.'
          : !telephoneValide(telephone)
            ? 'Le numéro de téléphone semble incorrect : indiquez 10 chiffres, par exemple 06 12 34 56 78.'
            : '';
    if (manque) {
      setEtat({ type: 'erreur', message: manque });
      return;
    }
    // La sauce ne part pas seule : elle est précisée sur chaque plat concerné.
    const envoyees = plats.map((l) => ({
      slug: sauceChoisie && l.p.avecSauce ? `${l.p.slug}|s${sansSauce[l.p.slug] ? 0 : 1}` : l.p.slug,
      q: l.q,
    }));
    const commande: Commande = {
      evenement,
      date,
      creneau,
      lignes: envoyees.map((l) => ({ slug: l.slug, quantite: l.q })),
      nom: String(f.get('nom') ?? ''),
      telephone,
      email: String(f.get('email') ?? '') || undefined,
      remarque: String(f.get('remarque') ?? '') || undefined,
    };
    setEtat({ type: 'envoi' });
    try {
      const res = await fetch('/api/commande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(commande) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erreur ?? 'La commande n’a pas pu être envoyée.');
      setEtat({
        type: 'ok',
        total: data.totalAffiche ?? total,
        date,
        creneau,
        pesee: aLaPesee,
        lignes: envoyees.map((l) => ({ nom: ligneDepuisSlug(produits, farces, l.slug)?.nom ?? '', quantite: l.q })),
      });
      setPanier({});
      setSansSauce({});
      fenetre.current?.scrollTo({ top: 0 });
    } catch (err) {
      setEtat({ type: 'erreur', message: err instanceof Error ? err.message : 'Erreur inattendue.' });
    }
  }

  if (!ouverte) return null;

  return (
    <>
      <div className={`cdc-barre${nbArticles > 0 ? ' visible' : ''}`} aria-hidden={nbArticles === 0}>
        <div className="cdc-barre-texte" key={pulse}>
          <strong>Ma commande {nom}</strong>
          <span>
            {pluriel(nbArticles, 'article')} · {aLaPesee && total.includes('€') ? '≈ ' : ''}
            {total}
          </span>
        </div>
        <button
          type="button"
          className="bouton bouton--or"
          tabIndex={nbArticles === 0 ? -1 : 0}
          onClick={() => {
            setEtat((x) => (x.type === 'ok' || x.type === 'erreur' ? { type: 'saisie' } : x));
            fenetre.current?.showModal();
          }}
        >
          Finaliser <span className="fleche" aria-hidden="true">→</span>
        </button>
      </div>

      <dialog className="cdc-fenetre" ref={fenetreChoix} aria-label={enChoix ? `Ajouter : ${enChoix.nom}` : 'Ajouter un produit'} onClick={(e) => e.target === fenetreChoix.current && fenetreChoix.current?.close()}>
        <div className="cdc-contenu">
          <form method="dialog">
            <button className="cdc-fermer" aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>
          {enChoix && (
            <form onSubmit={validerChoix}>
              <p className="surtitre">{nom}</p>
              <h2>{enChoix.nom}</h2>
              <p className="cdc-info">{enChoix.info}</p>

              {enChoix.saisie === 'personnes' && (
                <fieldset className="cdc-choix-groupe">
                  <legend>Pour combien de personnes ?</legend>
                  <div className="cdc-options">
                    {Array.from({ length: enChoix.personnesMax! - enChoix.personnesMin! + 1 }, (_, i) => enChoix.personnesMin! + i).map((n) => (
                      <label key={n} className={`cc-creneau${personnes === n ? ' actif' : ''}`}>
                        <input type="radio" name="personnes" checked={personnes === n} onChange={() => setPersonnes(n)} />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {enChoix.saisie === 'poids' && (
                <fieldset className="cdc-choix-groupe">
                  <legend>Quel poids souhaitez-vous ?</legend>
                  <label className="cdc-poids">
                    <input type="number" inputMode="decimal" min={POIDS_MIN} max={POIDS_MAX} step="0.1" value={poids} onChange={(e) => setPoids(e.target.value)} required aria-label="Poids en kilos" />
                    kg
                  </label>
                </fieldset>
              )}

              {enChoix.avecFarce && farces.length > 0 && (
                <fieldset className="cdc-choix-groupe">
                  <legend>Avec une farce maison ?</legend>
                  <div className="cdc-options cdc-options--colonne">
                    <label className={`cc-creneau${farce === SANS_FARCE ? ' actif' : ''}`}>
                      <input type="radio" name="farce" checked={farce === SANS_FARCE} onChange={() => setFarce(SANS_FARCE)} />
                      Sans farce
                    </label>
                    {farces.map((f, i) => (
                      <label key={f.nom} className={`cc-creneau${farce === i ? ' actif' : ''}`}>
                        <input type="radio" name="farce" checked={farce === i} onChange={() => setFarce(i)} />
                        {libelleFarce(f)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {apercuChoix && (
                <p className="cdc-estimation">
                  {apercuChoix.sansEstimation ? (
                    apercuChoix.prix > 0 ? (
                      <>
                        Farce : <strong>≈ {formaterPrix(apercuChoix.prix)}</strong>. La volaille sera calculée à la pesée, au retrait.
                      </>
                    ) : (
                      'Le prix sera calculé à la pesée, au retrait.'
                    )
                  ) : (
                    <>
                      Estimation : <strong>≈ {formaterPrix(apercuChoix.prix)}</strong>, ajustée à la pesée.
                    </>
                  )}
                </p>
              )}
              <button className="bouton" type="submit" disabled={!optionsActuelles}>
                Ajouter à ma commande
              </button>
            </form>
          )}
        </div>
      </dialog>

      <dialog className="cdc-fenetre" ref={fenetre} aria-label={`Ma commande ${nom}`} onClick={(e) => e.target === fenetre.current && fenetre.current?.close()}>
        <div className="cdc-contenu">
          <form method="dialog" className="cdc-fermer-form">
            <button className="cdc-fermer" aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </form>

          {etat.type === 'ok' ? (
            <div className="cdc-merci">
              <p className="surtitre">{nom}</p>
              <h2>Merci, c’est noté !</h2>
              <p>
                À retirer le <strong>{formaterDate(etat.date)}</strong>, créneau <strong>{etat.creneau}</strong>
                <br />
                {adresse}
              </p>
              <ul>
                {etat.lignes.map((l) => (
                  <li key={l.nom}>
                    <strong>{l.quantite} ×</strong> {l.nom}
                  </li>
                ))}
              </ul>
              <p>
                Montant estimé : <strong>{etat.total}</strong>
                {etat.pesee && !etat.total.includes('à la pesée') && ', ajusté à la pesée'}. {mentionPaiement}
              </p>
              <p>Un empêchement ? Appelez-nous, tout simplement.</p>
            </div>
          ) : (
            <form className="cc" onSubmit={envoyer} noValidate>
              <p className="surtitre">{nom}</p>
              <h2>Ma commande</h2>

              {lignes.length === 0 ? (
                <p className="cdc-vide">Votre commande est vide : ajoutez des produits depuis la carte avec le bouton +.</p>
              ) : (
                <ul className="cdc-lignes">
                  {lignes.map(({ p, q }) => (
                    <li key={p.slug}>
                      <div>
                        <p className="cdc-nom">{p.nom}</p>
                        {p.info && <p className="cdc-info">{p.info}</p>}
                        {sauceChoisie && p.avecSauce && (
                          <label className="cdc-sauce">
                            <input type="checkbox" checked={!sansSauce[p.slug]} onChange={(e) => setSansSauce((x) => ({ ...x, [p.slug]: !e.target.checked }))} />
                            Avec {sauce!.nom.toLowerCase()}
                          </label>
                        )}
                      </div>
                      <div className="cc-quantite">
                        <button type="button" onClick={() => changer(p.slug, -1)} aria-label={`Retirer un ${p.nom}`}>
                          −
                        </button>
                        <output aria-live="polite">{q}</output>
                        <button type="button" onClick={() => changer(p.slug, 1)} disabled={q >= p.quantiteMax} aria-label={`Ajouter un ${p.nom}`}>
                          +
                        </button>
                      </div>
                      <p className="cdc-prix">{p.accompagnement ? 'comprise' : prixLigne({ ...p, total: p.prix * q })}</p>
                    </li>
                  ))}
                </ul>
              )}

              <fieldset className="cc-etape">
                <legend>Retrait en boutique</legend>
                <ChoixRetrait dates={dates} date={date} surDate={setDate} creneaux={regles.creneaux} creneau={creneau} surCreneau={setCreneau} />
              </fieldset>

              <fieldset className="cc-etape">
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
                  <label className="cc-champ cc-large">
                    <span>E-mail (pour recevoir un récapitulatif)</span>
                    <input name="email" type="email" autoComplete="email" />
                  </label>
                  <label className="cc-champ cc-large">
                    <span>Une précision ?</span>
                    <textarea name="remarque" rows={3} maxLength={1000} placeholder="Découpe, ficelage…" />
                  </label>
                  <label className="cc-piege" aria-hidden="true">
                    Site <input name="site" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
              </fieldset>

              <div className="cdc-total">
                <p>
                  Total estimé : <strong>{total}</strong>
                </p>
                <p className="cc-mention">
                  {mentionPaiement}
                  {aLaPesee && ' Les produits au kilo sont ajustés à la pesée.'}
                </p>
                {etat.type === 'erreur' && (
                  <p className="cc-erreur" role="alert" ref={zoneErreur} tabIndex={-1}>
                    {etat.message}
                  </p>
                )}
                <button className="bouton" type="submit" disabled={etat.type === 'envoi'}>
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
          )}
        </div>
      </dialog>
    </>
  );
}
