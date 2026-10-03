import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  IcAdmin, IcAgenda, IcCampagnes, IcComptesClients, IcDeconnexion, IcProspects, IcTableauDeBord,
} from './Icones'

const NAV_PRINCIPALE = [
  { chemin: '/tableau-de-bord', label: 'Tableau de bord', icone: <IcTableauDeBord /> },
  { chemin: '/comptes-clients', label: 'Comptes clients', icone: <IcComptesClients /> },
  { chemin: '/prospects',       label: 'Prospects',       icone: <IcProspects /> },
  { chemin: '/agenda',          label: 'Agenda',          icone: <IcAgenda /> },
  { chemin: '/campagnes',       label: 'Campagnes',       icone: <IcCampagnes /> },
]

const NAV_OUTILS = [
  { chemin: '/admin', label: 'Équipe & réglages', icone: <IcAdmin /> },
]

function LienNav({ chemin, label, icone }: { chemin: string; label: string; icone: React.ReactNode }) {
  return (
    <NavLink
      to={chemin}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors border ${
          isActive
            ? 'bg-ockham-teal/[0.12] text-ockham-teal border-ockham-teal/20'
            : 'text-white/65 border-transparent hover:bg-white/[0.05] hover:text-white/90'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-ockham-teal' : 'text-white/55'}>{icone}</span>
          {label}
        </>
      )}
    </NavLink>
  )
}

export function Layout() {
  const { identite, apercu, deconnexion } = useAuth()

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">

      {/* ── BARRE LATÉRALE ── */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col h-screen bg-ockham-navy">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/[0.06]">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-[1.1rem] flex-shrink-0"
            style={{ background: 'rgba(76,197,187,0.1)', color: '#4CC5BB', border: '1.5px solid rgba(76,197,187,0.35)' }}
          >O</div>
          <div className="leading-none">
            <span className="text-white font-bold text-[15px] tracking-[0.06em]">OCKHAM</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-ockham-teal mt-1">CRM</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 px-2.5 pt-1 pb-1.5">
            Navigation
          </p>
          {NAV_PRINCIPALE.map(o => <LienNav key={o.chemin} {...o} />)}

          <div className="h-px bg-white/[0.06] mx-1 my-2" />
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40 px-2.5 pb-1.5">
            Outils
          </p>
          {NAV_OUTILS.map(o => <LienNav key={o.chemin} {...o} />)}
        </nav>

        {/* Bas : identité + déconnexion */}
        <div className="border-t border-white/[0.06] px-2 py-3">
          {apercu && (
            <div className="mx-1 mb-2 px-2.5 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/40 text-[11px] font-semibold text-amber-400 text-center">
              Aperçu local, sans données
            </div>
          )}
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <div className="w-7 h-7 rounded-full bg-ockham-teal/15 text-ockham-teal text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              {identite?.initiales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-[12px] font-semibold truncate">{identite?.nomAffiche}</p>
              <p className="text-white/35 text-[10px] truncate">{identite?.email}</p>
            </div>
            <button
              onClick={deconnexion}
              title="Se déconnecter"
              className="text-white/40 hover:text-white/80 transition-colors p-1"
            >
              <IcDeconnexion />
            </button>
          </div>
        </div>
      </aside>

      {/* ── ZONE DROITE ── */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-screen-xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
