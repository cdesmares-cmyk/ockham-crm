// Génère le jeu de données FICTIF de l'organisation « Démo » (code DEMO).
//
//   node scripts/generer-demo.js        → écrit supabase/seed/demo.sql
//   npx supabase db query --linked -f supabase/seed/demo.sql   → (re)charge la démo
//
// Le SQL est un seul bloc DO : il s'exécute d'un coup, ou pas du tout. Il vide
// les données de l'organisation DEMO puis les recrée : rejouable avant chaque
// présentation. Il ne touche à aucune autre organisation, ni aux utilisateurs.
//
// Tout est inventé : noms, SIRET (préfixe 000), contacts (domaines .example,
// réservés aux exemples), téléphones (04 00 00 xx xx). Les adresses sont des
// rues lyonnaises génériques.

import fs from 'node:fs'

const ORG = { code: 'DEMO', nom: 'Démo Ockham' }
const MOIS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 9 + i, 1))          // oct. 2024 → sept. 2026
  return d.toISOString().slice(0, 7)
})
const ANNEE_COURANTE = '2026'

const COM = {
  cd: 'cdesmares@elise.com.fr',
  lm: 'lmartin@demo-ockham.example',
  sb: 'sbernard@demo-ockham.example',
  tr: 'trobert@demo-ockham.example',
}

// ---------------------------------------------------------------------------
// SIRET fictifs mais valides au contrôle de Luhn, préfixe 000 (aucune entreprise réelle)
// ---------------------------------------------------------------------------
function luhnOk(s) {
  let somme = 0
  for (let i = 0; i < s.length; i++) {
    let n = +s[s.length - 1 - i]
    if (i % 2) { n *= 2; if (n > 9) n -= 9 }
    somme += n
  }
  return somme % 10 === 0
}
function siren(n) {
  for (let k = 0; k < 10; k++) {
    const s = `000${String(n).padStart(5, '0')}${k}`
    if (luhnOk(s)) return s
  }
  throw new Error('siren')
}
function siret(sir, etab) {
  for (let k = 0; k < 10; k++) {
    const s = `${sir}${String(etab).padStart(4, '0')}${k}`
    if (luhnOk(s)) return s
  }
  throw new Error('siret')
}

// ---------------------------------------------------------------------------
// Le portefeuille fictif
//   recurrent : [ [mois de début, montant mensuel], [mois, nouveau montant], … ] ; 0 = résilié
// ---------------------------------------------------------------------------
let ax = 900000
const id = () => ++ax

const entreprises = []
const tiers = []
const contacts = []

function entreprise(n, raison, naf, libelle, effectif) {
  const e = { siren: siren(n), raison, naf, libelle, effectif }
  entreprises.push(e)
  return e
}

function fiche(f) {
  const t = {
    axonaut_id: id(), statut_axonaut: 'client', classement_statut: 'valide', chantier: false,
    actif: true, consignes: null, payeur: null, rattachement: null, recurrent: [], champs: {},
    ...f,
  }
  tiers.push(t)
  return t
}

