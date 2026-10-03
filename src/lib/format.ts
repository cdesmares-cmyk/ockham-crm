import type { Classement } from '../types'

const formatEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function euros(v: number | null | undefined) {
  return formatEuro.format(Number(v ?? 0))
}

/** 1 234 567 € → « 1,2 M€ » ; 12 345 € → « 12 k€ » */
export function eurosCourt(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M€`
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 1000).toLocaleString('fr-FR')} k€`
  return euros(v)
}

/** AAAA-MM-JJ → JJ/MM/AAAA */
export function dateFr(iso: string | null | undefined) {
  if (!iso) return '—'
  const [a, m, j] = iso.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

/** « mbouillod@elise.com.fr » → « mbouillod » */
export function nomCommercial(email: string | null | undefined) {
  return email ? email.split('@')[0] : '—'
}

export const LIBELLE_CLASSEMENT: Record<Classement, string> = {
  payeur: 'Payeur',
  client: 'Client',
  point_collecte: 'Point de collecte',
  prospect: 'Prospect',
  archive: 'Archive',
}

export const STYLE_CLASSEMENT: Record<Classement, string> = {
  payeur: 'bg-slate-100 text-slate-700',
  client: 'bg-ockham-teal-muted text-ockham-teal-dark',
  point_collecte: 'bg-ockham-copper-light text-ockham-copper-dark',
  prospect: 'bg-sky-50 text-sky-700',
  archive: 'bg-gray-100 text-gray-400',
}

/** Libellés lisibles des champs personnalisés Axonaut. */
export const LIBELLE_CHAMP_AXONAUT: Record<string, string> = {
  zone: 'Zone',
  categorisation: 'Catégorisation',
  mode_collecte: 'Mode de collecte',
  type_contrat: 'Type de contrat',
  secteur: 'Secteur',
  categorie_entreprise: 'Taille',
  sous_traitance: 'Sous-traitance',
  plateforme: 'Plateforme de facturation',
  soumis_bdc: 'Soumis à BDC',
  mode_envoi_facture: 'Envoi des factures',
  code_trackdechets: 'Code Track Déchets',
  public_prive: 'Public / privé',
  numero_client: 'N° client',
  code_tiers: 'Code tiers',
  id_interne: 'Id interne',
  origine: 'Origine',
  dernier_rdv_suivi: 'Dernier RDV de suivi',
  adresse_pdp: 'Adresse PDP',
  marque_do_not_use: '« Do not use »',
}
