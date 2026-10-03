import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lecture des variables d'environnement injectées par Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Faux tant que .env.local n'est pas rempli. En local, l'app propose alors le
 *  mode aperçu ; en production, la page de connexion affiche une erreur. */
export const supabaseConfigure = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = supabaseConfigure
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null