function contact(t, civ, prenom, nom, fonction, domaine, tel) {
  contacts.push({
    tiers: t.axonaut_id, civ, prenom, nom, fonction,
    email: prenom ? `${prenom}.${nom}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z.]/g, '') + `@${domaine}.example` : `compta@${domaine}.example`,
    tel,
  })
}

// --- 7 clients directs (facturés et collectés au même endroit) --------------
const eBoul = entreprise(11, 'BOULANGERIE SAINT-JEAN', '10.71C', 'Boulangerie et boulangerie-pâtisserie', 'Moins de 20')
const boul = fiche({
  nom: 'Boulangerie Saint-Jean', classement: 'client', siret: siret(eBoul.siren, 12), adresse: '12 rue Saint-Jean', cp: '69005', ville: 'Lyon',
  com: COM.cd, recurrent: [['2024-10', 85]],
  champs: { zone: '1', mode_collecte: 'Cyclo', type_contrat: 'Local', secteur: 'Commerce et Retail', categorie_entreprise: 'Moins de 20', public_prive: 'Privé', soumis_bdc: 'Non', numero_client: '90011' },
  consignes: 'Passage par la cour arrière avant 7 h. Sonner au laboratoire.',
})
contact(boul, 'Mme', 'Claire', 'Dumont', 'Gérante', 'boulangerie-saint-jean', '04 00 00 11 01')
const boulLabo = fiche({
  nom: 'Boulangerie Saint-Jean - Laboratoire Vaise', classement: 'point_collecte', statut_axonaut: 'prospect', siret: siret(eBoul.siren, 20),
  adresse: '7 rue du Bourbonnais', cp: '69009', ville: 'Lyon', com: COM.cd, payeur: boul, rattachement: 'suggere',
  champs: { zone: '1', mode_collecte: 'Cyclo' },
})

const eMartin = entreprise(12, 'CABINET MARTIN AVOCATS', '69.10Z', 'Activités juridiques', 'De 20 à 99')
const martin = fiche({
  nom: 'Cabinet Martin Avocats', classement: 'client', siret: siret(eMartin.siren, 15), adresse: '45 rue de la République', cp: '69002', ville: 'Lyon',
  com: COM.lm, recurrent: [['2024-10', 210], ['2026-03', 300]],
  champs: { zone: '1', mode_collecte: 'Cyclo', type_contrat: 'Local', secteur: 'Services aux Entreprises', categorie_entreprise: 'De 20 à 99', public_prive: 'Privé', soumis_bdc: 'Non', numero_client: '90012' },
  consignes: 'Accueil au 3e étage. Badge à demander à l\'accueil.',
})
contact(martin, 'M.', 'Julien', 'Martin', 'Associé gérant', 'cabinet-martin', '04 00 00 12 01')
contact(martin, 'Mme', 'Sophie', 'Lefèvre', 'Office manager', 'cabinet-martin', '04 00 00 12 02')
fiche({
  nom: 'Cabinet Martin Avocats - Annexe Brotteaux', classement: 'point_collecte', statut_axonaut: 'prospect', siret: siret(eMartin.siren, 23),
  adresse: '18 boulevard des Brotteaux', cp: '69006', ville: 'Lyon', com: COM.lm, payeur: martin, rattachement: 'valide',
  champs: { zone: '1', mode_collecte: 'Cyclo' },
})

const ePixel = entreprise(13, 'AGENCE PIXEL ET CO', '73.11Z', 'Activités des agences de publicité', 'Moins de 20')
const pixel = fiche({
  nom: 'Agence Pixel & Co', classement: 'client', siret: siret(ePixel.siren, 11), adresse: '8 quai Saint-Vincent', cp: '69001', ville: 'Lyon',
  com: COM.sb, recurrent: [['2024-10', 120], ['2026-07', 0]], actif: false,
  champs: { zone: '1', mode_collecte: 'Cyclo', type_contrat: 'Local', secteur: 'Édition | Communication et Multimédia', categorie_entreprise: 'Moins de 20', public_prive: 'Privé', numero_client: '90013' },
  consignes: 'Résilié : déménagement dans un immeuble déjà équipé (courrier du 12/05/2026).',
})
contact(pixel, 'M.', 'Hugo', 'Perrin', 'Directeur', 'agence-pixel', '04 00 00 13 01')
fiche({
  nom: 'Agence Pixel & Co (do not use)', classement: 'archive', siret: siret(ePixel.siren, 11), adresse: '8 quai Saint-Vincent', cp: '69001', ville: 'Lyon',
  com: COM.sb, actif: false, champs: { marque_do_not_use: true },
})

const eEcole = entreprise(14, 'ECOLE MONTESSORI DES PENTES', '85.20Z', 'Enseignement primaire', 'De 20 à 99')
const ecole = fiche({
  nom: 'École Montessori des Pentes', classement: 'client', siret: siret(eEcole.siren, 14), adresse: '3 montée de la Grande Côte', cp: '69001', ville: 'Lyon',
  com: COM.sb, recurrent: [['2024-10', 160]],
  champs: { zone: '1', mode_collecte: 'Cyclo', type_contrat: 'Local', secteur: 'Éducation et Formation', categorie_entreprise: 'De 20 à 99', public_prive: 'Privé', soumis_bdc: 'Oui', numero_client: '90014' },
  consignes: 'Collecte le mercredi après-midi uniquement (pas d\'élèves).',
})
contact(ecole, 'Mme', 'Anne', 'Girard', 'Directrice', 'montessori-pentes', '04 00 00 14 01')

const eVeto = entreprise(15, 'CLINIQUE VETERINAIRE DU PARC', '75.00Z', 'Activités vétérinaires', 'Moins de 20')
const veto = fiche({
  nom: 'Clinique Vétérinaire du Parc', classement: 'client', siret: siret(eVeto.siren, 16), adresse: '102 boulevard des Belges', cp: '69006', ville: 'Lyon',
  com: COM.tr, recurrent: [['2024-10', 140]],
  champs: { zone: '1', mode_collecte: 'Camion', type_contrat: 'Local', secteur: 'Établissements de Santé', categorie_entreprise: 'Moins de 20', public_prive: 'Privé', code_trackdechets: '0001', numero_client: '90015' },
})
contact(veto, 'Dr', 'Marc', 'Rousseau', 'Vétérinaire associé', 'veto-parc', '04 00 00 15 01')

const eBouchon = entreprise(16, 'LE BOUCHON GOURMAND', '56.10A', 'Restauration traditionnelle', 'Moins de 20')
const bouchon = fiche({
  nom: 'Le Bouchon Gourmand', classement: 'client', siret: siret(eBouchon.siren, 13), adresse: '22 rue Mercière', cp: '69002', ville: 'Lyon',
  com: COM.cd, recurrent: [['2024-10', 95], ['2026-05', 65]],
  champs: { zone: '1', mode_collecte: 'Cyclo', type_contrat: 'Local', secteur: 'Restauration et Hôtellerie', categorie_entreprise: 'Moins de 20', public_prive: 'Privé', numero_client: '90016' },
})
contact(bouchon, 'M.', 'Paul', 'Bonnet', 'Chef et gérant', 'bouchon-gourmand', '04 00 00 16 01')

const eAtelier = entreprise(17, 'ATELIER MECANIQUE GERLAND', '33.12Z', 'Réparation de machines', 'De 20 à 99')
const atelier = fiche({
  nom: 'Atelier Mécanique Gerland', classement: 'client', siret: siret(eAtelier.siren, 19), adresse: '60 avenue Tony Garnier', cp: '69007', ville: 'Lyon',
  com: COM.lm, recurrent: [['2026-02', 380]],
  champs: { zone: '2', mode_collecte: 'Camion', type_contrat: 'Local', secteur: 'Industries Diverses', categorie_entreprise: 'De 20 à 99', public_prive: 'Privé', code_trackdechets: '0002', soumis_bdc: 'Oui', numero_client: '90017' },
  consignes: 'Quai de chargement n° 2. Prévenir 24 h avant.',
})
contact(atelier, 'M.', 'Karim', 'Benali', 'Responsable HSE', 'atelier-gerland', '04 00 00 17 01')

// --- 3 groupes : un payeur « Facturé à », plusieurs points de collecte -------
function groupe(n, raison, naf, libelle, effectif, payeurInfo, sites, com, champsGroupe) {
  const e = entreprise(n, raison, naf, libelle, effectif)
  const payeur = fiche({
    nom: `Facturé à : ${raison}`, classement: 'payeur', siret: siret(e.siren, 10), com,
    ...payeurInfo, champs: { ...champsGroupe, numero_client: String(90000 + n) },
  })
  let etab = 30
  // Le payeur porte la facture : la somme des récurrents des sites, mois par mois.
  const total = new Map()
  for (const s of sites) {
    fiche({
      nom: s.nom, classement: 'point_collecte', statut_axonaut: 'prospect', siret: siret(e.siren, etab++),
      adresse: s.adresse, cp: s.cp, ville: s.ville, com, payeur, rattachement: s.rattachement ?? 'valide',
      chantier: Boolean(s.chantier), classement_statut: s.classement_statut ?? 'valide',
      champs: { zone: s.zone ?? '1', mode_collecte: s.mode ?? 'Camion' }, consignes: s.consignes ?? null,
    })
    for (const m of MOIS) {
      const [debut, montant, fin] = s.flux
      if (m >= debut && (!fin || m <= fin)) total.set(m, (total.get(m) ?? 0) + montant)
    }
  }
  payeur.recurrentParMois = total
  return payeur
}

const banque = groupe(21, 'BANQUE RHONE CREDIT', '64.19Z', 'Autres intermédiations monétaires', 'Plus de 1000',
  { adresse: '20 cours Lafayette', cp: '69003', ville: 'Lyon' },
  [
    { nom: 'BRC - Agence Croix-Rousse', adresse: '15 place de la Croix-Rousse', cp: '69004', ville: 'Lyon', flux: ['2024-10', 75] },
    { nom: 'BRC - Agence Part-Dieu', adresse: '40 rue Servient', cp: '69003', ville: 'Lyon', flux: ['2024-10', 75] },
    { nom: 'BRC - Agence Gratte-Ciel', adresse: '9 avenue Henri Barbusse', cp: '69100', ville: 'Villeurbanne', flux: ['2024-10', 75] },
    { nom: 'BRC - Agence Vénissieux', adresse: '3 avenue Jean Jaurès', cp: '69200', ville: 'Vénissieux', flux: ['2024-10', 75], rattachement: 'suggere' },
    { nom: 'BRC - Agence Écully', adresse: '1 place de la Libération', cp: '69130', ville: 'Écully', flux: ['2024-10', 75], zone: '2' },
    { nom: 'BRC - Agence Bron', adresse: '12 avenue Franklin Roosevelt', cp: '69500', ville: 'Bron', flux: ['2026-04', 75], rattachement: 'suggere', zone: '2' },
  ],
  COM.cd, { type_contrat: 'Cadre', secteur: 'Banque | Assurance et Conseil', categorie_entreprise: 'Plus de 1000', public_prive: 'Privé', soumis_bdc: 'Oui', plateforme: 'TRADESHIFT' })
contact(banque, null, null, 'banque-rhone-credit', 'Comptabilité fournisseurs', 'banque-rhone-credit', '04 00 00 21 00')
contact(banque, 'Mme', 'Isabelle', 'Fontaine', 'Responsable services généraux', 'banque-rhone-credit', '04 00 00 21 01')

const immo = groupe(22, 'IMMOBILIERE CONFLUENCE', '68.32A', 'Administration d\'immeubles', 'De 100 à 249',
  { adresse: '5 cours Charlemagne', cp: '69002', ville: 'Lyon' },
  [
    { nom: 'Résidence Les Quais', adresse: '30 quai Rambaud', cp: '69002', ville: 'Lyon', flux: ['2024-10', 180] },
    { nom: 'Tour Confluence - Bureaux', adresse: '52 quai Rambaud', cp: '69002', ville: 'Lyon', flux: ['2024-10', 240], consignes: 'Local poubelles niveau -1, code 1234 (fictif).' },
    { nom: 'Résidence Monplaisir', adresse: '88 avenue des Frères Lumière', cp: '69008', ville: 'Lyon', flux: ['2025-03', 120] },
    { nom: 'Chantier Gerland Nord', adresse: '200 avenue Jean Jaurès', cp: '69007', ville: 'Lyon', flux: ['2026-01', 150], chantier: true, rattachement: 'suggere', zone: '2' },
  ],
  COM.sb, { type_contrat: 'National', secteur: 'BTP | Construction | Immobilier', categorie_entreprise: 'De 100 à 249', public_prive: 'Privé', soumis_bdc: 'Non' })
contact(immo, 'M.', 'Thomas', 'Lambert', 'Directeur technique', 'immo-confluence', '04 00 00 22 01')

const cliniques = groupe(23, 'CLINIQUES DU LYONNAIS', '86.10Z', 'Activités hospitalières', 'De 250 à 999',
  { adresse: '4 chemin de la Raude', cp: '69160', ville: 'Tassin-la-Demi-Lune' },
  [
    { nom: 'Clinique Saint-Irénée', adresse: '25 rue des Fossés de Trion', cp: '69005', ville: 'Lyon', flux: ['2024-10', 230] },
    { nom: 'Clinique de Villeurbanne', adresse: '70 cours Émile Zola', cp: '69100', ville: 'Villeurbanne', flux: ['2025-06', 190], rattachement: 'suggere' },
    { nom: 'Centre de soins Caluire', adresse: '14 montée des Forts', cp: '69300', ville: 'Caluire-et-Cuire', flux: ['2025-09', 100], rattachement: 'aucun', classement_statut: 'suggere', zone: '2' },
  ],
  COM.tr, { type_contrat: 'AO', secteur: 'Établissements de Santé', categorie_entreprise: 'De 250 à 999', public_prive: 'Privé', code_trackdechets: '0023', soumis_bdc: 'Oui', plateforme: 'CHORUS' })
contact(cliniques, null, null, 'cliniques-lyonnais', 'Service achats', 'cliniques-lyonnais', '04 00 00 23 00')
contact(cliniques, 'Mme', 'Nathalie', 'Morel', 'Responsable logistique', 'cliniques-lyonnais', '04 00 00 23 01')

// --- 5 prospects Axonaut (aucune relation commerciale) ----------------------
for (const [i, [nom, adresse, cp, ville, com, secteur, statut, civ, prenom, nomContact, fonction]] of [
  ['Hôtel des Célestins', '4 rue des Archers', '69002', 'Lyon', COM.lm, 'Restauration et Hôtellerie', 'valide', 'Mme', 'Laura', 'Chevalier', 'Directrice d\'hôtel'],
  ['Crèche Les Petits Canuts', '11 rue d\'Austerlitz', '69004', 'Lyon', COM.sb, 'Éducation et Formation', 'valide', 'Mme', 'Émilie', 'Roux', 'Directrice'],
  ['Lumière Labs', '27 rue de Marseille', '69007', 'Lyon', COM.cd, 'Services aux Entreprises', 'valide', 'M.', 'Antoine', 'Garnier', 'Office manager'],
  ['Pharmacie Bellecour', '2 place Bellecour', '69002', 'Lyon', COM.tr, 'Établissements de Santé', 'valide', 'Mme', 'Camille', 'Blanc', 'Pharmacienne titulaire'],
  ['Garage Auto Vaise', '55 rue de Saint-Cyr', '69009', 'Lyon', COM.lm, 'Transports et Logistique', 'suggere', 'M.', 'Nicolas', 'Faure', 'Gérant'],
].entries()) {
  const p = fiche({ nom, classement: 'prospect', statut_axonaut: 'prospect', adresse, cp, ville, com, classement_statut: statut, actif: null, champs: { secteur } })
  const domaine = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
  contact(p, civ, prenom, nomContact, fonction, domaine, `04 00 00 30 0${i}`)
}

// ---------------------------------------------------------------------------
// Factures : une par mois et par fiche facturée
// ---------------------------------------------------------------------------
function recurrentDuMois(t, m) {
  if (t.recurrentParMois) return t.recurrentParMois.get(m) ?? 0
  let montant = 0
  for (const [debut, v] of t.recurrent) if (m >= debut) montant = v
  return montant
}
const factures = []
let numero = 1
for (const t of tiers) {
  if (t.classement !== 'client' && t.classement !== 'payeur') continue
  for (const m of MOIS) {
    const montant = recurrentDuMois(t, m)
    if (!montant) continue
    factures.push({ axonaut_id: id(), tiers: t.axonaut_id, numero: `DEMO-${String(numero++).padStart(5, '0')}`, date: `${m}-28`, ht: montant, ttc: Math.round(montant * 120) / 100 })
  }
  const siennes = factures.filter(f => f.tiers === t.axonaut_id)
  t.ca_total = siennes.reduce((s, f) => s + f.ht, 0)
  t.ca_annee = siennes.filter(f => f.date.startsWith(ANNEE_COURANTE)).reduce((s, f) => s + f.ht, 0)
  t.premiere = siennes[0]?.date ?? null
  t.derniere = siennes.at(-1)?.date ?? null
}

// ---------------------------------------------------------------------------
// SQL : un seul bloc DO, exécuté d'un coup
// ---------------------------------------------------------------------------
const q = v => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const lignes = []
const L = s => lignes.push(s)

L('-- Jeu de données FICTIF de l\'organisation Démo. Généré par scripts/generer-demo.js : ne pas modifier à la main.')
L('do $demo$')
L('declare o uuid;')
L('begin')
L(`  insert into public.organisations (nom, code_org) values (${q(ORG.nom)}, ${q(ORG.code)}) on conflict (code_org) do nothing;`)
L(`  select id into o from public.organisations where code_org = ${q(ORG.code)};`)
L('')
L('  -- Remise à zéro des données de la démo (les utilisateurs sont conservés)')
L('  delete from public.contacts where organisation_id = o;')
L('  delete from public.factures where organisation_id = o;')
L('  update public.tiers set payeur_id = null, doublon_de = null where organisation_id = o;')
L('  delete from public.tiers where organisation_id = o;')
L('  delete from public.entreprises where organisation_id = o;')
L('  delete from public.sync_runs where organisation_id = o;')
L('')
L('  insert into public.entreprises (organisation_id, siren, raison_sociale, naf, libelle_naf, tranche_effectif, etat, enrichi_le) values')
L(entreprises.map(e => `    (o, ${q(e.siren)}, ${q(e.raison)}, ${q(e.naf)}, ${q(e.libelle)}, ${q(e.effectif)}, 'A', now())`).join(',\n') + ';')
L('')
L('  insert into public.tiers (organisation_id, axonaut_id, statut_axonaut, classement, classement_statut, chantier, siret, siret_statut, nom, adresse, code_postal, ville, pays, commercial_axonaut, actif, champs_axonaut, consignes, ca_total, ca_annee, premiere_facture, derniere_facture, synchro_le) values')
L(tiers.map(t => `    (o, ${t.axonaut_id}, ${q(t.statut_axonaut)}, ${q(t.classement)}, ${q(t.classement_statut)}, ${t.chantier}, ${q(t.siret ?? null)}, ${q(t.siret ? 'valide' : 'vide')}, ${q(t.nom)}, ${q(t.adresse)}, ${q(t.cp)}, ${q(t.ville)}, 'France', ${q(t.com)}, ${t.actif ?? 'null'}, ${q(JSON.stringify(t.champs))}::jsonb, ${q(t.consignes)}, ${t.ca_total ?? 0}, ${t.ca_annee ?? 0}, ${q(t.premiere ?? null)}::date, ${q(t.derniere ?? null)}::date, now())`).join(',\n') + ';')
L('')
L('  update public.tiers t set entreprise_id = e.id from public.entreprises e')
L('  where t.organisation_id = o and e.organisation_id = o and e.siren = left(t.siret, 9);')
L('')
L('  update public.tiers t set commercial_id = u.id from public.utilisateurs u')
L('  where t.organisation_id = o and u.organisation_id = o and lower(u.email_axonaut) = t.commercial_axonaut;')
L('')
const rattaches = tiers.filter(t => t.payeur && t.rattachement !== 'aucun')
L('  update public.tiers s set payeur_id = p.id, rattachement_statut = v.statut')
L('  from (values')
L(rattaches.map(t => `    (${t.axonaut_id}, ${t.payeur.axonaut_id}, ${q(t.rattachement)})`).join(',\n'))
L('  ) as v(site, payeur, statut)')
L('  join public.tiers p on p.organisation_id = o and p.axonaut_id = v.payeur')
L('  where s.organisation_id = o and s.axonaut_id = v.site;')
L('')
L('  insert into public.contacts (organisation_id, tiers_id, axonaut_id, civilite, prenom, nom, fonction, email, telephone)')
L('  select o, t.id, v.ax, v.civ, v.prenom, v.nom, v.fonction, v.email, v.tel from (values')
L(contacts.map((c, i) => `    (${c.tiers}, ${950000 + i}, ${q(c.civ)}, ${q(c.prenom)}, ${q(c.prenom ? c.nom : null)}, ${q(c.fonction)}, ${q(c.email)}, ${q(c.tel)})`).join(',\n'))
L('  ) as v(tiers_ax, ax, civ, prenom, nom, fonction, email, tel)')
L('  join public.tiers t on t.organisation_id = o and t.axonaut_id = v.tiers_ax;')
L('')
L('  insert into public.factures (organisation_id, axonaut_id, tiers_id, numero, date_facture, montant_ht, montant_ttc, statut)')
L('  select o, v.ax, t.id, v.numero, v.d::date, v.ht, v.ttc, \'payee\' from (values')
L(factures.map(f => `    (${f.tiers}, ${f.axonaut_id}, ${q(f.numero)}, ${q(f.date)}, ${f.ht}, ${f.ttc})`).join(',\n'))
L('  ) as v(tiers_ax, ax, numero, d, ht, ttc)')
L('  join public.tiers t on t.organisation_id = o and t.axonaut_id = v.tiers_ax;')
L('')
L(`  insert into public.sync_runs (organisation_id, source, fin, statut, lignes_lues, lignes_ecrites) values (o, 'import_csv', now(), 'ok', ${tiers.length}, ${tiers.length});`)
L('end')
L('$demo$;')

fs.mkdirSync('supabase/seed', { recursive: true })
fs.writeFileSync('supabase/seed/demo.sql', lignes.join('\n') + '\n')

const n = c => tiers.filter(t => t.classement === c).length
console.log(`Démo : ${entreprises.length} entreprises, ${tiers.length} fiches (payeurs ${n('payeur')}, clients ${n('client')}, points de collecte ${n('point_collecte')}, prospects ${n('prospect')}, archives ${n('archive')}), ${contacts.length} contacts, ${factures.length} factures`)
console.log(`CA ${ANNEE_COURANTE} : ${tiers.reduce((s, t) => s + (t.ca_annee ?? 0), 0)} €  ·  CA cumulé : ${tiers.reduce((s, t) => s + (t.ca_total ?? 0), 0)} €`)
