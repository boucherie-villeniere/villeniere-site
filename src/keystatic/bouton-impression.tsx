// Champ « bouton » pour l'admin Keystatic : rien n'est enregistré, il affiche
// seulement un lien vers le menu imprimable du temps fort en cours d'édition.
import type { BasicFormField } from '@keystatic/core';

function slugDeLAdresse() {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/\/item\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function boutonImpression(): BasicFormField<null> {
  return {
    kind: 'form',
    label: 'Menu à imprimer',
    Input() {
      const slug = slugDeLAdresse();
      return (
        <div style={{ border: '1px solid #c2a063', borderRadius: 8, padding: '18px 20px', background: '#faf7f1', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#15181b' }}>Menu à imprimer (PDF)</p>
          <p style={{ margin: '0 0 14px', color: '#4e4b48', fontSize: 14, lineHeight: 1.5 }}>
            Mise en page A5 automatique de la carte ci-dessus, avec le cadre, les dessins et un QR code vers la page de commande.
            Pensez à enregistrer vos modifications (« Save ») et à attendre la mise à jour du site (1 à 2 minutes) avant d’imprimer.
          </p>
          {slug ? (
            <a
              href={`/commandes/menu/${slug}`}
              target="_blank"
              rel="noopener"
              style={{
                display: 'inline-block',
                padding: '10px 18px',
                borderRadius: 999,
                background: '#15181b',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              Ouvrir le menu à imprimer ↗
            </a>
          ) : (
            <p style={{ margin: 0, color: '#4e4b48', fontSize: 14 }}>Disponible une fois ce temps fort enregistré.</p>
          )}
        </div>
      );
    },
    defaultValue: () => null,
    parse: () => null,
    serialize: () => ({ value: undefined }),
    validate: (v) => v,
    reader: { parse: () => null },
  };
}
