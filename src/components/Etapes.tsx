// Fil d'étapes des formulaires de commande : les étapes déjà faites restent cliquables.
interface Props {
  etapes: string[];
  courante: number;
  surChoix: (i: number) => void;
}

export default function Etapes({ etapes, courante, surChoix }: Props) {
  return (
    <ol className="ce" aria-label="Étapes de la commande">
      {etapes.map((e, i) => (
        <li key={e} className={i === courante ? 'actuelle' : i < courante ? 'faite' : ''} aria-current={i === courante ? 'step' : undefined}>
          <button type="button" disabled={i >= courante} onClick={() => surChoix(i)}>
            <span className="ce-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="ce-nom">{e}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
