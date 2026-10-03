import type { ReactNode } from 'react'

/** En-tête de page : titre + sous-titre à gauche, actions à droite (DESIGN_SYSTEM Lettrage). */
export function EnTetePage({ titre, sousTitre, actions }: { titre: string; sousTitre?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{titre}</h1>
        {sousTitre && <p className="text-sm text-gray-400 mt-0.5">{sousTitre}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Indicateur chiffré. Valeur « — » tant que les données ne sont pas branchées. */
export function CarteIndicateur({ label, valeur = '—', detail }: { label: string; valeur?: string; detail?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{valeur}</p>
      {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
    </div>
  )
}

/** Bloc d'un module à venir : ce qu'il contiendra et dans quelle version. */
export function BlocAVenir({ titre, version, points }: { titre: string; version: string; points: string[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{titre}</h2>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-ockham-teal-muted text-ockham-teal-dark">
          {version}
        </span>
      </div>
      <ul className="space-y-1.5">
        {points.map(p => (
          <li key={p} className="flex items-start gap-2 text-sm text-gray-500">
            <span className="text-ockham-teal mt-0.5">•</span>{p}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Onglets internes d'une page. */
export function Onglets<T extends string>({ onglets, actif, onChange }: {
  onglets: { id: T; label: string }[]
  actif: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-5">
      {onglets.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            actif === o.id
              ? 'border-ockham-teal text-ockham-teal-dark'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
