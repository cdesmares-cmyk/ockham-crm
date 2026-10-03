// Import Axonaut (exports CSV) vers Ockham CRM.
//
// Deux fichiers, exportés depuis Axonaut :
//   - « clients »  (export_customers) : une ligne par société cliente, avec le CA
//   - « contacts » (export_employees) : une ligne par contact, clients ET prospects
//
// Usage :
//   node scripts/import-axonaut-csv.js <clients.csv> <contacts.csv>                 → aperçu, rien n'est écrit
//   node scripts/import-axonaut-csv.js <clients.csv> <contacts.csv> --sql data/import → génère les fichiers SQL d'import
//
// Le SQL est idempotent (clé : organisation + id Axonaut) et ne touche jamais un
// classement ou un rattachement déjà validé par un commercial.

import fs from 'node:fs'

const ORGANISATION = { code_org: 'ELISE-LYON', nom: 'Elise Lyon' }
const SEUIL_SIMILARITE_NOM = 0.5

// ---------------------------------------------------------------------------
// Lecture CSV (séparateur ;, guillemets, retours ligne dans les champs)
// ---------------------------------------------------------------------------
function lireCsv(chemin) {
  const t = fs.readFileSync(chemin, 'utf8').replace(/^﻿/, '')
  const lignes = []
  let ligne = [], champ = '', guillemets = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (guillemets) {
      if (c === '"') { if (t[i + 1] === '"') { champ += '"'; i++ } else guillemets = false }
      else champ += c
    // Un guillemet n'ouvre un texte protégé qu'en début de champ : au milieu
    // (ex. « écran 24" »), c'est un caractère comme un autre.
    } else if (c === '"' && champ === '') guillemets = true
    else if (c === ';') { ligne.push(champ); champ = '' }
    else if (c === '\n') { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); ligne = []; champ = '' }
    else champ += c
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne) }
  const entetes = lignes.shift().map(h => h.trim())
  // « TVA intracommunautaire » apparaît deux fois : on garde la première.
  return lignes.filter(l => l.length > 1).map(l => {
    const o = {}
    entetes.forEach((h, i) => { if (!(h in o)) o[h] = (l[i] ?? '').trim() })
    return o
  })
}

