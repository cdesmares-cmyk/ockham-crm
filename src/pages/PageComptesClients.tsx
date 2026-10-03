import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BlocAVenir, CarteIndicateur, EnTetePage, Onglets } from '../components/Page'
import { BadgeClassement } from '../components/Badges'
import { useAuth } from '../contexts/AuthContext'
import { useDonnees } from '../contexts/DonneesContext'
import { dateFr, euros, eurosCourt, LIBELLE_CLASSEMENT, nomCommercial } from '../lib/format'
import { departement, estDansMonPortefeuille } from '../lib/portefeuille'
import { supabase } from '../lib/supabase'
import type { Classement, TiersLigne } from '../types'
import { PanneauRattachements } from './PanneauRattachements'

type Vue = 'liste' | 'carte' | 'rattachements'
type FiltreType = 'comptes' | Classement
type Tri = 'nom' | 'ca'

const PAR_PAGE = 50
/** Ce qu'on appelle « comptes clients » : tout sauf les prospects. */
const TYPES_COMPTES: Classement[] = ['payeur', 'client', 'point_collecte']

export function PageComptesClients() {
  const { profil, apercu } = useAuth()
  const { tiers, chargement, erreur } = useDonnees()
  const [vue, setVue] = useState<Vue>('liste')

  const nbASuggerer = useMemo(() => tiers.filter(t => t.rattachement_statut === 'suggere').length, [tiers])

  if (apercu || !supabase) {
    return (
      <div>
        <EnTetePage titre="Comptes clients" sousTitre="Aperçu local : connectez-vous pour voir les données" />
      </div>
    )
  }

  if (!profil && !chargement) {
    return (
      <div>
        <EnTetePage titre="Comptes clients" />
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3 text-sm text-amber-800">
          Votre compte n'est rattaché à aucune organisation. Demandez à votre administrateur de vous ajouter.
        </div>
      </div>
    )
  }

  return (
    <div>
      <EnTetePage
        titre="Comptes clients"
        sousTitre={`Payeurs, clients et points de collecte · ${profil?.nom_organisation ?? ''}`}
      />

      <Onglets<Vue>
        actif={vue}
        onChange={setVue}
        onglets={[
          { id: 'liste', label: 'Liste' },
          { id: 'carte', label: 'Carte' },
          { id: 'rattachements', label: `Rattachements à valider${nbASuggerer ? ` (${nbASuggerer.toLocaleString('fr-FR')})` : ''}` },
        ]}
      />

      {erreur && (
        <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3">
          <span className="text-red-400 text-sm mt-0.5">⚠</span>
          <p className="text-sm text-red-700">{erreur}</p>
        </div>
      )}

      {chargement && tiers.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Chargement des comptes…</p>
      ) : (
        <>
          {vue === 'liste' && <ListeComptes tiers={tiers} />}
          {vue === 'carte' && (
            <BlocAVenir titre="Carte des points de collecte" version="Prochaine étape" points={[
              'Géolocalisation des adresses (API Adresse de l\'État)',
              'Couleur par commercial, type ou CA, pour repérer les zones peu couvertes',
            ]} />
          )}
          {vue === 'rattachements' && <PanneauRattachements />}
        </>
      )}
    </div>
  )
}

