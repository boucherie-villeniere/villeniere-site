// Accès à la page /commandes : un mot de passe (secret Cloudflare
// COMMANDES_MOT_DE_PASSE), puis un cookie signé valable 30 jours.
// Changer le mot de passe déconnecte tous les appareils.

export const COOKIE = 'vl_gestion';
export const DUREE_JOURS = 30;

const encodeur = new TextEncoder();

async function signer(motDePasse: string, message: string) {
  const cle = await crypto.subtle.importKey('raw', encodeur.encode(`villeniere|${motDePasse}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cle, encodeur.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison en temps constant (évite de deviner la signature caractère par caractère). */
function egal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function creerJeton(motDePasse: string) {
  const expire = Date.now() + DUREE_JOURS * 86_400_000;
  return `${expire}.${await signer(motDePasse, `commandes|${expire}`)}`;
}

export async function jetonValide(motDePasse: string | undefined, jeton: string | undefined) {
  if (!motDePasse || !jeton) return false;
  const [expire, sig] = jeton.split('.');
  if (!expire || !sig || Number(expire) < Date.now()) return false;
  return egal(sig, await signer(motDePasse, `commandes|${expire}`));
}

export async function motDePasseCorrect(attendu: string | undefined, saisi: string) {
  if (!attendu) return false;
  // On compare des empreintes de même longueur pour ne rien révéler de la longueur.
  const [a, b] = await Promise.all([signer(attendu, 'verif'), signer(saisi, 'verif')]);
  return egal(a, b);
}
