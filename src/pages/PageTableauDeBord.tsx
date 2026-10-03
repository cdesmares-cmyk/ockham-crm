import { BlocAVenir, CarteIndicateur, EnTetePage } from '../components/Page'

export function PageTableauDeBord() {
  return (
    <div className="space-y-6">
      <EnTetePage titre="Tableau de bord" sousTitre="Performance commerciale de l'équipe" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CarteIndicateur label="CA du mois" detail="Après synchro Axonaut" />
        <CarteIndicateur label="CA depuis janvier" detail="Comparé à l'an dernier" />
        <CarteIndicateur label="Pipeline pondéré" detail="Montant × probabilité" />
        <CarteIndicateur label="RDV cette semaine" detail="Réalisés / prévus" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <BlocAVenir titre="CA par commercial" version="V1" points={[
          'CA du mois, de l\'année, sur 12 mois glissants',
          'Évolution par rapport à l\'an dernier',
          'Nombre de comptes et de points de collecte suivis',
        ]} />
        <BlocAVenir titre="Alertes portefeuille" version="V1" points={[
          'Clients dont le CA baisse',
          'Plus de facture depuis 60 jours',
          'Clients sans contact depuis 6 mois',
        ]} />
        <BlocAVenir titre="Activité" version="V2" points={[
          'RDV réalisés et à venir par commercial',
          'Tâches et relances en retard',
        ]} />
        <BlocAVenir titre="Pipeline" version="V3" points={[
          'Montant par étape, opportunités à signer ce mois-ci',
          'Taux de transformation par source',
        ]} />
      </div>
    </div>
  )
}
