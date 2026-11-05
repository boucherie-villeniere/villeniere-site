// Pictogrammes des cuissons, dessinés au trait comme la frise de la charte.
// Utilisés côté React (expérience) et côté Astro (carte complète).
import type { Cuisson } from '../lib/data';

const TRACES: Record<Cuisson['pictogramme'], string[]> = {
  flamme: [
    'M24 42c-7.5 0-12-5-12-11.5 0-6 4.5-9.5 6.5-15 2 3 3 5 3 8 2.5-2 3.5-6 3-11 6 4 11.5 10.5 11.5 18.5C36 37.5 31.5 42 24 42Z',
    'M24 42c-3 0-5-2.2-5-5 0-3 2.5-4.5 3.5-7 2 2.2 6.5 4.2 6.5 7.5 0 2.6-2 4.5-5 4.5Z',
  ],
  cocotte: [
    'M8 22h32v12a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V22Z',
    'M5 22h38',
    'M14 18c0-3 4.5-5 10-5s10 2 10 5',
    'M21 13c0-1.7 1.3-3 3-3s3 1.3 3 3',
    'M18 8c-1-1.5 1-3 0-4.5M24 7c-1-1.5 1-3 0-4.5M30 8c-1-1.5 1-3 0-4.5',
  ],
  four: [
    'M8 8h32v32H8Z',
    'M8 16h32',
    'M13 12h2M19 12h2',
    'M14 22h20v12H14Z',
    'M18 30c2-3 4-3 6 0s4 3 6 0',
  ],
  poele: [
    'M6 24h26a0 0 0 0 1 0 0c0 6-5 11-13 11S6 30 6 24Z',
    'M32 25.5 44 21',
    'M15 18c-1-1.5 1-3 0-4.5M21 18c-1-1.5 1-3 0-4.5',
  ],
  couteau: ['M6 30 34 10c3 2 3 6 0 9L14 33Z', 'M14 33l-6 6c-1.5 1.5-4-1-2.5-2.5L12 31'],
};

export default function Pictogramme({ nom, taille = 48 }: { nom: Cuisson['pictogramme']; taille?: number }) {
  return (
    <svg
      className="pictogramme"
      width={taille}
      height={taille}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(TRACES[nom] ?? TRACES.flamme).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
