// TEMPORAIRE : indique seulement si les secrets sont présents (jamais leur valeur).
import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { env } from 'cloudflare:workers';

export const prerender = false;

const CLES = ['KEYSTATIC_GITHUB_CLIENT_ID', 'KEYSTATIC_GITHUB_CLIENT_SECRET', 'KEYSTATIC_SECRET', 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG', 'RESEND_API_KEY'];

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      Object.fromEntries(
        CLES.map((k) => [k, { getSecret: Boolean(getSecret(k)), env: Boolean((env as Record<string, unknown>)[k]), process: Boolean(globalThis.process?.env?.[k]) }]),
      ),
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
