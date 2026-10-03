// Import de l'export « clients » Axonaut (CSV) vers Ockham CRM.
//
// Usage :
//   node scripts/import-axonaut-csv.js <export.csv>                  → aperçu seul, rien n'est écrit
//   node scripts/import-axonaut-csv.js <export.csv> --sql <sortie>   → génère le SQL d'import (data/, jamais dans Git)
//
// Le SQL généré est idempotent : relancé, il met à jour les fiches au lieu de
// les dupliquer (clé : organisation + id Axonaut). Il ne touche jamais aux
// rattachements déjà validés par un commercial.

import fs from 'node:fs'

const ORGANISATION = { code_org: 'ELISE-LYON', nom: 'Elise Lyon' }

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
    } else if (c === '"') guillemets = true
    else if (c === ';') { ligne.push(champ); champ = '' }
    else if (c === '\n') { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); ligne = []; champ = '' }
    else champ += c
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne) }
  const entetes = lignes.shift()
  // « TVA intracommunautaire » apparaît deux fois : on garde la première.
  return lignes.filter(l => l.length > 1).map(l => {
    const o = {}
    entetes.forEach((h, i) => { if (!(h in o)) o[h.trim()] = (l[i] ?? '').trim() })
    return o
  })
}

// ---------------------------------------------------------------------------
// Nettoyage
// ---------------------------------------------------------------------------
/** Axonaut exporte des valeurs vides sous la forme "", "-" ou des espaces. */
function propre(v) {
  if (v == null) return null
  const s = String(v).replace(/\s*\|\s*/g, ' | ').trim()
  if (s === '' || s === '-' || s === '""' || s === '0000000000') return null
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
  if (!s) return { siret: null, statut: 'vide' }
  if (!/^\d{14}$/.test(s)) return { siret: null, statut: 'cle_invalide' }
  if (/^(\d)\1+$/.test(s)) return { siret: null, statut: 'factice' }
  // La Poste (SIREN 356000000) déroge au contrôle de Luhn.
  if (!luhn(s) && !s.startsWith('356000000')) return { siret: null, statut: 'cle_invalide' }
  return { siret: s, statut: 'valide' }
}

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
}

// ---------------------------------------------------------------------------
// Transformation
// ---------------------------------------------------------------------------
function transformer(lignes) {
  const tiers = []
  const contacts = []
  const entreprises = new Map()

  for (const l of lignes) {
    const { siret, statut } = controlerSiret(l['Siret'])
    const nom = propre(l['Société']) ?? '(sans nom)'
    const factureA = /^factur[ée] à\s*:/i.test(nom)
    const caTotal = montant(l['turnover'])
    const actif = { Actif: true, Inactif: false }[propre(l['Actif / Inactif'])] ?? null

    const champs = {}
    for (const [col, cle] of Object.entries(CHAMPS_PERSO)) {
      const v = propre(l[col])
      if (v != null) champs[cle] = v
    }
    if (/do not use/i.test(nom)) champs.marque_do_not_use = true

    if (siret && !entreprises.has(siret.slice(0, 9))) entreprises.set(siret.slice(0, 9), { siren: siret.slice(0, 9) })

    tiers.push({
      axonaut_id: +l['Id de la société'],
      siret, siret_statut: statut,
      siren: siret ? siret.slice(0, 9) : null,
      nom,
      adresse: propre(l['Rue']),
      code_postal: propre(l['Code postal']),
      ville: propre(l['Ville']),
      pays: propre(l['Pays']),
      // Une fiche « Facturé à » est un payeur pur. Les autres sont des points
      // de collecte, et aussi des payeurs si elles ont déjà été facturées.
      est_payeur: factureA || caTotal > 0,
      est_point_collecte: !factureA,
      commercial_axonaut: propre(l['Commercial responsable'])?.toLowerCase() ?? null,
      actif,
      champs_axonaut: champs,
      consignes: propre(l['Commentaires']),
      ca_total: caTotal,
      ca_annee: montant(l['turnoverThisYear']),
      premiere_facture: dateIso(l['firstInvoiceDate']),
      derniere_facture: dateIso(l['lastInvoiceDate']),
    })

    const email = propre(l['Email du contact'])
    if (email && !/@example\.com$/i.test(email)) {
      contacts.push({
        axonaut_id: +l['Id du contact'] || null,
        tiers_axonaut_id: +l['Id de la société'],
        prenom: propre(l['Prénom du contact']),
        nom: propre(l['Nom du contact']),
        email: email.toLowerCase(),
        telephone: propre(l['Téléphone fixe']),
        mobile: propre(l['Téléphone portable']),
      })
    }
  }

  // Suggestions de rattachement : un point de collecte jamais facturé, dont
  // le SIREN porte exactement UNE fiche « Facturé à ». S'il y en a plusieurs,
  // on ne devine pas : le commercial choisira.
  const payeursParSiren = new Map()
  for (const t of tiers) {
    if (t.siren && t.est_payeur && !t.est_point_collecte) {
      payeursParSiren.set(t.siren, [...(payeursParSiren.get(t.siren) ?? []), t])
    }
  }
  const suggestions = []
  let ambigus = 0
  for (const t of tiers) {
    if (!t.est_point_collecte || t.est_payeur || !t.siren) continue
    const candidats = payeursParSiren.get(t.siren) ?? []
    if (candidats.length === 1) suggestions.push({ site: t.axonaut_id, payeur: candidats[0].axonaut_id })
    else if (candidats.length > 1) ambigus++
  }

  return { tiers, contacts, entreprises: [...entreprises.values()], suggestions, ambigus }
}

