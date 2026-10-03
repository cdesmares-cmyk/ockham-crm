import { useState } from 'react'
import { BlocAVenir, EnTetePage, Onglets } from '../components/Page'

type Vue = 'liste' | 'carte' | 'rattachements'

export function PageComptesClients() {
  const [vue, setVue] = useState<Vue>('liste')

  return (
    <div>
      <EnTetePage
        titre="Comptes clients"
        sousTitre="Payeurs et points de collecte, synchronisés depuis Axonaut"
        actions={
          <button disabled className="bg-ockham-teal text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            Resynchroniser
          </button>
        }
      />

      <Onglets<Vue>
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'liste', label: 'Liste' },
          { id: 'carte', label: 'Carte' },
          { id: 'rattachements', label: 'Rattachements à valider' },
        ]}
      />

      {vue === 'liste' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <BlocAVenir titre="Portefeuille" version="V1" points={[
            'Filtres : commercial, payeur ou point de collecte, NAF, code postal, zone, CA',
            'CA par compte et tendance sur 12 mois',
            'Doublons signalés (fiches « do not use »)',
          ]} />
          <BlocAVenir titre="Fiche client" version="V1" points={[
            'Identité légale (SIREN, NAF, effectif), sites rattachés',
            'Factures, contacts, consignes de collecte',
            'RDV, tâches et historique (V2), encours Lettrage (V6)',
          ]} />
        </div>
      )}
      {vue === 'carte' && (
        <BlocAVenir titre="Carte des points de collecte" version="V1" points={[
          'Couleur par commercial, NAF ou CA',
          'Sélection d\'une zone pour filtrer la liste',
        ]} />
      )}
      {vue === 'rattachements' && (
        <BlocAVenir titre="Point de collecte → payeur" version="V1" points={[
          'Suggestions : même SIREN, nom proche, même commercial',
          'Validation par le commercial, puis renvoi dans Axonaut',
        ]} />
      )}
    </div>
  )
}
