import { config, fields, collection, singleton } from '@keystatic/core';
import { boutonImpression } from './src/keystatic/bouton-impression';

// En local : édition directe des fichiers. En ligne : passer en mode GitHub
// en renseignant PUBLIC_KEYSTATIC_GITHUB_REPO (ex. "eulst/villeniere-site").
const githubRepo = import.meta.env.PUBLIC_KEYSTATIC_GITHUB_REPO as `${string}/${string}` | undefined;

const JOURS = [
  { label: 'Lundi', value: 'lun' },
  { label: 'Mardi', value: 'mar' },
  { label: 'Mercredi', value: 'mer' },
  { label: 'Jeudi', value: 'jeu' },
  { label: 'Vendredi', value: 'ven' },
  { label: 'Samedi', value: 'sam' },
  { label: 'Dimanche', value: 'dim' },
] as const;

// Les 14 allergènes à déclaration obligatoire (règlement INCO).
const ALLERGENES = [
  { label: 'Gluten', value: 'gluten' },
  { label: 'Crustacés', value: 'crustaces' },
  { label: 'Œufs', value: 'oeufs' },
  { label: 'Poissons', value: 'poissons' },
  { label: 'Arachides', value: 'arachides' },
  { label: 'Soja', value: 'soja' },
  { label: 'Lait', value: 'lait' },
  { label: 'Fruits à coque', value: 'fruits-a-coque' },
  { label: 'Céleri', value: 'celeri' },
  { label: 'Moutarde', value: 'moutarde' },
  { label: 'Sésame', value: 'sesame' },
  { label: 'Sulfites', value: 'sulfites' },
  { label: 'Lupin', value: 'lupin' },
  { label: 'Mollusques', value: 'mollusques' },
] as const;

const paragraphe = (label: string, description?: string) =>
  fields.text({ label, multiline: true, description: description ?? 'Laissez une ligne vide entre deux paragraphes.' });

const image = (label: string, dossier: string) =>
  fields.image({ label, directory: `public/images/${dossier}`, publicPath: `/images/${dossier}/` });

