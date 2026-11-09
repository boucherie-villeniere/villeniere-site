// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://www.boucherie-villeniere.fr',
  // Pages statiques par défaut ; seules l'API de commande et l'admin Keystatic tournent côté serveur.
  output: 'static',
  adapter: cloudflare(),
  integrations: [react(), keystatic()],
  trailingSlash: 'never',
  // Ancienne adresse de la page conseils.
  redirects: { '/nos-produits': '/nos-viandes' },
  // commander.html plutôt que commander/index.html : Cloudflare sert alors
  // /commander directement, sans redirection vers /commander/.
  build: { format: 'file' },
  vite: {
    // Pré-optimise React dès le démarrage : évite qu'un ré-optimisation à chaud
    // casse le formulaire de commande en développement (« _jsxDEV is not a function »).
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
  },
});
