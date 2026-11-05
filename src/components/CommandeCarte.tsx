import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { datesDeRetrait, formaterDate, formaterPrix, type Commande, type ReglesRetrait } from '../lib/commande';
import type { ProduitCommandable } from '../lib/evenement';

// Commande directe depuis la carte d'un temps fort (ex. menu de Noël).
// Les boutons « + » sont dans la carte (CarteMenu, attribut data-ajouter) ;
// ce composant tient le panier, la barre du bas et le formulaire final.

interface Props {
  evenement: string;
  nom: string;
  produits: ProduitCommandable[];
  regles: ReglesRetrait;
  mentionPaiement?: string;
}

type Etat = { type: 'saisie' } | { type: 'envoi' } | { type: 'erreur'; message: string } | { type: 'ok'; total: number; date: string; creneau: string };

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function CommandeCarte({ evenement, nom, produits, regles, mentionPaiement }: Props) {
  const dates = useMemo(() => datesDeRetrait(regles, produits), [regles, produits]);
  const ouverte = dates.length > 0;
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [date, setDate] = useState(dates[0] ?? '');
  const [creneau, setCreneau] = useState('');
  const [etat, setEtat] = useState<Etat>({ type: 'saisie' });
  const fenetre = useRef<HTMLDialogElement>(null);
  const [pulse, setPulse] = useState(0);

  const parId = useMemo(() => new Map(produits.map((p) => [p.slug, p])), [produits]);
  const lignes = Object.entries(panier)
    .filter(([id, q]) => q > 0 && parId.has(id))
    .map(([id, q]) => ({ p: parId.get(id)!, q }));
  const nbArticles = lignes.reduce((s, l) => s + l.q, 0);
  const total = lignes.reduce((s, l) => s + l.p.prix * l.q, 0);
  const aLaPesee = lignes.some((l) => l.p.aLaPesee);

  const changer = (id: string, delta: number) => {
    const p = parId.get(id);
    if (!p) return;
    setPanier((x) => ({ ...x, [id]: Math.min(p.quantiteMax, Math.max(0, (x[id] ?? 0) + delta)) }));
  };

  // Active les boutons « + » de la carte et écoute leurs clics.
  useEffect(() => {
    if (!ouverte) return;
    document.querySelectorAll('.carte-menu').forEach((c) => c.setAttribute('data-commande-ouverte', ''));
    document.querySelectorAll<HTMLElement>('[data-commande-aide]').forEach((el) => (el.hidden = false));
    const clic = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ajouter]');
      if (!b) return;
      changer(b.dataset.ajouter!, 1);
      setPulse((n) => n + 1);
    };
    document.addEventListener('click', clic);
    return () => document.removeEventListener('click', clic);
  }, [ouverte]);

  // Affiche la quantité choisie sur chaque bouton de la carte.
  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>('[data-ajouter]').forEach((b) => {
      const q = panier[b.dataset.ajouter!] ?? 0;
      if (q > 0) b.dataset.quantite = String(q);
      else delete b.dataset.quantite;
    });
  }, [panier]);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('site')) return; // champ piège anti-robots
    const commande: Commande = {
      evenement,
      date,
      creneau,
      lignes: lignes.map((l) => ({ slug: l.p.slug, quantite: l.q })),
      nom: String(f.get('nom') ?? ''),
      telephone: String(f.get('telephone') ?? ''),
      email: String(f.get('email') ?? '') || undefined,
      remarque: String(f.get('remarque') ?? '') || undefined,
    };
    setEtat({ type: 'envoi' });
    try {
      const res = await fetch('/api/commande', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(commande) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erreur ?? 'La commande n’a pas pu être envoyée.');
      setEtat({ type: 'ok', total: data.total, date, creneau });
      setPanier({});
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
            {pluriel(nbArticles, 'article')} · {aLaPesee ? '≈ ' : ''}
            {formaterPrix(total)}
          </span>
        </div>
        <button
          type="button"
          className="bouton bouton--or"
          tabIndex={nbArticles === 0 ? -1 : 0}
          onClick={() => {
            setEtat((x) => (x.type === 'ok' ? { type: 'saisie' } : x));
            fenetre.current?.showModal();
          }}
        >
          Finaliser <span className="fleche" aria-hidden="true">→</span>
        </button>
      </div>

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
                Votre commande sera prête le <strong>{formaterDate(etat.date)}</strong>, créneau <strong>{etat.creneau}</strong>.
              </p>
              <p>
                Montant estimé : <strong>{formaterPrix(etat.total)}</strong>. {mentionPaiement}
              </p>
              <p>Un empêchement ? Appelez-nous, tout simplement.</p>
            </div>
          ) : (
            <form className="cc" onSubmit={envoyer}>
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
                      <p className="cdc-prix">{p.aLaPesee && p.prix === 0 ? 'à la pesée' : `${p.aLaPesee ? '≈ ' : ''}${formaterPrix(p.prix * q)}`}</p>
                    </li>
                  ))}
                </ul>
              )}

              <fieldset className="cc-etape">
                <legend>Retrait en boutique</legend>
                <label className="cc-champ">
                  <span>Jour</span>
                  <select value={date} onChange={(e) => setDate(e.target.value)} required>
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {formaterDate(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="cc-creneaux" role="radiogroup" aria-label="Créneau de retrait">
                  {regles.creneaux.map((c) => (
                    <label key={c} className={`cc-creneau${creneau === c ? ' actif' : ''}`}>
                      <input type="radio" name="creneau" value={c} checked={creneau === c} onChange={() => setCreneau(c)} required />
                      {c}
                    </label>
                  ))}
                </div>
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
                    <textarea name="remarque" rows={3} maxLength={1000} placeholder="Farce choisie pour la volaille, poids souhaité, découpe…" />
                  </label>
                  <label className="cc-piege" aria-hidden="true">
                    Site <input name="site" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
              </fieldset>

              <div className="cdc-total">
                <p>
                  Total estimé : <strong>{formaterPrix(total)}</strong>
                </p>
                <p className="cc-mention">
                  {mentionPaiement}
                  {aLaPesee && ' Les produits au kilo sont estimés puis ajustés à la pesée.'}
                </p>
                <button className="bouton" type="submit" disabled={lignes.length === 0 || !creneau || etat.type === 'envoi'}>
                  {etat.type === 'envoi' ? 'Envoi…' : 'Valider ma commande'}
                </button>
              </div>
              {etat.type === 'erreur' && (
                <p className="cc-erreur" role="alert">
                  {etat.message}
                </p>
              )}
              <p className="cc-rgpd">
                Vos coordonnées servent uniquement à préparer votre commande. <a href="/mentions-legales">En savoir plus</a>
              </p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