export default config({
  storage: githubRepo ? { kind: 'github', repo: githubRepo } : { kind: 'local' },
  ui: {
    brand: { name: 'Villenière' },
    navigation: {
      'Click & collect': ['plats', 'clickCollect'],
      'Temps forts': ['tempsForts'],
      'Nos produits': ['produits', 'viandes', 'cuissons', 'morceaux'],
      'Pages du site': ['accueil', 'boucherie'],
      'Infos pratiques': ['reglages'],
    },
  },
  singletons: {
    reglages: singleton({
      label: 'Horaires, adresse & contact',
      path: 'src/content/reglages',
      schema: {
        annonce: fields.text({
          label: 'Bandeau d’annonce',
          description: 'Message qui défile en haut de toutes les pages (fermeture, nouveauté…). Laissez vide pour le masquer. Emoji acceptés : touche Windows + point (;) sur PC, Ctrl + Cmd + Espace sur Mac, ou copier-coller.',
        }),
        adresse: fields.text({ label: 'Adresse', validation: { isRequired: true } }),
        codePostal: fields.text({ label: 'Code postal', validation: { isRequired: true } }),
        ville: fields.text({ label: 'Ville', validation: { isRequired: true } }),
        telephone: fields.text({ label: 'Téléphone' }),
        sms: fields.text({ label: 'Portable (SMS)' }),
        email: fields.text({ label: 'E-mail de contact' }),
        instagram: fields.url({ label: 'Lien Instagram' }),
        facebook: fields.url({ label: 'Lien Facebook' }),
        horaires: fields.array(
          fields.object({
            jour: fields.select({ label: 'Jour', options: JOURS, defaultValue: 'lun' }),
            plages: fields.text({ label: 'Horaires', description: 'Ex. « 8h30 – 13h / 15h30 – 19h30 » ou « Fermé »' }),
          }),
          { label: 'Horaires d’ouverture', itemLabel: (p) => `${p.fields.jour.value} : ${p.fields.plages.value}` },
        ),
        legal: fields.object(
          {
            raisonSociale: fields.text({ label: 'Raison sociale' }),
            siret: fields.text({ label: 'SIRET' }),
            responsable: fields.text({ label: 'Responsable de la publication' }),
            hebergeur: fields.text({ label: 'Hébergeur', defaultValue: 'Cloudflare, Inc. — 101 Townsend Street, San Francisco, CA 94107, USA' }),
          },
          { label: 'Mentions légales' },
        ),
      },
    }),

    accueil: singleton({
      label: 'Page d’accueil',
      path: 'src/content/accueil',
      schema: {
        titre: fields.text({ label: 'Grand titre', validation: { isRequired: true } }),
        sousTitre: fields.text({ label: 'Phrase d’accroche', multiline: true }),
        image: image('Photo principale', 'accueil'),
        engagements: fields.array(
          fields.object({
            titre: fields.text({ label: 'Titre' }),
            texte: fields.text({ label: 'Texte', multiline: true }),
          }),
          { label: 'Nos engagements (3 idéalement)', itemLabel: (p) => p.fields.titre.value },
        ),
        sections: fields.array(
          fields.object({
            titre: fields.text({ label: 'Titre' }),
            texte: paragraphe('Texte'),
            image: image('Photo', 'accueil'),
          }),
          { label: 'Blocs texte + photo', itemLabel: (p) => p.fields.titre.value },
        ),
      },
    }),

    boucherie: singleton({
      label: 'Page « La boucherie »',
      path: 'src/content/boucherie',
      schema: {
        titre: fields.text({ label: 'Titre', validation: { isRequired: true } }),
        chapo: fields.text({ label: 'Introduction', multiline: true }),
        image: image('Photo d’en-tête', 'boucherie'),
        chapitres: fields.array(
          fields.object({
            titre: fields.text({ label: 'Titre' }),
            texte: paragraphe('Texte'),
            image: image('Photo', 'boucherie'),
          }),
          { label: 'Chapitres', itemLabel: (p) => p.fields.titre.value },
        ),
        galerie: fields.array(image('Photo', 'boucherie'), { label: 'Galerie photos' }),
      },
    }),

    produits: singleton({
      label: 'Page « Nos produits »',
      path: 'src/content/produits',
      schema: {
        titre: fields.text({ label: 'Titre', validation: { isRequired: true } }),
        chapo: fields.text({ label: 'Introduction', multiline: true }),
        questionViande: fields.text({ label: 'Question 1 (choix de la viande)', defaultValue: 'Que voulez-vous cuisiner aujourd’hui ?' }),
        questionCuisson: fields.text({ label: 'Question 2 (choix de la cuisson)', defaultValue: 'Et comment allez-vous le cuire ?' }),
        messageFin: fields.text({
          label: 'Message sous les résultats',
          multiline: true,
          defaultValue: 'Vous hésitez ? Passez nous voir ou appelez-nous : on vous conseille et on vous prépare la pièce à la bonne taille.',
        }),
      },
    }),

    clickCollect: singleton({
      label: 'Réglages du click & collect',
      path: 'src/content/click-collect',
      schema: {
        actif: fields.checkbox({
          label: 'Commandes en ligne ouvertes',
          description: 'Décochez pour suspendre toutes les commandes (vacances, rupture…).',
          defaultValue: true,
        }),
        messageFerme: fields.text({
          label: 'Message quand les commandes sont suspendues',
          multiline: true,
          defaultValue: 'Les commandes en ligne sont momentanément suspendues. Appelez-nous, on s’arrange !',
        }),
        intro: fields.text({ label: 'Texte d’introduction', multiline: true }),
        emailCommandes: fields.text({
          label: 'E-mail qui reçoit les commandes',
          validation: { isRequired: true },
        }),
        joursRetrait: fields.multiselect({ label: 'Jours de retrait possibles', options: JOURS, defaultValue: ['mar', 'mer', 'jeu', 'ven', 'sam'] }),
        creneaux: fields.array(fields.text({ label: 'Créneau (ex. 11h – 12h)' }), {
          label: 'Créneaux de retrait habituels',
          itemLabel: (p) => p.value,
        }),
        creneauxParJour: fields.array(
          fields.object({
            jour: fields.select({ label: 'Jour', options: JOURS, defaultValue: 'dim' }),
            creneaux: fields.array(fields.text({ label: 'Créneau (ex. 11h – 12h)' }), {
              label: 'Créneaux de ce jour',
              description: 'Remplacent les créneaux habituels ce jour-là. Aucun créneau : pas de retrait ce jour-là.',
              itemLabel: (p) => p.value,
            }),
          }),
          {
            label: 'Créneaux différents selon le jour',
            description: 'Facultatif. Ex. le dimanche, seulement le matin. Les jours non listés gardent les créneaux habituels.',
            itemLabel: (p) => `${p.fields.jour.value} : ${p.fields.creneaux.elements.map((c) => c.value).join(', ') || 'aucun'}`,
          },
        ),
        heureLimite: fields.integer({
          label: 'Heure limite de commande la veille',
          description: 'Ex. 18 = on peut commander jusqu’à 18h pour un retrait le lendemain.',
          defaultValue: 18,
          validation: { min: 0, max: 23 },
        }),
        joursAvance: fields.integer({
          label: 'Commande possible jusqu’à … jours à l’avance',
          defaultValue: 7,
          validation: { min: 1, max: 30 },
        }),
        fermetures: fields.array(fields.date({ label: 'Date' }), {
          label: 'Jours de fermeture exceptionnelle',
          itemLabel: (p) => p.value ?? '',
        }),
        mentionPaiement: fields.text({
          label: 'Mention paiement',
          defaultValue: 'Le règlement se fait en boutique, au moment du retrait.',
        }),
        emailClientObjet: fields.text({
          label: 'E-mail au client : objet',
          description: 'Envoyé automatiquement si le client a laissé son e-mail. Le détail de la commande, la date et l’adresse sont ajoutés automatiquement.',
          defaultValue: 'Votre commande à la boucherie Villenière',
        }),
        emailClientTitre: fields.text({
          label: 'E-mail au client : titre',
          defaultValue: 'Merci pour votre commande !',
        }),
        emailClientIntro: fields.text({
          label: 'E-mail au client : texte d’accueil',
          description: 'Après « Bonjour [nom], ». Une ligne vide = nouveau paragraphe.',
          multiline: true,
          defaultValue: 'Nous avons bien reçu votre commande, nous vous la préparons avec soin.',
        }),
        emailClientFin: fields.text({
          label: 'E-mail au client : message de fin',
          multiline: true,
          defaultValue: 'Un empêchement ? Appelez-nous, tout simplement. À très vite à la boutique !',
        }),
      },
    }),
  },

  collections: {
    viandes: collection({
      label: 'Viandes',
      path: 'src/content/viandes/*',
      slugField: 'nom',
      columns: ['nom', 'ordre'],
      schema: {
        nom: fields.slug({ name: { label: 'Nom (ex. Bœuf)', validation: { isRequired: true } } }),
        provenance: fields.text({ label: 'Provenance / éleveur' }),
        description: fields.text({ label: 'Présentation', multiline: true }),
        image: image('Photo', 'viandes'),
        ordre: fields.integer({ label: 'Ordre d’affichage', defaultValue: 10 }),
      },
    }),

    cuissons: collection({
      label: 'Cuissons',
      path: 'src/content/cuissons/*',
      slugField: 'nom',
      columns: ['nom', 'ordre'],
      schema: {
        nom: fields.slug({ name: { label: 'Nom (ex. À griller)', validation: { isRequired: true } } }),
        description: fields.text({ label: 'Petite phrase', description: 'Ex. « Barbecue, plancha ou poêle bien chaude »' }),
        pictogramme: fields.select({
          label: 'Pictogramme',
          options: [
            { label: 'Flamme (griller)', value: 'flamme' },
            { label: 'Cocotte (mijoter)', value: 'cocotte' },
            { label: 'Four (rôtir)', value: 'four' },
            { label: 'Poêle', value: 'poele' },
            { label: 'Couteau (cru, tartare)', value: 'couteau' },
          ],
          defaultValue: 'flamme',
        }),
        ordre: fields.integer({ label: 'Ordre d’affichage', defaultValue: 10 }),
      },
    }),

    morceaux: collection({
      label: 'Morceaux',
      path: 'src/content/morceaux/*',
      slugField: 'nom',
      columns: ['nom', 'viande'],
      schema: {
        nom: fields.slug({ name: { label: 'Nom du morceau', validation: { isRequired: true } } }),
        viande: fields.relationship({ label: 'Viande', collection: 'viandes', validation: { isRequired: true } }),
        cuissons: fields.multiRelationship({ label: 'Cuissons conseillées', collection: 'cuissons', validation: { length: { min: 1 } } }),
        description: fields.text({ label: 'Description', multiline: true }),
        conseil: fields.text({ label: 'Le conseil du boucher', multiline: true }),
        temps: fields.text({ label: 'Temps de cuisson', description: 'Ex. « 3 à 4 min par face », « 2 h 30 à feu doux »' }),
        personnes: fields.text({ label: 'Pour combien ?', description: 'Ex. « 2 personnes », « 150 à 200 g par personne »' }),
        image: image('Photo', 'morceaux'),
        surCommande: fields.checkbox({ label: 'Sur commande uniquement', defaultValue: false }),
        actif: fields.checkbox({ label: 'Afficher sur le site', defaultValue: true }),
        ordre: fields.integer({ label: 'Ordre d’affichage', defaultValue: 10 }),
      },
    }),

    tempsForts: collection({
      label: 'Temps forts (Noël, Halloween, Galette…)',
      path: 'src/content/temps-forts/*',
      slugField: 'nom',
      columns: ['nom', 'debut', 'fin'],
      schema: {
        nom: fields.slug({
          name: { label: 'Nom (ex. Noël)', validation: { isRequired: true } },
          slug: { label: 'Adresse de la page', description: 'Ex. « noel » donne boucherie-villeniere.fr/noel' },
        }),
        actif: fields.checkbox({
          label: 'Activé',
          description: 'Décochez pour tout masquer, quelles que soient les dates.',
          defaultValue: true,
        }),
        debut: fields.date({ label: 'Visible à partir du', description: 'Laissez vide pour afficher dès maintenant.' }),
        fin: fields.date({ label: 'Visible jusqu’au (inclus)', description: 'Laissez vide pour ne pas fixer de fin.' }),
        affichage: fields.select({
          label: 'Où l’afficher ?',
          options: [
            { label: 'Popup à l’ouverture du site + bloc sur l’accueil', value: 'les-deux' },
            { label: 'Popup à l’ouverture du site', value: 'popup' },
            { label: 'Bloc sur l’accueil', value: 'accueil' },
            { label: 'Seulement sa page (lien à partager)', value: 'page' },
          ],
          defaultValue: 'les-deux',
        }),
        decor: fields.select({
          label: 'Décor',
          options: [
            { label: 'Flocons (Noël)', value: 'flocons' },
            { label: 'Citrouilles (Halloween)', value: 'citrouilles' },
            { label: 'Couronne (Galette des rois)', value: 'couronne' },
            { label: 'Étoiles', value: 'etoiles' },
            { label: 'Aucun', value: 'aucun' },
          ],
          defaultValue: 'etoiles',
        }),
        surtitre: fields.text({ label: 'Surtitre', description: 'Petite ligne au-dessus du titre, ex. « Noël 2026 ».' }),
        titre: fields.text({ label: 'Titre', validation: { isRequired: true } }),
        accroche: fields.text({
          label: 'Accroche',
          description: 'Deux ou trois lignes, reprises dans la popup et le bloc de l’accueil.',
          multiline: true,
        }),
        image: image('Image d’illustration', 'temps-forts'),
        texte: paragraphe('Texte de la page'),
        bouton: fields.object(
          {
            texte: fields.text({ label: 'Texte du bouton', defaultValue: 'Découvrir' }),
            lien: fields.text({
              label: 'Lien du bouton',
              description: 'Laissez vide pour ouvrir la page du temps fort. Ex. « /commander » pour la page de commande.',
            }),
          },
          { label: 'Bouton' },
        ),
        ordre: fields.integer({ label: 'Priorité', description: 'Si deux temps forts se chevauchent, le plus petit nombre passe devant.', defaultValue: 10 }),
        carte: fields.object(
          {
            titre: fields.text({ label: 'Titre de la carte', description: 'En couverture du menu imprimé, ex. « Passez vos commandes pour les fêtes ! »' }),
            rubriques: fields.array(
              fields.object({
                titre: fields.text({ label: 'Titre de la rubrique', description: 'Ex. Foie gras, Volailles festives, Bœuf…' }),
                intro: fields.text({ label: 'Texte d’introduction', multiline: true }),
                encadres: fields.array(
                  fields.object({
                    illustration: fields.select({
                      label: 'Dessin',
                      options: [
                        { label: 'Rôti en melon', value: 'melon' },
                        { label: 'Rôti allongé', value: 'roti-allonge' },
                        { label: 'Volaille rôtie', value: 'volaille' },
                        { label: 'Aucun', value: 'aucun' },
                      ],
                      defaultValue: 'aucun',
                    }),
                    titre: fields.text({ label: 'Titre' }),
                    texte: fields.text({ label: 'Texte', multiline: true }),
                  }),
                  { label: 'Encadrés illustrés (ex. Melon / Rôti allongé)', itemLabel: (p) => p.fields.titre.value || 'Encadré' },
                ),
                colonnes: fields.array(fields.text({ label: 'Nom de la variante' }), {
                  label: 'Variantes en colonnes (optionnel)',
                  description: 'Ex. les farces : « pommes caramélisées et châtaignes », « morilles et crème »… Chaque produit aura alors un prix par variante.',
                  itemLabel: (p) => p.value,
                }),
                produits: fields.array(
                  fields.object({
                    nom: fields.text({ label: 'Nom', description: 'Sans prix ni précision, la ligne devient un intertitre (ex. « Accompagnements »).' }),
                    detail: fields.text({ label: 'Précision', description: 'Ex. « 4 à 6 pers. », « lobe d’environ 500 g ».' }),
                    prix: fields.number({ label: 'Prix', step: 0.01 }),
                    unite: fields.select({
                      label: 'Unité',
                      options: [
                        { label: '€/kg', value: 'kg' },
                        { label: '€', value: 'piece' },
                        { label: '€ la pièce', value: 'la-piece' },
                        { label: '€/pers.', value: 'pers' },
                      ],
                      defaultValue: 'kg',
                    }),
                    prixVariantes: fields.array(fields.number({ label: 'Prix', step: 0.01 }), {
                      label: 'Prix par variante (dans l’ordre des colonnes)',
                      itemLabel: (p) => String(p.value ?? ''),
                    }),
                    commandable: fields.checkbox({ label: 'Commandable en ligne', defaultValue: true }),
                    saisie: fields.select({
                      label: 'Produit au kilo : que demander au client ?',
                      options: [
                        { label: 'Le poids souhaité (viandes)', value: 'poids' },
                        { label: 'Le nombre de personnes (volailles)', value: 'personnes' },
                        { label: 'Un simple nombre de pièces', value: 'piece' },
                      ],
                      defaultValue: 'poids',
                    }),
                    personnesMin: fields.integer({ label: 'Nombre de personnes : minimum', validation: { min: 1, max: 40 } }),
                    personnesMax: fields.integer({ label: 'Nombre de personnes : maximum', validation: { min: 1, max: 40 } }),
                    poids: fields.number({
                      label: 'Poids pour estimer le prix (kg)',
                      description: 'Par personne si l’on demande le nombre de personnes (ex. 0,45), ou d’une pièce si l’on compte en pièces (ex. 0,5). Vide : le client voit « prix à la pesée », sans montant.',
                      step: 0.05,
                    }),
                    farce: fields.checkbox({ label: 'Proposer le choix de la farce', description: 'Volailles entières. Les farces se règlent plus bas : « Farces proposées ».', defaultValue: false }),
                    accompagnement: fields.checkbox({
                      label: 'Accompagnement compris avec le plat (ex. sauce)',
                      description: 'Sans prix. Le client l’ajoute avec le + puis précise, plat par plat, avec ou sans.',
                      defaultValue: false,
                    }),
                    avecSauce: fields.checkbox({ label: 'Ce plat peut être servi avec l’accompagnement', defaultValue: false }),
                    allergenes: fields.multiselect({ label: 'Allergènes', options: ALLERGENES }),
                    quantiteMax: fields.integer({ label: 'Quantité maximum par commande', defaultValue: 10, validation: { min: 1, max: 99 } }),
                  }),
                  {
                    label: 'Produits',
                    itemLabel: (p) => `${p.fields.nom.value}${p.fields.prix.value != null ? ` — ${p.fields.prix.value} €` : ''}`,
                  },
                ),
                note: fields.text({ label: 'Note en bas de rubrique', multiline: true }),
                nouvellePage: fields.checkbox({ label: 'Commencer une nouvelle page (menu imprimé)', defaultValue: false }),
              }),
              { label: 'Rubriques', itemLabel: (p) => p.fields.titre.value || 'Rubrique' },
            ),
            farces: fields.array(
              fields.object({
                nom: fields.text({ label: 'Nom de la farce' }),
                prix100g: fields.number({ label: 'Prix aux 100 g (€)', description: 'Vide : aucun montant n’est annoncé au client.', step: 0.01 }),
              }),
              { label: 'Farces proposées sur les volailles entières', itemLabel: (p) => p.fields.nom.value },
            ),
            farceGrammes: fields.integer({
              label: 'Quantité de farce par volaille (g)',
              description: 'Sert à calculer le prix de la farce : prix aux 100 g × cette quantité.',
              defaultValue: 500,
              validation: { min: 50, max: 3000 },
            }),
            mentionAllergenes: fields.text({
              label: 'Mention sur les allergènes',
              defaultValue: 'Allergènes : liste complète disponible sur demande en boutique.',
            }),
            piedDeCarte: fields.text({ label: 'Mot de la fin', multiline: true, description: 'Ex. la sélection de vins.' }),
            commande: fields.object(
              {
                actif: fields.checkbox({ label: 'Commande en ligne de cette carte', defaultValue: false }),
                dateLimite: fields.date({ label: 'Dernier jour pour commander', description: 'Laissez vide : pas de date limite (hors heure limite habituelle).' }),
                retraitDu: fields.date({ label: 'Retrait possible à partir du' }),
                retraitAu: fields.date({ label: 'Retrait possible jusqu’au (inclus)' }),
                mentionArrhes: fields.text({
                  label: 'Mention sur les arrhes',
                  description: 'Affichée sur la carte, dans la commande, la confirmation, les e-mails et le menu imprimé. Remplace la mention de paiement habituelle. Vide : pas d’arrhes.',
                  multiline: true,
                }),
                message: fields.text({
                  label: 'Message au-dessus de la carte',
                  multiline: true,
                  defaultValue: 'Commandez en ligne, retirez en boutique : le règlement se fait au retrait.',
                }),
              },
              {
                label: 'Commande en ligne',
                description: 'Jours et créneaux de retrait : ceux du click & collect habituel, limités aux dates ci-dessous.',
              },
            ),
            lienQR: fields.text({
              label: 'Lien du QR code (menu imprimé)',
              description: 'Laissez vide : la carte commandable de ce temps fort, sinon la page de commande du site.',
            }),
          },
          {
            label: 'Carte / menu',
            description: 'Affichée sur la page du temps fort. Le menu à imprimer (PDF) s’ouvre avec le bouton en bas de cette page.',
          },
        ),
        imprimer: boutonImpression(),
      },
    }),

    plats: collection({
      label: 'Plats à commander',
      path: 'src/content/plats/*',
      slugField: 'nom',
      columns: ['nom', 'prix'],
      schema: {
        nom: fields.slug({ name: { label: 'Nom du plat', validation: { isRequired: true } } }),
        actif: fields.checkbox({ label: 'Disponible à la commande', defaultValue: true }),
        description: fields.text({ label: 'Description courte', multiline: true }),
        prix: fields.number({ label: 'Prix (€)', step: 0.01, validation: { isRequired: true, min: 0 } }),
        unite: fields.select({
          label: 'Prix par',
          options: [
            { label: 'Pièce', value: 'piece' },
            { label: 'Part', value: 'part' },
            { label: 'Barquette', value: 'barquette' },
            { label: 'Kilo (prix indicatif)', value: 'kg' },
          ],
          defaultValue: 'piece',
        }),
        precision: fields.text({ label: 'Précision', description: 'Ex. « pour 4 personnes », « env. 1,4 kg »' }),
        image: image('Photo', 'plats'),
        jours: fields.multiselect({
          label: 'Jours où ce plat est disponible',
          description: 'Ne rien cocher = tous les jours de retrait.',
          options: JOURS,
        }),
        quantiteMax: fields.integer({ label: 'Quantité max par commande', defaultValue: 6, validation: { min: 1 } }),
        allergenes: fields.multiselect({ label: 'Allergènes', options: ALLERGENES }),
        ordre: fields.integer({ label: 'Ordre d’affichage', defaultValue: 10 }),
      },
    }),
  },
});