function ListeComptes({ tiers }: { tiers: TiersLigne[] }) {
  const { profil } = useAuth()
  const [recherche, setRecherche] = useState('')
  const [monPortefeuille, setMonPortefeuille] = useState(false)
  const [type, setType] = useState<FiltreType>('comptes')
  const [commercial, setCommercial] = useState('')
  const [dept, setDept] = useState('')
  const [avecArchives, setAvecArchives] = useState(false)
  const [tri, setTri] = useState<Tri>('ca')
  const [page, setPage] = useState(0)

  const commerciaux = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tiers) if (t.commercial_axonaut) m.set(t.commercial_axonaut, (m.get(t.commercial_axonaut) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([email]) => email)
  }, [tiers])

  const departements = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tiers) { const d = departement(t.code_postal); if (d) m.set(d, (m.get(d) ?? 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d)
  }, [tiers])

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const liste = tiers.filter(t => {
      if (type === 'comptes') {
        if (!TYPES_COMPTES.includes(t.classement) && !(avecArchives && t.classement === 'archive')) return false
      } else if (t.classement !== type) return false
      if (monPortefeuille && !estDansMonPortefeuille(t, profil)) return false
      if (commercial && t.commercial_axonaut !== commercial) return false
      if (dept && departement(t.code_postal) !== dept) return false
      if (q) {
        const texte = `${t.nom} ${t.siret ?? ''} ${t.ville ?? ''} ${t.code_postal ?? ''}`.toLowerCase()
        if (!texte.includes(q)) return false
      }
      return true
    })
    return tri === 'ca'
      ? liste.sort((a, b) => b.ca_annee - a.ca_annee || a.nom.localeCompare(b.nom))
      : liste.sort((a, b) => a.nom.localeCompare(b.nom))
  }, [tiers, recherche, type, monPortefeuille, commercial, dept, avecArchives, tri, profil])

  const caAnnee = filtres.reduce((s, t) => s + t.ca_annee, 0)
  const nbPoints = filtres.filter(t => t.classement === 'client' || t.classement === 'point_collecte').length
  const nbPayeurs = filtres.filter(t => t.classement === 'payeur' || t.classement === 'client').length
  const nbPages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE))
  const pageCourante = Math.min(page, nbPages - 1)
  const visibles = filtres.slice(pageCourante * PAR_PAGE, (pageCourante + 1) * PAR_PAGE)
  const annee = new Date().getFullYear()

  function changer<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0) }
  }

  const selectClasse = 'bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-ockham-teal'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CarteIndicateur label="Fiches" valeur={filtres.length.toLocaleString('fr-FR')} detail="Selon les filtres" />
        <CarteIndicateur label={`CA ${annee}`} valeur={eurosCourt(caAnnee)} detail="Facturé depuis janvier" />
        <CarteIndicateur label="Points de collecte" valeur={nbPoints.toLocaleString('fr-FR')} detail="Clients et sites rattachés" />
        <CarteIndicateur label="Payeurs" valeur={nbPayeurs.toLocaleString('fr-FR')} detail="Reçoivent des factures" />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-2.5">
        <input
          value={recherche}
          onChange={e => changer(setRecherche)(e.target.value)}
          placeholder="Rechercher un nom, un SIRET, une ville…"
          className="flex-1 min-w-[220px] bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-900 placeholder-gray-300 outline-none focus:border-ockham-teal focus:ring-2 focus:ring-ockham-teal/10"
        />
        <button
          onClick={() => changer(setMonPortefeuille)(!monPortefeuille)}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold border transition-colors ${
            monPortefeuille
              ? 'bg-ockham-teal text-white border-ockham-teal'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Mon portefeuille
        </button>
        <select value={type} onChange={e => changer(setType)(e.target.value as FiltreType)} className={selectClasse}>
          <option value="comptes">Tous les comptes</option>
          <option value="payeur">{LIBELLE_CLASSEMENT.payeur}s</option>
          <option value="client">{LIBELLE_CLASSEMENT.client}s</option>
          <option value="point_collecte">Points de collecte</option>
          <option value="archive">Archives</option>
        </select>
        <select value={commercial} onChange={e => changer(setCommercial)(e.target.value)} className={selectClasse}>
          <option value="">Tous les commerciaux</option>
          {commerciaux.map(c => <option key={c} value={c}>{nomCommercial(c)}</option>)}
        </select>
        <select value={dept} onChange={e => changer(setDept)(e.target.value)} className={selectClasse}>
          <option value="">Tous les départements</option>
          {departements.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {type === 'comptes' && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 px-1 cursor-pointer select-none">
            <input type="checkbox" checked={avecArchives} onChange={e => changer(setAvecArchives)(e.target.checked)} className="accent-ockham-teal" />
            Inclure les archives
          </label>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <ThTri actif={tri === 'nom'} onClick={() => setTri('nom')}>Compte</ThTri>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Ville</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Commercial</th>
                <ThTri actif={tri === 'ca'} onClick={() => setTri('ca')} droite>CA {annee}</ThTri>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 text-right">Dernière facture</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(t => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link to={`/comptes-clients/${t.id}`} className="font-medium text-gray-900 hover:text-ockham-teal-dark">
                      {t.nom}
                    </Link>
                    {t.siret && <p className="text-xs font-mono text-gray-400">{t.siret}</p>}
                  </td>
                  <td className="px-4 py-2.5"><BadgeClassement tiers={t} /></td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {t.ville ?? '—'} {t.code_postal && <span className="text-gray-400">({t.code_postal})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{nomCommercial(t.commercial_axonaut)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {t.ca_annee ? euros(t.ca_annee) : <span className="text-gray-300 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap">{dateFr(t.derniere_facture)}</td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Aucun compte ne correspond à ces filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {nbPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              {(pageCourante * PAR_PAGE + 1).toLocaleString('fr-FR')}–{Math.min((pageCourante + 1) * PAR_PAGE, filtres.length).toLocaleString('fr-FR')} sur {filtres.length.toLocaleString('fr-FR')}
            </span>
            <div className="flex gap-1.5">
              <button disabled={pageCourante === 0} onClick={() => setPage(pageCourante - 1)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">← Précédent</button>
              <button disabled={pageCourante >= nbPages - 1} onClick={() => setPage(pageCourante + 1)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">Suivant →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ThTri({ actif, onClick, droite, children }: { actif: boolean; onClick: () => void; droite?: boolean; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-3 ${droite ? 'text-right' : ''}`}>
      <button
        onClick={onClick}
        className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${actif ? 'text-ockham-teal-dark' : 'text-gray-400 hover:text-gray-600'}`}
      >
        {children}{actif && ' ↓'}
      </button>
    </th>
  )
}
