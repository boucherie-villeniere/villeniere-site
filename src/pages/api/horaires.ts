import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getReglages } from '../../lib/data';
import { horairesGoogle } from '../../lib/google';

export const prerender = false;

// Horaires de la fiche Google, lus par les pages du site (statiques) au chargement.
export const GET: APIRoute = async () => {
  const placeId = getReglages().googlePlaceId?.trim();
  const cle = env.GOOGLE_MAPS_CLE;
  if (!placeId || !cle) return new Response(null, { status: 204 });
  try {
    const h = await horairesGoogle(placeId, cle);
    if (!h || Object.keys(h.jours).length === 0) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(h), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' },
    });
  } catch (e) {
    console.error('[horaires]', e);
    return new Response(null, { status: 204 });
  }
};
