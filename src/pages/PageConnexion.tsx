import { useState } from 'react'
import { supabase, supabaseConfigure } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(76,197,187,0.12)', border: '1.5px solid rgba(76,197,187,0.3)' }}
      >
        <span className="text-2xl font-black text-ockham-teal leading-none select-none">O</span>
      </div>
      <div>
        <p className="text-base font-black tracking-widest text-white uppercase leading-none">OCKHAM</p>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-ockham-teal mt-0.5">CRM commercial</p>
      </div>
    </div>
  )
}

function LogoGoogle() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function PageConnexion() {
  const { ouvrirApercu } = useAuth()
  const [email, setEmail]           = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur]         = useState<string | null>(null)

  async function connexionGoogle() {
    if (!supabase) return
    setErreur(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setErreur('La connexion Google a échoué. Réessayez.')
  }

  async function connexionEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setChargement(true)
    setErreur(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    if (error) setErreur('Email ou mot de passe incorrect.')
    setChargement(false)
  }

  return (
    <div className="min-h-screen flex">

      {/* Panneau gauche — identité de marque */}
      <div
        className="hidden lg:flex flex-col w-[480px] flex-shrink-0 px-12 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0E1A2B 0%, #142840 100%)' }}
      >
        <div className="absolute pointer-events-none" style={{ right: -100, top: -100, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(76,197,187,0.2), transparent)' }} />
        <div className="absolute pointer-events-none" style={{ left: -80, bottom: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(76,197,187,0.12), transparent)' }} />

        <Logo />

        <div className="mt-auto relative z-10">
          <h2 className="text-2xl font-bold text-white leading-snug mb-4">
            Votre portefeuille,<br />
            <span className="text-ockham-teal">vos prochains clients.</span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs">
            Suivi des comptes, rendez-vous, relances et prospection. Les données viennent de votre facturation.
          </p>
        </div>

        <p className="text-[11px] text-white/20 mt-10 relative z-10">
          © 2026 OCKHAM Finance · <a href="https://www.ockham-finance.com/" className="hover:text-white/40 transition-colors">ockham-finance.com</a>
        </p>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F8FAFC]">

        <div className="lg:hidden mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-ockham-navy">
            <span className="text-2xl font-black text-ockham-teal leading-none">O</span>
          </div>
          <p className="text-center text-base font-black tracking-widest text-ockham-navy uppercase">OCKHAM CRM</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-base font-semibold text-gray-900 mb-1">Connexion</h1>
            <p className="text-xs text-gray-400 mb-6">Accédez à votre espace commercial.</p>

            {!supabaseConfigure && (
              <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3">
                <span className="text-amber-500 text-sm mt-0.5 flex-shrink-0">⚠</span>
                <p className="text-sm text-amber-800">Base non configurée : remplissez <code className="text-xs">.env.local</code>.</p>
              </div>
            )}

            <button
              type="button"
              onClick={connexionGoogle}
              disabled={!supabaseConfigure}
              className="w-full flex items-center justify-center gap-2.5 border border-gray-200 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <LogoGoogle /> Continuer avec Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-[11px] text-gray-300 uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <form onSubmit={connexionEmail} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="vous@domaine.fr"
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-ockham-teal focus:ring-2 focus:ring-ockham-teal/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mot de passe</label>
                <input
                  type="password" required value={motDePasse} onChange={e => setMotDePasse(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-ockham-teal focus:ring-2 focus:ring-ockham-teal/10 transition-all"
                />
              </div>

              {erreur && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3">
                  <span className="text-red-400 text-sm mt-0.5 flex-shrink-0">⚠</span>
                  <p className="text-sm text-red-700">{erreur}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={chargement || !supabaseConfigure}
                className="w-full bg-ockham-teal text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-ockham-teal-dark disabled:opacity-50 transition-colors mt-1"
              >
                {chargement ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </div>

          {/* Visible uniquement en local (npm run dev), jamais en production */}
          {import.meta.env.DEV && (
            <button
              onClick={ouvrirApercu}
              className="w-full mt-4 text-xs text-gray-400 hover:text-ockham-teal-dark border border-dashed border-gray-200 rounded-lg px-4 py-2.5 transition-colors"
            >
              Ouvrir l'aperçu local, sans données
            </button>
          )}

          <p className="text-center text-[11px] text-gray-300 mt-6">
            © 2026 OCKHAM Finance ·{' '}
            <a href="https://www.ockham-finance.com/" className="hover:text-gray-500 transition-colors">ockham-finance.com</a>
          </p>
        </div>
      </div>
    </div>
  )
}
