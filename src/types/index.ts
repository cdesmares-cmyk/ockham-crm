export type Classement = 'payeur' | 'client' | 'point_collecte' | 'prospect' | 'archive'
export type Role = 'superadmin' | 'admin' | 'manager' | 'commercial'

/** Ligne légère de `tiers`, chargée pour toute l'organisation (listes, filtres). */
export interface TiersLigne {
  id: string
  nom: string
  classement: Classement
  classement_statut: 'suggere' | 'valide'
  chantier: boolean
  chantier_termine: boolean
  siret: string | null
  code_postal: string | null
  ville: string | null
  commercial_id: string | null
  commercial_axonaut: string | null
  ca_annee: number
  ca_total: number
  derniere_facture: string | null
  payeur_id: string | null
  rattachement_statut: 'suggere' | 'valide' | 'rejete' | null
  actif: boolean | null
  statut_axonaut: 'client' | 'prospect' | null
}

/** Fiche complète, chargée à l'ouverture d'un compte. */
export interface TiersComplet extends TiersLigne {
  axonaut_id: number
  entreprise_id: string | null
  siret_statut: string | null
  adresse: string | null
  pays: string | null
  champs_axonaut: Record<string, string | boolean>
  consignes: string | null
  premiere_facture: string | null
  synchro_le: string | null
}

export interface Entreprise {
  siren: string
  raison_sociale: string | null
  naf: string | null
  libelle_naf: string | null
  tranche_effectif: string | null
  etat: string | null
}

export interface Contact {
  id: string
  civilite: string | null
  prenom: string | null
  nom: string | null
  fonction: string | null
  email: string | null
  telephone: string | null
  mobile: string | null
  opposition: boolean
}
