import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDonnees } from '../contexts/DonneesContext'
import { nomCommercial } from '../lib/format'
import { estDansMonPortefeuille } from '../lib/portefeuille'
import { supabase } from '../lib/supabase'

const PAR_PAGE = 30

/** Rattachements point de collecte → payeur suggérés par l'import, à valider
 *  ou rejeter. Chaque décision est enregistrée avec son auteur et sa date. */
export function PanneauRattachements() {
  const { profil } = useAuth()
  const { tiers, parId, majLocale } = useDonnees()
  const [monPortefeuille, setMonPortefeuille] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const aTraiter = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return tiers
      .filter(t => t.rattachement_statut === 'suggere' && t.payeur_id)
      .filter(t => !monPortefeuille || estDansMonPortefeuille(t, profil))
      .filter(t => !q || `${t.nom} ${parId.get(t.payeur_id!)?.nom ?? ''}`.toLowerCase().includes(q))
  }, [tiers, parId, monPortefeuille, recherche, profil])

  const nbPages = Math.max(1, Math.ceil(aTraiter.length / PAR_PAGE))
  const pageCourante = Math.min(page, nbPages - 1)
  const visibles = aTraiter.slice(pageCourante * PAR_PAGE, (pageCourante + 1) * PAR_PAGE)

  async function decider(id: string, decision: 'valide' | 'rejete') {
    if (!supabase || !profil) return
    setEnCours(id)
    setErreur(null)
    const modif = {
      rattachement_statut: decision,
      rattachement_par: profil.id,
      rattachement_le: new Date().toISOString(),
      // Un rejet retire le payeur suggéré : la fiche redevient « à rattacher ».
      ...(decision === 'rejete' ? { payeur_id: null } : {}),
    }
    const { error } = await supabase.from('tiers').update(modif).eq('id', id)
    setEnCours(null)
    if (error) {
      console.error('Rattachement non enregistré', error)
      setErreur('La décision n\'a pas été enregistrée. Réessayez.')
      return
    }
    majLocale(id, { rattachement_statut: decision, ...(decision === 'rejete' ? { payeur_id: null } : {}) })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-2.5">
        <input
          value={recherche}
          onChange={e => { setRecherche(e.target.value); setPage(0) }}
          placeholder="Rechercher un site ou un payeur…"
          className="flex-1 min-w-[220px] bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm placeholder-gray-300 outline-none focus:border-ockham-teal focus:ring-2 focus:ring-ockham-teal/10"
        />
        <button
          onClick={() => { setMonPortefeuille(!monPortefeuille); setPage(0) }}
          className={`rounded-lg px-3.5 py-2 text-sm font-semibold border transition-colors ${
            monPortefeuille ? 'bg-ockham-teal text-white border-ockham-teal' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Mon portefeuille
        </button>
        <span className="text-xs text-gray-400 ml-auto">{aTraiter.length.toLocaleString('fr-FR')} à traiter</span>
      </div>

      {erreur && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3">
          <span className="text-red-400 text-sm mt-0.5">⚠</span>
          <p className="text-sm text-red-700">{erreur}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Point de collecte</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Payeur suggéré</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">Commercial</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visibles.map(t => {
              const payeur = parId.get(t.payeur_id!)
              const memeSiren = t.siret && payeur?.siret && t.siret.slice(0, 9) === payeur.siret.slice(0, 9)
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link to={`/comptes-clients/${t.id}`} className="font-medium text-gray-900 hover:text-ockham-teal-dark">{t.nom}</Link>
                    <p className="text-xs text-gray-400">{[t.ville, t.code_postal].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    {payeur ? (
                      <Link to={`/comptes-clients/${payeur.id}`} className="text-gray-700 hover:text-ockham-teal-dark">{payeur.nom}</Link>
                    ) : '—'}
                    <p className="text-xs text-gray-400">{memeSiren ? 'Même SIREN' : 'Nom proche'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{nomCommercial(t.commercial_axonaut)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        disabled={enCours === t.id}
                        onClick={() => decider(t.id, 'valide')}
                        className="bg-ockham-teal text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-ockham-teal-dark disabled:opacity-50 transition-colors"
                      >
                        Valider
                      </button>
                      <button
                        disabled={enCours === t.id}
                        onClick={() => decider(t.id, 'rejete')}
                        className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Rejeter
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {visibles.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                {monPortefeuille ? 'Aucun rattachement à valider dans votre portefeuille.' : 'Aucun rattachement à valider.'}
              </td></tr>
            )}
          </tbody>
        </table>
        {nbPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Page {pageCourante + 1} sur {nbPages}</span>
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
