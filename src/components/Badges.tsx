import { LIBELLE_CLASSEMENT, STYLE_CLASSEMENT } from '../lib/format'
import type { TiersLigne } from '../types'

export function BadgeClassement({ tiers }: { tiers: Pick<TiersLigne, 'classement' | 'classement_statut' | 'chantier' | 'chantier_termine'> }) {
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span
        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${STYLE_CLASSEMENT[tiers.classement]}`}
        title={tiers.classement_statut === 'suggere' ? 'Classement suggéré par l\'import, à valider' : 'Classement validé'}
      >
        {LIBELLE_CLASSEMENT[tiers.classement]}
        {tiers.classement_statut === 'suggere' && <span className="opacity-60"> ?</span>}
      </span>
      {tiers.chantier && (
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
          {tiers.chantier_termine ? 'Chantier terminé' : 'Chantier'}
        </span>
      )}
    </span>
  )
}

export function BadgeRattachement({ statut }: { statut: TiersLigne['rattachement_statut'] }) {
  if (!statut) return null
  const styles = {
    suggere: 'bg-amber-50 text-amber-700',
    valide: 'bg-emerald-50 text-emerald-700',
    rejete: 'bg-red-50 text-red-600',
  } as const
  const libelles = { suggere: 'Suggéré', valide: 'Validé', rejete: 'Rejeté' } as const
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${styles[statut]}`}>{libelles[statut]}</span>
}
