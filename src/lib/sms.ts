// SMS automatiques via l'API OVHcloud (crédits prépayés, sans abonnement).
// Envoyés seulement aux clients qui ont coché « Me prévenir par SMS », au
// moment où la boutique passe la commande en « Prête ».
//
// Secrets à saisir dans Cloudflare (Runtime variables and secrets) :
//   OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY : jeton créé sur https://eu.api.ovh.com/createToken/
//   OVH_SMS_SERVICE : nom du compte SMS (ex. « sms-ab12345-1 »)
//   OVH_SMS_EXPEDITEUR (facultatif) : expéditeur validé chez OVH (ex. « VILLENIERE »)
// Tant qu'ils manquent, le planning garde le lien « préparer le SMS » à la main.

import { env } from 'cloudflare:workers';

const API = 'https://eu.api.ovh.com/1.0';

export const smsAutomatique = () => !!(env.OVH_APP_KEY && env.OVH_APP_SECRET && env.OVH_CONSUMER_KEY && env.OVH_SMS_SERVICE);

/** 06 12 34 56 78 → +33612345678 */
export function versInternational(tel: string) {
  const t = tel.replace(/[\s.\-]/g, '');
  return t.startsWith('+') ? t : `+33${t.slice(1)}`;
}

/**
 * Remplace les signes hors de l'alphabet SMS standard (apostrophe typographique,
 * tirets longs…) : un seul de ces signes ferait passer le message de 160 à 70
 * caractères par SMS, donc le coût au double.
 */
export const versAlphabetSms = (t: string) =>
  t
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ | /g, ' ');

/** Texte du SMS « commande prête » (court : un seul SMS de 160 caractères). */
export const messagePrete = (nom: string, creneau: string) =>
  versAlphabetSms(`Boucherie Villenière : bonjour ${nom.trim().split(/\s+/)[0]}, votre commande vous attend (retrait ${creneau}). A tout de suite !`);

async function sha1(texte: string) {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Envoie un SMS ; renvoie true si OVH l'a accepté. N'échoue jamais bruyamment. */
export async function envoyerSms(telephone: string, message: string): Promise<boolean> {
  if (!smsAutomatique()) return false;
  try {
    const url = `${API}/sms/${encodeURIComponent(env.OVH_SMS_SERVICE!)}/jobs`;
    const corps = JSON.stringify({
      message,
      receivers: [versInternational(telephone)],
      charset: 'UTF-8',
      priority: 'high',
      // Message de service (pas de publicité) : pas de mention STOP.
      noStopClause: true,
      ...(env.OVH_SMS_EXPEDITEUR ? { sender: env.OVH_SMS_EXPEDITEUR } : { senderForResponse: true }),
    });
    // Heure du serveur OVH : la signature est refusée si les horloges divergent.
    const temps = String(await (await fetch(`${API}/auth/time`)).text()).trim();
    const signature = `$1$${await sha1([env.OVH_APP_SECRET, env.OVH_CONSUMER_KEY, 'POST', url, corps, temps].join('+'))}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ovh-Application': env.OVH_APP_KEY!,
        'X-Ovh-Consumer': env.OVH_CONSUMER_KEY!,
        'X-Ovh-Timestamp': temps,
        'X-Ovh-Signature': signature,
      },
      body: corps,
    });
    if (!res.ok) console.error('[sms] refusé par OVH', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('[sms] échec', e);
    return false;
  }
}
