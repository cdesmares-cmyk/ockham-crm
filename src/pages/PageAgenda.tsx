import { BlocAVenir, EnTetePage } from '../components/Page'

export function PageAgenda() {
  return (
    <div className="space-y-6">
      <EnTetePage
        titre="Agenda"
        sousTitre="Rendez-vous, tâches et relances"
        actions={
          <button disabled className="bg-ockham-teal text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            Nouveau rendez-vous
          </button>
        }
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <BlocAVenir titre="Rendez-vous" version="V2" points={[
          'Vue semaine et mois, synchronisée avec Google Agenda',
          'Compte rendu, prochaine action, rappel la veille',
        ]} />
        <BlocAVenir titre="Tâches et relances" version="V2" points={[
          'Rappels créés à la main ou par une règle de suivi',
          'Email de suivi préparé, envoyé après validation du commercial',
        ]} />
      </div>
    </div>
  )
}
