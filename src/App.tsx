import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { FournisseurAuth, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { PageConnexion } from './pages/PageConnexion'
import { PageTableauDeBord } from './pages/PageTableauDeBord'
import { PageComptesClients } from './pages/PageComptesClients'
import { PageFicheCompte } from './pages/PageFicheCompte'
import { FournisseurDonnees } from './contexts/DonneesContext'
import { PageProspects } from './pages/PageProspects'
import { PageAgenda } from './pages/PageAgenda'
import { PageCampagnes } from './pages/PageCampagnes'
import { PageAdmin } from './pages/PageAdmin'

function Routage() {
  const { identite, chargement } = useAuth()

  if (chargement) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-sm text-gray-400">Chargement…</div>
  }

  if (!identite) return <PageConnexion />

  return (
    <FournisseurDonnees>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/tableau-de-bord" element={<PageTableauDeBord />} />
          <Route path="/comptes-clients" element={<PageComptesClients />} />
          <Route path="/comptes-clients/:id" element={<PageFicheCompte />} />
          <Route path="/prospects" element={<PageProspects />} />
          <Route path="/agenda" element={<PageAgenda />} />
          <Route path="/campagnes" element={<PageCampagnes />} />
          <Route path="/admin" element={<PageAdmin />} />
          <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
        </Route>
      </Routes>
    </FournisseurDonnees>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <FournisseurAuth>
        <Routage />
      </FournisseurAuth>
    </BrowserRouter>
  )
}
