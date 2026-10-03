import type { Profil } from '../contexts/AuthContext'
import type { TiersLigne } from '../types'

/** La fiche fait partie du portefeuille de la personne connectée : par le lien
 *  au compte utilisateur, ou à défaut par l'email « Commercial responsable »
 *  d'Axonaut. */
export function estDansMonPortefeuille(t: TiersLigne, profil: Profil | null) {
  if (!profil) return false
  if (t.commercial_id) return t.commercial_id === profil.id
  const email = (profil.email_axonaut ?? profil.email).toLowerCase()
  return t.commercial_axonaut === email
}

/** Département à partir du code postal (2A/2B pour la Corse non gérés : rares ici). */
export function departement(cp: string | null) {
  return cp && /^\d{5}$/.test(cp) ? cp.slice(0, 2) : null
}
