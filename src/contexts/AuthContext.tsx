import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** Identité affichée dans l'interface. Le rôle et l'organisation viendront de
 *  la table `utilisateurs` en V1 ; d'ici là, seule la session existe. */
interface Identite {
  email: string
  nomAffiche: string
  initiales: string
}

interface ContexteAuth {
  session: Session | null
  identite: Identite | null
  /** Mode aperçu : écrans visibles sans base, uniquement en local (npm run dev). */
  apercu: boolean
  chargement: boolean
  ouvrirApercu: () => void
  deconnexion: () => Promise<void>
}

const ContexteAuth = createContext<ContexteAuth>({
  session: null,
  identite: null,
  apercu: false,
  chargement: true,
  ouvrirApercu: () => {},
  deconnexion: async () => {},
})

function identiteDepuisEmail(email: string, nomComplet?: string): Identite {
  const nom = nomComplet?.trim() || email.split('@')[0]
  const initiales = nom
    .split(/[\s.\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(m => m[0]!.toUpperCase())
    .join('')
  return { email, nomAffiche: nom, initiales: initiales || '?' }
}

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [apercu, setApercu] = useState(false)
  const [chargement, setChargement] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChargement(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const identite = session?.user.email
    ? identiteDepuisEmail(session.user.email, session.user.user_metadata?.full_name as string | undefined)
    : apercu
      ? { email: 'apercu@local', nomAffiche: 'Mode aperçu', initiales: 'AP' }
      : null

  function ouvrirApercu() {
    // Garde-fou : jamais d'aperçu dans un build de production.
    if (import.meta.env.DEV) setApercu(true)
  }

  async function deconnexion() {
    setApercu(false)
    if (supabase) await supabase.auth.signOut()
  }

  return (
    <ContexteAuth.Provider value={{ session, identite, apercu, chargement, ouvrirApercu, deconnexion }}>
      {children}
    </ContexteAuth.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- motif contexte + hook, comme Lettrage
export function useAuth() { return useContext(ContexteAuth) }