// ---------------------------------------------------------------------------
// Nettoyage
// ---------------------------------------------------------------------------
/** Axonaut exporte des valeurs vides sous la forme "", "-", 0000… ou des espaces. */
function propre(v) {
  if (v == null) return null
  const s = String(v).replace(/_x000D_/g, '').replace(/\s*\|\s*/g, ' | ').trim()
  if (s === '' || s === '-' || /^"+$/.test(s) || /^0+$/.test(s)) return null
  return s
}

function montant(v) {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/** JJ/MM/AAAA → AAAA-MM-JJ */
function dateIso(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function luhn(s) {
  let somme = 0
  for (let i = 0; i < s.length; i++) {
    let n = +s[s.length - 1 - i]
    if (i % 2) { n *= 2; if (n > 9) n -= 9 }
    somme += n
  }
  return somme % 10 === 0
}

function controlerSiret(brut) {
  const s = (brut ?? '').replace(/\s/g, '')
  if (!s || /^0+$/.test(s)) return { siret: null, statut: 'vide' }
  if (!/^\d{14}$/.test(s)) return { siret: null, statut: 'cle_invalide' }
  if (/^(\d)\1+$/.test(s)) return { siret: null, statut: 'factice' }
  // La Poste (SIREN 356000000) déroge au contrôle de Luhn.
  if (!luhn(s) && !s.startsWith('356000000')) return { siret: null, statut: 'cle_invalide' }
  return { siret: s, statut: 'valide' }
}

const EMAILS_BIDON = /^contact@gmail\.com$|@example\.com$/i
const est_ancien = nom => /\(\s*(ancien|doublon)\s*\)|^ancien\b|do not use|ne plus utiliser|\bferm[ée]e?s?\b/i.test(nom)
const est_facture_a = nom => /^factur[ée] à\s*:/i.test(nom)
const est_chantier = nom => /chantier/i.test(nom)

const CHAMPS_PERSO = {
  'Zone': 'zone',
  'Catégorisation': 'categorisation',
  'Mode de collecte': 'mode_collecte',
  'Type de contrat': 'type_contrat',
  'Secteur client final': 'secteur',
  'Catégorie entreprise': 'categorie_entreprise',
  'Sous-traitance': 'sous_traitance',
  'Plateforme': 'plateforme',
  'Client soumis à BDC': 'soumis_bdc',
  'Mode envoi facture': 'mode_envoi_facture',
  'Code Signature Track Déchets': 'code_trackdechets',
  'Public/Privé': 'public_prive',
  'N° Client': 'numero_client',
  'Code tiers': 'code_tiers',
  'Id interne de la société': 'id_interne',
  'Origine du contact': 'origine',
  'Dernier RDV suivi': 'dernier_rdv_suivi',
  'Adresse PDP': 'adresse_pdp',
}

// ---------------------------------------------------------------------------
// Similarité de noms (trigrammes, même principe que pg_trgm)
// ---------------------------------------------------------------------------
const sansAccents = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Nom réduit à ce qui identifie l'enseigne : sans « Facturé à », sans codes
 *  internes, et sans la ville de la fiche (sinon « FT GIVORS » ressemble à
 *  « MSP GIVORS » juste parce qu'ils sont à Givors). */
function normaliserNom(nom, ville) {
  const motsVille = new Set(sansAccents(ville ?? '').split(/[^a-z0-9]+/).filter(m => m.length > 2))
  return sansAccents(nom)
    .replace(/^factur[e] a\s*:\s*/, '')
    .replace(/_?\d{3,}\b/g, ' ')          // codes internes : _30929, n° d'agence
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(m => m && !motsVille.has(m))
    .join(' ')
}
function trigrammes(s) {
  const t = new Set()
  for (const mot of s.split(' ').filter(Boolean)) {
    const m = `  ${mot} `
    for (let i = 0; i < m.length - 2; i++) t.add(m.slice(i, i + 3))
  }
  return t
}
function similarite(a, b) {
  let commun = 0
  for (const x of a) if (b.has(x)) commun++
  return commun / (a.size + b.size - commun || 1)
}

// ---------------------------------------------------------------------------
// Transformation
// ---------------------------------------------------------------------------
function ficheDepuisLigne(l, { statutAxonaut }) {
  const { siret, statut } = controlerSiret(l['Siret'])
  const nom = propre(l['Société']) ?? '(sans nom)'
  const champs = {}
  for (const [col, cle] of Object.entries(CHAMPS_PERSO)) {
    const v = propre(l[col])
    if (v != null) champs[cle] = v
  }
  return {
    axonaut_id: +l['Id de la société'],
    statut_axonaut: statutAxonaut,
    siret, siret_statut: statut,
    siren: siret ? siret.slice(0, 9) : null,
    nom,
    adresse: propre(l['Rue']),
    code_postal: propre(l['Code postal']),
    ville: propre(l['Ville']),
    pays: propre(l['Pays']),
    commercial_axonaut: propre(l['Commercial responsable'])?.toLowerCase() ?? null,
    actif: { Actif: true, Inactif: false }[propre(l['Actif / Inactif'])] ?? null,
    champs_axonaut: champs,
    consignes: propre(l['Commentaires']),
    ca_total: montant(l['turnover']),
    ca_annee: montant(l['turnoverThisYear']),
    premiere_facture: dateIso(l['firstInvoiceDate']),
    derniere_facture: dateIso(l['lastInvoiceDate']),
    chantier: est_chantier(nom),
  }
}

function contactDepuisLigne(l) {
  const email = propre(l['Email du contact'])?.toLowerCase() ?? null
  const contact = {
    axonaut_id: +l['Id du contact'] || null,
    tiers_axonaut_id: +l['Id de la société'],
    civilite: propre(l['Civilité du contact']),
    prenom: propre(l['Prénom du contact']),
    nom: propre(l['Nom du contact']),
    fonction: propre(l['Poste/Job du contact']),
    email: email && !EMAILS_BIDON.test(email) ? email : null,
    telephone: propre(l['Téléphone fixe']),
    mobile: propre(l['Téléphone portable']),
    consentement_suivi: { Oui: true, Non: false }[propre(l['CONSENTEMENT_TRACKING_EMAIL'])] ?? null,
  }
  // Un contact sans aucun moyen de joindre ni nom n'apporte rien.
  const utile = contact.email || contact.telephone || contact.mobile || contact.nom
  return utile ? contact : null
}

function transformer(lignesClients, lignesContacts) {
  const fiches = new Map()
  const ecartes = { anciens: 0 }

  // 1. Clients : l'export clients fait foi (CA, dernière facture).
  for (const l of lignesClients) {
    const f = ficheDepuisLigne(l, { statutAxonaut: 'client' })
    if (est_facture_a(f.nom)) f.classement = 'payeur'
    else f.classement = 'client'
    // Une fiche cliente « do not use » garde son historique de CA, en archive.
    if (est_ancien(f.nom)) f.classement = 'archive'
    f.classement_statut = 'valide'   // règle sûre : « Facturé à » = payeur, sinon client
    fiches.set(f.axonaut_id, f)
  }

  // 2. Prospects Axonaut : uniquement depuis l'export contacts.
  for (const l of lignesContacts) {
    const id = +l['Id de la société']
    if (fiches.has(id)) continue
    if (l['Statut Client'] === 'Oui') {
      // Client absent de l'export clients (rare) : on le prend quand même.
      const f = ficheDepuisLigne(l, { statutAxonaut: 'client' })
      f.classement = est_facture_a(f.nom) ? 'payeur' : 'client'
      f.classement_statut = 'valide'
      fiches.set(id, f)
      continue
    }
    if (l['Statut Prospect'] !== 'Oui') continue
    const f = ficheDepuisLigne(l, { statutAxonaut: 'prospect' })
    if (est_ancien(f.nom)) { ecartes.anciens++; fiches.set(id, null); continue }
    fiches.set(id, f)
  }
  for (const [id, f] of fiches) if (f === null) fiches.delete(id)
  const tiers = [...fiches.values()]

  // 3. Classement des prospects : point de collecte ou vrai prospect.
  const payeurs = tiers.filter(t => t.classement === 'payeur')
  const facturables = tiers.filter(t => t.classement === 'payeur' || t.classement === 'client')
  const sirenConnus = new Set(facturables.map(t => t.siren).filter(Boolean))
  for (const t of tiers.filter(t => t.statut_axonaut === 'prospect')) {
    const c = t.champs_axonaut
    const exploitation = c.code_trackdechets || c.mode_collecte || c.zone || t.consignes
    const memeSiren = t.siren && sirenConnus.has(t.siren)
    t.classement = (exploitation || memeSiren || t.chantier) ? 'point_collecte' : 'prospect'
    t.classement_statut = 'suggere'
  }

  // 4. Rattachement des points de collecte à un payeur.
  //    a) même SIREN : un seul payeur « Facturé à », sinon un seul client
  //    b) sinon : le payeur au nom le plus proche, au-dessus du seuil
  const parSiren = (liste) => {
    const m = new Map()
    for (const t of liste) if (t.siren) m.set(t.siren, [...(m.get(t.siren) ?? []), t])
    return m
  }
  const payeursParSiren = parSiren(payeurs)
  const clientsParSiren = parSiren(tiers.filter(t => t.classement === 'client'))
  const trigPayeurs = payeurs.map(p => ({ p, tri: trigrammes(normaliserNom(p.nom, p.ville)) }))

  const rattachements = []
  const stats = { siren: 0, nom: 0, ambigu: 0, aucun: 0 }
  for (const t of tiers.filter(t => t.classement === 'point_collecte')) {
    const parS = t.siren ? (payeursParSiren.get(t.siren) ?? []) : []
    const parC = t.siren ? (clientsParSiren.get(t.siren) ?? []) : []
    if (parS.length === 1 || (parS.length === 0 && parC.length === 1)) {
      const p = parS[0] ?? parC[0]
      rattachements.push({ site: t.axonaut_id, payeur: p.axonaut_id, methode: 'siren', score: 1 })
      stats.siren++
      continue
    }
    // Plusieurs payeurs pour le même SIREN : on départage par le nom parmi eux.
    const candidats = parS.length > 1 ? trigPayeurs.filter(x => parS.includes(x.p)) : trigPayeurs
    const triSite = trigrammes(normaliserNom(t.nom, t.ville))
    let meilleur = null, second = 0
    for (const x of candidats) {
      const s = similarite(triSite, x.tri)
      if (!meilleur || s > meilleur.s) { second = meilleur?.s ?? 0; meilleur = { p: x.p, s } }
      else if (s > second) second = s
    }
    if (meilleur && meilleur.s >= SEUIL_SIMILARITE_NOM && meilleur.s - second >= 0.05) {
      rattachements.push({ site: t.axonaut_id, payeur: meilleur.p.axonaut_id, methode: 'nom', score: Math.round(meilleur.s * 100) / 100 })
      stats.nom++
    } else if (parS.length > 1 || (meilleur && meilleur.s >= SEUIL_SIMILARITE_NOM)) stats.ambigu++
    else stats.aucun++
  }

  // 5. Contacts : l'export contacts fait foi ; l'export clients complète
  //    pour les sociétés qui n'y figurent pas.
  const idsAvecContacts = new Set()
  const contacts = []
  const vus = new Set()
  for (const l of lignesContacts) {
    const c = contactDepuisLigne(l)
    if (!c || !fiches.has(c.tiers_axonaut_id)) continue
    if (c.axonaut_id && vus.has(c.axonaut_id)) continue
    if (c.axonaut_id) vus.add(c.axonaut_id)
    contacts.push(c)
    idsAvecContacts.add(c.tiers_axonaut_id)
  }
  for (const l of lignesClients) {
    if (idsAvecContacts.has(+l['Id de la société'])) continue
    const c = contactDepuisLigne(l)
    if (!c || (c.axonaut_id && vus.has(c.axonaut_id))) continue
    if (c.axonaut_id) vus.add(c.axonaut_id)
    contacts.push(c)
  }

  const entreprises = [...new Set(tiers.map(t => t.siren).filter(Boolean))].map(siren => ({ siren }))
  return { tiers, contacts, entreprises, rattachements, stats, ecartes, payeursParId: new Map(tiers.map(t => [t.axonaut_id, t])) }
}

// ---------------------------------------------------------------------------
// Aperçu
// ---------------------------------------------------------------------------
function apercu({ tiers, contacts, entreprises, rattachements, stats, ecartes, payeursParId }) {
  const n = f => tiers.filter(f).length
  const eur = v => Math.round(v).toLocaleString('fr-FR') + ' €'
  const ligne = (label, v) => console.log(`  ${label.padEnd(40)} ${v}`)

  console.log(`\nAPERÇU DE L'IMPORT — organisation « ${ORGANISATION.nom} » (rien n'est écrit)\n`)
  console.log(`Fiches importées : ${tiers.length}   (prospects « ancien / fermé » écartés : ${ecartes.anciens})`)
  ligne('payeurs « Facturé à »', n(t => t.classement === 'payeur'))
  ligne('clients (facturés et collectés)', n(t => t.classement === 'client'))
  ligne('points de collecte (suggérés)', n(t => t.classement === 'point_collecte'))
  ligne('  dont chantiers', n(t => t.classement === 'point_collecte' && t.chantier))
  ligne('vrais prospects (suggérés)', n(t => t.classement === 'prospect'))
  ligne('archives (clients « do not use »)', n(t => t.classement === 'archive'))
  console.log(`\nRattachement des ${n(t => t.classement === 'point_collecte')} points de collecte à un payeur`)
  ligne('par SIREN', stats.siren)
  ligne(`par le nom (similarité ≥ ${SEUIL_SIMILARITE_NOM})`, stats.nom)
  ligne('plusieurs payeurs possibles, à choisir', stats.ambigu)
  ligne('aucun payeur trouvé, à rattacher à la main', stats.aucun)
  console.log(`\nEntreprises (SIREN distincts)   ${entreprises.length}`)
  console.log(`Contacts                        ${contacts.length}   (avec email : ${contacts.filter(c => c.email).length}, avec poste : ${contacts.filter(c => c.fonction).length})`)
  console.log(`CA cumulé / CA de l'année       ${eur(tiers.reduce((a, t) => a + t.ca_total, 0))} / ${eur(tiers.reduce((a, t) => a + t.ca_annee, 0))}`)

  const exemples = (titre, liste) => {
    console.log(`\n${titre}`)
    liste.forEach(r => console.log(`  ${payeursParId.get(r.site).nom.slice(0, 42).padEnd(42)} → ${payeursParId.get(r.payeur).nom.slice(0, 48)}${r.methode === 'nom' ? `  (${r.score})` : ''}`))
  }
  exemples('Exemples de rattachement par SIREN', rattachements.filter(r => r.methode === 'siren').slice(0, 6))
  const parNom = rattachements.filter(r => r.methode === 'nom').sort((a, b) => a.score - b.score)
  exemples('Rattachements par le nom : les moins sûrs', parNom.slice(0, 8))
  exemples('Rattachements par le nom : les plus sûrs', parNom.slice(-5))
  console.log('\nExemples de vrais prospects')
  tiers.filter(t => t.classement === 'prospect').slice(0, 8).forEach(t => console.log(`  ${t.nom.slice(0, 50).padEnd(50)} ${t.code_postal ?? ''}`))
}

// ---------------------------------------------------------------------------
// Génération SQL
// ---------------------------------------------------------------------------
const q = v => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const qj = v => `${q(JSON.stringify(v))}::jsonb`
const b = v => v == null ? 'null' : String(v)

/** Découpe une liste en paquets, pour garder des instructions de taille raisonnable. */
const paquets = (liste, taille) => Array.from({ length: Math.ceil(liste.length / taille) }, (_, i) => liste.slice(i * taille, (i + 1) * taille))

/** Renvoie une liste d'instructions SQL, chacune exécutable seule et rejouable
 *  sans doublon (upserts). Pas de begin/commit : `supabase db query` ne les
 *  enregistre pas (voir CLAUDE.md). En cas de coupure, on relance tout. */
function genererSql({ tiers, contacts, entreprises, rattachements }) {
  const org = `(select id from public.organisations where code_org = ${q(ORGANISATION.code_org)})`
  const sql = []

  sql.push(`insert into public.organisations (nom, code_org) values (${q(ORGANISATION.nom)}, ${q(ORGANISATION.code_org)}) on conflict (code_org) do nothing;`)
  sql.push(`insert into public.sync_runs (organisation_id, source, lignes_lues) values (${org}, 'import_csv', ${tiers.length});`)

  for (const lot of paquets(entreprises, 1000)) {
    sql.push(`insert into public.entreprises (organisation_id, siren)
select ${org}, v.siren from (values
${lot.map(e => `  (${q(e.siren)})`).join(',\n')}
) as v(siren)
on conflict (organisation_id, siren) do nothing;`)
  }

  const cols = ['axonaut_id', 'statut_axonaut', 'classement', 'classement_statut', 'chantier', 'siret', 'siret_statut',
    'nom', 'adresse', 'code_postal', 'ville', 'pays', 'commercial_axonaut', 'actif', 'champs_axonaut', 'consignes',
    'ca_total', 'ca_annee', 'premiere_facture', 'derniere_facture']
  const proteges = new Set(['classement', 'classement_statut', 'chantier'])
  const miseAJour = [
    ...cols.filter(c => c !== 'axonaut_id' && !proteges.has(c)).map(c => `  ${c} = excluded.${c}`),
    // Un classement validé par un commercial n'est jamais écrasé.
    ...[...proteges].map(c => `  ${c} = case when public.tiers.classement_statut = 'valide' then public.tiers.${c} else excluded.${c} end`),
    '  synchro_le = excluded.synchro_le',
  ].join(',\n')
  for (const lot of paquets(tiers, 400)) {
    sql.push(`insert into public.tiers (organisation_id, ${cols.join(', ')}, synchro_le)
select ${org}, v.*, now() from (values
${lot.map(t => '  (' + [t.axonaut_id + '::bigint', q(t.statut_axonaut), q(t.classement), q(t.classement_statut), b(t.chantier) + '::boolean',
    q(t.siret), q(t.siret_statut), q(t.nom), q(t.adresse), q(t.code_postal), q(t.ville), q(t.pays),
    q(t.commercial_axonaut), b(t.actif) + '::boolean', qj(t.champs_axonaut), q(t.consignes), t.ca_total + '::numeric', t.ca_annee + '::numeric',
    q(t.premiere_facture) + '::date', q(t.derniere_facture) + '::date'].join(', ') + ')').join(',\n')}
) as v(${cols.join(', ')})
on conflict (organisation_id, axonaut_id) do update set
${miseAJour};`)
  }

  sql.push(`update public.tiers t set entreprise_id = e.id
from public.entreprises e
where t.organisation_id = ${org} and e.organisation_id = t.organisation_id
  and e.siren = left(t.siret, 9) and t.entreprise_id is distinct from e.id;`)

  // Rattachement des fiches au compte utilisateur du commercial, s'il existe déjà.
  sql.push(`update public.tiers t set commercial_id = u.id
from public.utilisateurs u
where t.organisation_id = ${org} and u.organisation_id = t.organisation_id
  and lower(u.email_axonaut) = t.commercial_axonaut and t.commercial_id is distinct from u.id;`)

  for (const lot of paquets(contacts.filter(c => c.axonaut_id), 800)) {
    sql.push(`insert into public.contacts (organisation_id, tiers_id, axonaut_id, civilite, prenom, nom, fonction, email, telephone, mobile, consentement_suivi)
select ${org}, t.id, c.axonaut_id, c.civilite, c.prenom, c.nom, c.fonction, c.email, c.telephone, c.mobile, c.consentement_suivi from (values
${lot.map(c => `  (${c.tiers_axonaut_id}, ${c.axonaut_id}::bigint, ${q(c.civilite)}, ${q(c.prenom)}, ${q(c.nom)}, ${q(c.fonction)}, ${q(c.email)}, ${q(c.telephone)}, ${q(c.mobile)}, ${b(c.consentement_suivi)}::boolean)`).join(',\n')}
) as c(tiers_axonaut_id, axonaut_id, civilite, prenom, nom, fonction, email, telephone, mobile, consentement_suivi)
join public.tiers t on t.organisation_id = ${org} and t.axonaut_id = c.tiers_axonaut_id
on conflict (organisation_id, axonaut_id) where axonaut_id is not null do update set
  tiers_id = excluded.tiers_id, civilite = excluded.civilite, prenom = excluded.prenom, nom = excluded.nom,
  fonction = excluded.fonction, email = excluded.email, telephone = excluded.telephone, mobile = excluded.mobile,
  consentement_suivi = excluded.consentement_suivi;`)
  }

  for (const lot of paquets(rattachements, 1000)) {
    sql.push(`update public.tiers s set payeur_id = p.id, rattachement_statut = 'suggere'
from (values
${lot.map(r => `  (${r.site}, ${r.payeur})`).join(',\n')}
) as v(site, payeur)
join public.tiers p on p.organisation_id = ${org} and p.axonaut_id = v.payeur
where s.organisation_id = ${org} and s.axonaut_id = v.site and s.rattachement_statut is null;`)
  }

  sql.push(`update public.sync_runs set fin = now(), statut = 'ok', lignes_ecrites = ${tiers.length}
where id = (select id from public.sync_runs where organisation_id = ${org} and statut = 'en_cours' order by debut desc limit 1);`)
  return sql
}

// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const [fichierClients, fichierContacts] = args
if (!fichierClients || !fichierContacts) {
  console.error('Usage : node scripts/import-axonaut-csv.js <clients.csv> <contacts.csv> [--sql data/<dossier>]')
  process.exit(1)
}
const resultat = transformer(lireCsv(fichierClients), lireCsv(fichierContacts))
apercu(resultat)
const iSql = args.indexOf('--sql')
if (iSql !== -1) {
  const sortie = args[iSql + 1]
  if (!sortie?.startsWith('data/')) { console.error('\nLe SQL contient des données réelles : il doit être écrit dans data/.'); process.exit(1) }
  fs.rmSync(sortie, { recursive: true, force: true })
  fs.mkdirSync(sortie, { recursive: true })
  const instructions = genererSql(resultat)
  instructions.forEach((texte, i) => fs.writeFileSync(`${sortie}/${String(i + 1).padStart(2, '0')}.sql`, texte + '\n'))
  console.log(`\n${instructions.length} fichiers SQL écrits dans ${sortie}/, à lancer dans l'ordre.`)
}
