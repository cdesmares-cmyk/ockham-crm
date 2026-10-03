import { BlocAVenir, EnTetePage } from '../components/Page'

export function PageCampagnes() {
  return (
    <div className="space-y-6">
      <EnTetePage titre="Campagnes" sousTitre="Emailings ciblés vers vos clients et prospects" />
      <div className="grid lg:grid-cols-2 gap-4">
        <BlocAVenir titre="Audience" version="V4" points={[
          'Filtres : NAF, zone, type de client, commercial, CA',
          'Contacts opposés exclus automatiquement',
        ]} />
        <BlocAVenir titre="Envoi et résultats" version="V4" points={[
          'Modèle, envoi de test, envoi depuis un sous-domaine dédié',
          'Ouvertures, clics, désinscriptions',
        ]} />
      </div>
    </div>
  )
}
