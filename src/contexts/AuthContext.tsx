import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../types'

/** Identité affichée dans l'interface. */
interface Identite {
  email: string
  nomAffiche: string
  initiales: string
}

/** Fiche `utilisateurs` de la personne connectée. Nulle si le compte n'est
 *  rattaché à aucune organisation : le RLS ne lui montre alors aucune donnée. */
export interface Profil {
  id: string
  role: Role
  prenom: string | null
  nom: string | null
  email: string
  email_axonaut: string | null
  organisation_id: string
  nom_organisation: string
}

interface ContexteAuth {
  session: Session | null
  identite: Identite | null
  profil: Profil | null
  /** Mode aperçu : écrans visibles sans base, uniquement en local (npm run dev). */
  apercu: boolean
  chargement: boolean
  ouvrirApercu: () => void
  deconnexion: () => Promise<void>
}

const ContexteAuth = createContext<ContexteAuth>({
  session: null,
  identite: null,
  profil: null,
  apercu: false,
  chargement: true,
  ouvrirApercu: () => {},
  deconnexion: async () => {},
})

function initialesDe(nom: string) {
  return nom
    .split(/[\s.\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(m => m[0]!.toUpperCase())
    .join('') || '?'
}

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)
  const [apercu, setApercu] = useState(false)
  const [chargement, setChargement] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    const client = supabase

    async function chargerProfil(s: Session | null) {
      if (!s) { setProfil(null); return }
      const { data, error } = await client
        .from('utilisateurs')
        .select('id, role, prenom, nom, email, email_axonaut, organisation_id, organisations(nom)')
        .eq('id', s.user.id)
        .maybeSingle()
      // Signalée, jamais avalée : un profil vide rend tous les écrans vides
      // sans autre symptôme.
      if (error) console.error('Chargement du profil impossible', error)
      if (!data) { setProfil(null); return }
      const org = data.organisations as unknown as { nom: string } | null
      setProfil({ ...(data as Omit<Profil, 'nom_organisation'>), nom_organisation: org?.nom ?? '' })
    }

    client.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await chargerProfil(data.session)
      setChargement(false)
    })
    const { data } = client.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // Hors du callback : supabase-js déconseille d'y attendre une requête.
      setTimeout(() => { void chargerProfil(s) }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  let identite: Identite | null = null
  if (session?.user.email) {
    const nom = [profil?.prenom, profil?.nom].filter(Boolean).join(' ') || session.user.email.split('@')[0]
    identite = { email: session.user.email, nomAffiche: nom, initiales: initialesDe(nom) }
  } else if (apercu) {
    identite = { email: 'apercu@local', nomAffiche: 'Mode aperçu', initiales: 'AP' }
  }

  function ouvrirApercu() {
    // Garde-fou : jamais d'aperçu dans un build de production.
    if (import.meta.env.DEV) setApercu(true)
  }

  async function deconnexion() {
    setApercu(false)
    setProfil(null)
    if (supabase) await supabase.auth.signOut()
  }

  return (
    <ContexteAuth.Provider value={{ session, identite, profil, apercu, chargement, ouvrirApercu, deconnexion }}>
      {children}
    </ContexteAuth.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- motif contexte + hook, comme Lettrage
export function useAuth() { return useContext(ContexteAuth) }
