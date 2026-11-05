import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Pictogramme from './Pictogramme';
import type { Cuisson, Morceau, Viande } from '../lib/data';

// « Que voulez-vous cuisiner aujourd'hui ? » : un filtre viande → cuisson
// présenté comme une conversation au comptoir. L'état vit dans l'URL
// (#boeuf/a-griller) pour que le bouton retour et le partage fonctionnent.

interface Props {
  viandes: Viande[];
  cuissons: Cuisson[];
  morceaux: Morceau[];
  questionViande: string;
  questionCuisson: string;
  messageFin?: string;
  telephone?: string;
}

const TOUT = 'tout';

function lireHash(viandes: Viande[], cuissons: Cuisson[]) {
  const [v, c] = decodeURIComponent(window.location.hash.slice(1)).split('/');
  const viande = viandes.some((x) => x.slug === v) ? v : undefined;
  const cuisson = viande && (c === TOUT || cuissons.some((x) => x.slug === c)) ? c : undefined;
  return { viande, cuisson };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export default function Experience({ viandes, cuissons, morceaux, questionViande, questionCuisson, messageFin, telephone }: Props) {
  const [choix, setChoix] = useState<{ viande?: string; cuisson?: string }>({});
  const racine = useRef<HTMLDivElement>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const premierRendu = useRef(true);

  useEffect(() => {
    setChoix(lireHash(viandes, cuissons));
    const surRetour = () => setChoix(lireHash(viandes, cuissons));
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, [viandes, cuissons]);

  // À chaque étape : on ramène le haut de l'expérience à l'écran et on place
  // le focus sur la nouvelle question (lecteurs d'écran, clavier).
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const haut = racine.current?.getBoundingClientRect().top ?? 0;
    if (haut < 0 || haut > window.innerHeight * 0.4) racine.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titre.current?.focus({ preventScroll: true });
  }, [choix.viande, choix.cuisson]);

  function aller(viande?: string, cuisson?: string) {
    const hash = viande ? `#${viande}${cuisson ? `/${cuisson}` : ''}` : ' ';
    history.pushState(null, '', hash === ' ' ? window.location.pathname : hash);
    setChoix({ viande, cuisson });
  }

  const viande = viandes.find((v) => v.slug === choix.viande);
  const cuisson = cuissons.find((c) => c.slug === choix.cuisson);
  const morceauxViande = viande ? morceaux.filter((m) => m.viande === viande.slug) : [];
  const resultats = choix.cuisson === TOUT ? morceauxViande : morceauxViande.filter((m) => cuisson && m.cuissons.includes(cuisson.slug));
  const etape = !viande ? 1 : !choix.cuisson ? 2 : 3;
  const nomCuisson = (slug: string) => cuissons.find((c) => c.slug === slug)?.nom;

  return (
    <div className="xp" ref={racine}>
      <ol className="xp-etapes" aria-label="Progression">
        {['La viande', 'La cuisson', 'Nos conseils'].map((label, i) => (
          <li key={label} className={i + 1 === etape ? 'actuelle' : i + 1 < etape ? 'faite' : ''} aria-current={i + 1 === etape ? 'step' : undefined}>
            {i + 1 < etape ? (
              <button type="button" onClick={() => (i === 0 ? aller() : aller(choix.viande))}>
                {i === 0 ? viande?.nom : i === 1 ? (choix.cuisson === TOUT ? 'Toutes cuissons' : cuisson?.nom) : label}
              </button>
            ) : (
              <span>{label}</span>
            )}
          </li>
        ))}
      </ol>

      <div className="xp-etape" key={`${etape}-${choix.viande}-${choix.cuisson}`}>
        {etape === 1 && (
          <>
            <h2 className="xp-question" ref={titre} tabIndex={-1}>
              {questionViande}
            </h2>
            <ul className="xp-viandes">
              {viandes.map((v, i) => {
                const n = morceaux.filter((m) => m.viande === v.slug).length;
                return (
                  <li key={v.slug} style={{ '--i': i } as CSSProperties}>
                    <button type="button" className="xp-viande" onClick={() => aller(v.slug)} disabled={n === 0}>
                      <span className="xp-viande-visuel">{v.image ? <img src={v.image} alt="" loading="lazy" /> : null}</span>
                      <span className="xp-viande-texte">
                        <span className="xp-viande-nom">{v.nom}</span>
                        {v.provenance && !/compl[ée]ter/i.test(v.provenance) && <span className="xp-viande-prov">{v.provenance}</span>}
                        <span className="xp-viande-n">{pluriel(n, 'morceau')}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {etape === 2 && viande && (
          <>
            <p className="xp-rappel">{viande.nom}, très bon choix.</p>
            <h2 className="xp-question" ref={titre} tabIndex={-1}>
              {questionCuisson}
            </h2>
            <ul className="xp-cuissons">
              {cuissons.map((c, i) => {
                const n = morceauxViande.filter((m) => m.cuissons.includes(c.slug)).length;
                if (n === 0) return null;
                return (
                  <li key={c.slug} style={{ '--i': i } as CSSProperties}>
                    <button type="button" className="xp-cuisson" onClick={() => aller(viande.slug, c.slug)}>
                      <Pictogramme nom={c.pictogramme} taille={56} />
                      <span className="xp-cuisson-nom">{c.nom}</span>
                      {c.description && <span className="xp-cuisson-desc">{c.description}</span>}
                      <span className="xp-cuisson-n">{pluriel(n, 'morceau')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="xp-tout">
              <button type="button" className="lien" onClick={() => aller(viande.slug, TOUT)}>
                Peu importe, montrez-moi tous les morceaux
              </button>
            </p>
          </>
        )}

        {etape === 3 && viande && (
          <>
            <p className="xp-rappel">Nos conseils pour</p>
            <h2 className="xp-question" ref={titre} tabIndex={-1}>
              {choix.cuisson === TOUT ? `${viande.nom}, toutes cuissons` : `${viande.nom} ${cuisson?.nom.toLowerCase()}`}
            </h2>
            <ul className="xp-resultats">
              {resultats.map((m, i) => (
                <li key={m.slug} className="xp-morceau" style={{ '--i': i } as CSSProperties}>
                  {m.image && <img className="xp-morceau-photo" src={m.image} alt={m.nom} loading="lazy" />}
                  <div className="xp-morceau-corps">
                    <div className="xp-morceau-tete">
                      <h3>{m.nom}</h3>
                      {m.surCommande && <span className="xp-badge">Sur commande</span>}
                    </div>
                    {m.description && <p>{m.description}</p>}
                    {m.conseil && (
                      <div className="xp-conseil">
                        <span>Le conseil du boucher</span>
                        <p>{m.conseil}</p>
                      </div>
                    )}
                    <dl className="xp-infos">
                      {m.temps && (
                        <div>
                          <dt>Cuisson</dt>
                          <dd>{m.temps}</dd>
                        </div>
                      )}
                      {m.personnes && (
                        <div>
                          <dt>Pour</dt>
                          <dd>{m.personnes}</dd>
                        </div>
                      )}
                    </dl>
                    {m.cuissons.length > 1 && (
                      <p className="xp-aussi">
                        Aussi {m.cuissons.filter((c) => c !== choix.cuisson).map(nomCuisson).filter(Boolean).join(', ').toLowerCase()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="xp-fin">
              {messageFin && <p>{messageFin}</p>}
              <div className="xp-fin-actions">
                {telephone && (
                  <a className="bouton" href={`tel:${telephone.replace(/\s/g, '')}`}>
                    Appeler la boutique <span className="fleche" aria-hidden="true">→</span>
                  </a>
                )}
                <button type="button" className="bouton bouton--contour" onClick={() => aller(viande.slug)}>
                  Une autre cuisson
                </button>
                <button type="button" className="lien xp-recommencer" onClick={() => aller()}>
                  Recommencer
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