// ---------------------------------------------------------------------------
// Aperçu
// ---------------------------------------------------------------------------
function apercu({ tiers, contacts, entreprises, suggestions, ambigus }) {
  const n = f => tiers.filter(f).length
  const eur = v => Math.round(v).toLocaleString('fr-FR') + ' €'
  const parStatut = s => n(t => t.siret_statut === s)
  const commerciaux = new Map()
  for (const t of tiers) {
    const k = t.commercial_axonaut ?? '(aucun)'
    const c = commerciaux.get(k) ?? { fiches: 0, ca: 0 }
    c.fiches++; c.ca += t.ca_annee
    commerciaux.set(k, c)
  }

  console.log(`\nAPERÇU DE L'IMPORT — organisation « ${ORGANISATION.nom} » (rien n'est écrit)\n`)
  console.log(`Fiches (tiers)                 ${tiers.length}`)
  console.log(`  payeurs « Facturé à »        ${n(t => t.est_payeur && !t.est_point_collecte)}`)
  console.log(`  payeur + point de collecte   ${n(t => t.est_payeur && t.est_point_collecte)}`)
  console.log(`  point de collecte seul       ${n(t => !t.est_payeur && t.est_point_collecte)}`)
  console.log(`  marquées « do not use »      ${n(t => t.champs_axonaut.marque_do_not_use)}`)
  console.log(`  actives / inactives / ?      ${n(t => t.actif === true)} / ${n(t => t.actif === false)} / ${n(t => t.actif === null)}`)
  console.log(`SIRET valides / vides / factices / clé invalide   ${parStatut('valide')} / ${parStatut('vide')} / ${parStatut('factice')} / ${parStatut('cle_invalide')}`)
  console.log(`Entreprises (SIREN distincts)  ${entreprises.length}`)
  console.log(`Contacts avec email            ${contacts.length}`)
  console.log(`Rattachements suggérés         ${suggestions.length}  (+ ${ambigus} sites avec plusieurs payeurs possibles, à choisir à la main)`)
  console.log(`CA cumulé / CA de l'année      ${eur(tiers.reduce((a, t) => a + t.ca_total, 0))} / ${eur(tiers.reduce((a, t) => a + t.ca_annee, 0))}`)
  console.log(`\nCommerciaux Axonaut (à relier aux comptes utilisateurs)`)
  ;[...commerciaux.entries()].sort((a, b) => b[1].ca - a[1].ca)
    .forEach(([k, v]) => console.log(`  ${k.padEnd(34)} ${String(v.fiches).padStart(4)} fiches   ${eur(v.ca).padStart(12)} cette année`))

  const champs = new Map()
  for (const t of tiers) for (const k of Object.keys(t.champs_axonaut)) champs.set(k, (champs.get(k) ?? 0) + 1)
  console.log(`\nChamps personnalisés conservés`)
  ;[...champs.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v} fiches`))
}

// ---------------------------------------------------------------------------
// Génération SQL
// ---------------------------------------------------------------------------
const q = v => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const qj = v => `${q(JSON.stringify(v))}::jsonb`

function genererSql({ tiers, contacts, entreprises, suggestions }) {
  const org = `(select id from public.organisations where code_org = ${q(ORGANISATION.code_org)})`
  const out = []
  out.push('-- Import Axonaut (CSV) généré par scripts/import-axonaut-csv.js. Données réelles : ne pas commiter.')
  out.push('begin;')
  out.push(`insert into public.organisations (nom, code_org) values (${q(ORGANISATION.nom)}, ${q(ORGANISATION.code_org)}) on conflict (code_org) do nothing;`)
  out.push(`insert into public.sync_runs (organisation_id, source, lignes_lues) values (${org}, 'import_csv', ${tiers.length});`)

  out.push('insert into public.entreprises (organisation_id, siren) values')
  out.push(entreprises.map(e => `  (${org}, ${q(e.siren)})`).join(',\n'))
  out.push('on conflict (organisation_id, siren) do nothing;')

  const cols = ['axonaut_id', 'siret', 'siret_statut', 'nom', 'adresse', 'code_postal', 'ville', 'pays', 'est_payeur',
    'est_point_collecte', 'commercial_axonaut', 'actif', 'champs_axonaut', 'consignes', 'ca_total', 'ca_annee',
    'premiere_facture', 'derniere_facture']
  out.push(`insert into public.tiers (organisation_id, ${cols.join(', ')}, synchro_le) values`)
  out.push(tiers.map(t => '  (' + [org, t.axonaut_id, q(t.siret), q(t.siret_statut), q(t.nom), q(t.adresse), q(t.code_postal),
    q(t.ville), q(t.pays), t.est_payeur, t.est_point_collecte, q(t.commercial_axonaut), t.actif ?? 'null',
    qj(t.champs_axonaut), q(t.consignes), t.ca_total, t.ca_annee, q(t.premiere_facture), q(t.derniere_facture), 'now()'].join(', ') + ')').join(',\n'))
  out.push('on conflict (organisation_id, axonaut_id) do update set')
  out.push(cols.filter(c => c !== 'axonaut_id').map(c => `  ${c} = excluded.${c}`).join(',\n') + ',\n  synchro_le = excluded.synchro_le;')

  // Lien fiche → entreprise (SIREN)
  out.push(`update public.tiers t set entreprise_id = e.id
from public.entreprises e
where t.organisation_id = ${org} and e.organisation_id = t.organisation_id
  and e.siren = left(t.siret, 9) and t.entreprise_id is distinct from e.id;`)

  // Contacts : on remplace ceux issus d'Axonaut, on garde ceux saisis dans le CRM
  out.push('insert into public.contacts (organisation_id, tiers_id, axonaut_id, prenom, nom, email, telephone, mobile)')
  out.push('select ' + org + ', t.id, c.axonaut_id, c.prenom, c.nom, c.email, c.telephone, c.mobile from (values')
  out.push(contacts.map(c => `  (${c.tiers_axonaut_id}, ${c.axonaut_id ?? 'null::bigint'}, ${q(c.prenom)}, ${q(c.nom)}, ${q(c.email)}, ${q(c.telephone)}, ${q(c.mobile)})`).join(',\n'))
  out.push(`) as c(tiers_axonaut_id, axonaut_id, prenom, nom, email, telephone, mobile)
