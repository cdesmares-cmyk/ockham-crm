import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { TiersLigne } from '../types'

const COLONNES_LIGNE = [
  'id', 'nom', 'classement', 'classement_statut', 'chantier', 'chantier_termine', 'siret', 'code_postal', 'ville',
  'commercial_id', 'commercial_axonaut', 'ca_annee', 'ca_total', 'derniere_facture', 'payeur_id',
  'rattachement_statut', 'actif', 'statut_axonaut',
].join(', ')

/** L'API Supabase renvoie au plus 1 000 lignes par requête : on enchaîne les pages. */
const TAILLE_PAGE = 1000

interface ContexteDonnees {
  tiers: TiersLigne[]
  parId: Map<string, TiersLigne>
  chargement: boolean
  erreur: string | null
  recharger: () => Promise<void>
  /** Applique une modification déjà enregistrée en base à la copie locale. */
  majLocale: (id: string, modif: Partial<TiersLigne>) => void
}

const ContexteDonnees = createContext<ContexteDonnees>({
  tiers: [],
  parId: new Map(),
  chargement: false,
  erreur: null,
  recharger: async () => {},
  majLocale: () => {},
})

export function FournisseurDonnees({ children }: { children: ReactNode }) {
  const { profil } = useAuth()
  const [tiers, setTiers] = useState<TiersLigne[]>([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const recharger = useCallback(async () => {
    if (!supabase || !profil) { setTiers([]); return }
    setChargement(true)
    setErreur(null)
    const lignes: TiersLigne[] = []
    for (let debut = 0; ; debut += TAILLE_PAGE) {
      const { data, error } = await supabase
        .from('tiers')
        .select(COLONNES_LIGNE)
        .order('nom')
        .order('id')
        .range(debut, debut + TAILLE_PAGE - 1)
      if (error) {
        console.error('Chargement des comptes impossible', error)
        setErreur('Les comptes n\'ont pas pu être chargés. Rechargez la page.')
        setChargement(false)
        return
      }
      const page = (data ?? []) as unknown as TiersLigne[]
      lignes.push(...page.map(t => ({ ...t, ca_annee: Number(t.ca_annee), ca_total: Number(t.ca_total) })))
      if (page.length < TAILLE_PAGE) break
    }
    setTiers(lignes)
    setChargement(false)
  }, [profil])

  // Chargement déclenché par la connexion (changement de profil) : c'est bien
  // une synchronisation avec l'extérieur, le cas prévu pour un effet.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void recharger() }, [recharger])

  const majLocale = useCallback((id: string, modif: Partial<TiersLigne>) => {
    setTiers(liste => liste.map(t => (t.id === id ? { ...t, ...modif } : t)))
  }, [])

  const parId = useMemo(() => new Map(tiers.map(t => [t.id, t])), [tiers])

  return (
    <ContexteDonnees.Provider value={{ tiers, parId, chargement, erreur, recharger, majLocale }}>
      {children}
    </ContexteDonnees.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- motif contexte + hook
export function useDonnees() { return useContext(ContexteDonnees) }
