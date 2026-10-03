import { useState } from 'react'
import { BlocAVenir, EnTetePage, Onglets } from '../components/Page'

type Vue = 'pipeline' | 'recherche' | 'veille'

const ETAPES = ['Nouveau', 'Qualifié', 'RDV', 'Proposition', 'Gagné', 'Perdu']

export function PageProspects() {
  const [vue, setVue] = useState<Vue>('pipeline')

  return (
    <div>
      <EnTetePage titre="Prospects" sousTitre="Pipeline, recherche d'entreprises et veille" />

      <Onglets<Vue>
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'pipeline', label: 'Pipeline' },
          { id: 'recherche', label: 'Rechercher des entreprises' },
          { id: 'veille', label: 'Appels d\'offres & veille' },
        ]}
      />

      {vue === 'pipeline' && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {ETAPES.map(etape => (
            <div key={etape} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-h-[220px]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{etape}</p>
                <span className="text-[11px] font-bold text-gray-300">0</span>
              </div>
              <p className="text-xs text-gray-300">Aucune opportunité</p>
            </div>
          ))}
        </div>
      )}
      {vue === 'recherche' && (
        <BlocAVenir titre="Entreprises qui ressemblent à vos clients" version="V3" points={[
          'Profil type calculé sur vos meilleurs clients (NAF, taille, zone)',
          'Recherche dans la base publique des entreprises, clients existants exclus',
          'Score sur 100 avec son détail, ajout au pipeline en un clic',
        ]} />
      )}
      {vue === 'veille' && (
        <BlocAVenir titre="Appels d'offres et signaux" version="V5" points={[
          'Appels d\'offres publics (BOAMP) : collecte, tri, recyclage, dans votre zone',
          'Créations et déménagements d\'entreprises (BODACC, Sirene)',
          'Alerte quotidienne par email',
        ]} />
      )}
    </div>
  )
}