join public.tiers t on t.organisation_id = ${org} and t.axonaut_id = c.tiers_axonaut_id
on conflict (organisation_id, axonaut_id) where axonaut_id is not null do update set
  tiers_id = excluded.tiers_id, prenom = excluded.prenom, nom = excluded.nom, email = excluded.email,
  telephone = excluded.telephone, mobile = excluded.mobile;`)

  // Suggestions de rattachement : jamais sur un rattachement déjà traité
  if (suggestions.length) {
    out.push(`update public.tiers s set payeur_id = p.id, rattachement_statut = 'suggere'
from (values
${suggestions.map(x => `  (${x.site}, ${x.payeur})`).join(',\n')}
) as v(site, payeur)
join public.tiers p on p.organisation_id = ${org} and p.axonaut_id = v.payeur
where s.organisation_id = ${org} and s.axonaut_id = v.site and s.rattachement_statut is null;`)
  }

  out.push(`update public.sync_runs set fin = now(), statut = 'ok', lignes_ecrites = ${tiers.length}
where id = (select id from public.sync_runs where organisation_id = ${org} and statut = 'en_cours' order by debut desc limit 1);`)
  out.push('commit;')
  return out.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
const [fichier, option, sortie] = process.argv.slice(2)
if (!fichier) {
  console.error('Usage : node scripts/import-axonaut-csv.js <export.csv> [--sql <sortie.sql>]')
  process.exit(1)
}
const resultat = transformer(lireCsv(fichier))
apercu(resultat)
if (option === '--sql') {
  if (!sortie?.startsWith('data/')) { console.error('\nLe SQL contient des données réelles : il doit être écrit dans data/.'); process.exit(1) }
  fs.writeFileSync(sortie, genererSql(resultat))
  console.log(`\nSQL écrit dans ${sortie}`)
}
