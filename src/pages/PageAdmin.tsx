import { BlocAVenir, EnTetePage } from '../components/Page'

export function PageAdmin() {
  return (
    <div className="space-y-6">
      <EnTetePage titre="Équipe & réglages" sousTitre="Utilisateurs, rôles et connexions" />
      <div className="grid lg:grid-cols-2 gap-4">
        <BlocAVenir titre="Équipe" version="V1" points={[
          'Utilisateurs et rôles : admin, manager, commercial',
          'Codes postaux attribués à chaque commercial',
        ]} />
        <BlocAVenir titre="Connexions" version="V1" points={[
          'Axonaut : clé API, dernière synchro, journal',
          'Google, Resend, Ockham Lettrage (versions suivantes)',
        ]} />
        <BlocAVenir titre="Règles de suivi" version="V2" points={[
          'Exemple : pas de RDV depuis 6 mois → tâche « reprendre contact »',
        ]} />
        <BlocAVenir titre="Score des prospects" version="V3" points={[
          'Poids de chaque critère : NAF, taille, distance, densité',
        ]} />
      </div>
    </div>
  )
}
