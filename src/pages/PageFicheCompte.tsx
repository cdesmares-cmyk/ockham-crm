import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeClassement, BadgeRattachement } from '../components/Badges'
import { useAuth } from '../contexts/AuthContext'
import { useDonnees } from '../contexts/DonneesContext'
import { dateFr, euros, LIBELLE_CHAMP_AXONAUT, LIBELLE_CLASSEMENT, nomCommercial } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Classement, Contact, Entreprise, TiersComplet } from '../types'

const CLASSEMENTS: Classement[] = ['payeur', 'client', 'point_collecte', 'prospect', 'archive']

export function PageFicheCompte() {
  const { id } = useParams<{ id: string }>()
  const { profil } = useAuth()
  const { tiers, parId, majLocale } = useDonnees()
  const [fiche, setFiche] = useState<TiersComplet | null>(null)
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [etat, setEtat] = useState<'chargement' | 'ok' | 'introuvable'>('chargement')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !id) return
    const client = supabase
    let annule = false
    ;(async () => {
      setEtat('chargement')
      const { data, error } = await client.from('tiers').select('*').eq('id', id).maybeSingle()
      if (annule) return
      if (error || !data) { setEtat('introuvable'); return }
      const f = { ...(data as TiersComplet), ca_annee: Number(data.ca_annee), ca_total: Number(data.ca_total) }
      setFiche(f)
      const [ent, cts] = await Promise.all([
        f.entreprise_id
          ? client.from('entreprises').select('siren, raison_sociale, naf, libelle_naf, tranche_effectif, etat').eq('id', f.entreprise_id).maybeSingle()
          : Promise.resolve({ data: null }),
        client.from('contacts').select('id, civilite, prenom, nom, fonction, email, telephone, mobile, opposition').eq('tiers_id', id).order('nom'),
      ])
      if (annule) return
      setEntreprise((ent.data as Entreprise | null) ?? null)
      setContacts((cts.data as Contact[] | null) ?? [])
      setEtat('ok')
    })()
    return () => { annule = true }
  }, [id])

  // Sites rattachés à ce compte (quand c'est un payeur), et autres fiches du même SIREN.
  const sites = useMemo(() => tiers.filter(t => t.payeur_id === id).sort((a, b) => b.ca_annee - a.ca_annee), [tiers, id])
  const memeSiren = useMemo(() => {
    const siren = fiche?.siret?.slice(0, 9)
    if (!siren) return []
    return tiers.filter(t => t.id !== id && t.siret?.startsWith(siren) && t.payeur_id !== id)
  }, [tiers, fiche, id])

  async function enregistrer(modif: Partial<TiersComplet>) {
    if (!supabase || !profil || !fiche) return
    setEnregistrement(true)
    setErreur(null)
    const { error } = await supabase.from('tiers').update(modif).eq('id', fiche.id)
    setEnregistrement(false)
    if (error) {
      console.error('Modification non enregistrée', error)
      setErreur('La modification n\'a pas été enregistrée. Réessayez.')
      return
    }
    const suite = { ...fiche, ...modif }
    setFiche(suite)
    majLocale(fiche.id, modif)
  }

  function validerClassement(classement: Classement) {
    void enregistrer({
      classement,
      classement_statut: 'valide',
      classement_par: profil?.id,
      classement_le: new Date().toISOString(),
    } as Partial<TiersComplet>)
  }

  function deciderRattachement(decision: 'valide' | 'rejete') {
    void enregistrer({
      rattachement_statut: decision,
      rattachement_par: profil?.id,
      rattachement_le: new Date().toISOString(),
      ...(decision === 'rejete' ? { payeur_id: null } : {}),
    } as Partial<TiersComplet>)
  }

  if (etat === 'chargement') return <p className="text-sm text-gray-400 py-10 text-center">Chargement de la fiche…</p>
  if (etat === 'introuvable' || !fiche) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-gray-500 mb-3">Ce compte est introuvable.</p>
        <Link to="/comptes-clients" className="text-sm text-ockham-teal-dark hover:underline">← Retour aux comptes</Link>
      </div>
    )
  }

  const payeur = fiche.payeur_id ? parId.get(fiche.payeur_id) : null
  const champs = Object.entries(fiche.champs_axonaut ?? {})
  const annee = new Date().getFullYear()

  return (
    <div className="space-y-5">
      <div>
        <Link to="/comptes-clients" className="text-xs text-gray-400 hover:text-ockham-teal-dark">← Comptes clients</Link>
        <div className="flex items-start justify-between gap-4 mt-1.5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{fiche.nom}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {[fiche.adresse, [fiche.code_postal, fiche.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Adresse inconnue'}
            </p>
          </div>
          <BadgeClassement tiers={fiche} />
        </div>
      </div>

      {erreur && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3">
          <span className="text-red-400 text-sm mt-0.5">⚠</span>
          <p className="text-sm text-red-700">{erreur}</p>
        </div>
      )}

      {/* Classement à valider */}
      {fiche.classement_statut === 'suggere' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-amber-900 flex-1 min-w-[240px]">
            L'import propose de classer ce compte en <strong>{LIBELLE_CLASSEMENT[fiche.classement].toLowerCase()}</strong>. C'est juste ?
          </p>
          <button
            disabled={enregistrement}
            onClick={() => validerClassement(fiche.classement)}
            className="bg-ockham-teal text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-ockham-teal-dark disabled:opacity-50 transition-colors"
          >
            Oui, valider
          </button>
          <select
            disabled={enregistrement}
            value=""
            onChange={e => e.target.value && validerClassement(e.target.value as Classement)}
            className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="">Non, c'est un…</option>
            {CLASSEMENTS.filter(c => c !== fiche.classement).map(c => <option key={c} value={c}>{LIBELLE_CLASSEMENT[c]}</option>)}
          </select>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Carte titre="Chiffre d'affaires">
          <Ligne label={`CA ${annee}`} valeur={<span className="font-semibold">{euros(fiche.ca_annee)}</span>} />
          <Ligne label="CA cumulé" valeur={euros(fiche.ca_total)} />
          <Ligne label="Première facture" valeur={dateFr(fiche.premiere_facture)} />
          <Ligne label="Dernière facture" valeur={dateFr(fiche.derniere_facture)} />
        </Carte>

        <Carte titre="Identité">
          <Ligne label="SIRET" valeur={fiche.siret ? <span className="font-mono text-xs">{fiche.siret}</span> : <span className="text-gray-400">{fiche.siret_statut === 'factice' ? 'Factice dans Axonaut' : 'Absent'}</span>} />
          <Ligne label="Raison sociale" valeur={entreprise?.raison_sociale ?? <span className="text-gray-400">À enrichir</span>} />
          <Ligne label="NAF" valeur={entreprise?.naf ? `${entreprise.naf} ${entreprise.libelle_naf ?? ''}` : <span className="text-gray-400">À enrichir</span>} />
          <Ligne label="Statut Axonaut" valeur={fiche.statut_axonaut === 'client' ? 'Client' : 'Prospect'} />
          <Ligne label="Actif" valeur={fiche.actif === null ? '—' : fiche.actif ? 'Oui' : 'Non'} />
        </Carte>

        <Carte titre="Suivi">
          <Ligne label="Commercial" valeur={nomCommercial(fiche.commercial_axonaut)} />
          <Ligne label="Chantier" valeur={
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="accent-ockham-teal"
                checked={fiche.chantier}
                disabled={enregistrement}
                onChange={e => void enregistrer({ chantier: e.target.checked, ...(e.target.checked ? {} : { chantier_termine: false }) })}
              />
              <span className="text-xs text-gray-500">site temporaire</span>
            </label>
          } />
          {fiche.chantier && (
            <Ligne label="Chantier terminé" valeur={
              <input
                type="checkbox"
                className="accent-ockham-teal"
                checked={fiche.chantier_termine}
                disabled={enregistrement}
                onChange={e => void enregistrer({ chantier_termine: e.target.checked })}
              />
            } />
          )}
          <Ligne label="Synchronisé le" valeur={dateFr(fiche.synchro_le)} />
        </Carte>
      </div>

      {/* Rattachement */}
      {(fiche.classement === 'point_collecte' || payeur) && (
        <Carte titre="Facturé à">
          {payeur ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/comptes-clients/${payeur.id}`} className="text-sm font-medium text-gray-900 hover:text-ockham-teal-dark">{payeur.nom}</Link>
              <BadgeRattachement statut={fiche.rattachement_statut} />
              {fiche.rattachement_statut === 'suggere' && (
                <div className="flex gap-1.5 ml-auto">
                  <button disabled={enregistrement} onClick={() => deciderRattachement('valide')}
                    className="bg-ockham-teal text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-ockham-teal-dark disabled:opacity-50">Valider</button>
                  <button disabled={enregistrement} onClick={() => deciderRattachement('rejete')}
                    className="border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50">Rejeter</button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Aucun payeur rattaché. {fiche.rattachement_statut === 'rejete' && 'La suggestion a été rejetée.'} Le choix d'un payeur arrive dans une prochaine version.
            </p>
          )}
        </Carte>
      )}

      {sites.length > 0 && (
        <Carte titre={`Points de collecte rattachés (${sites.length})`}>
          <ListeFiches fiches={sites} />
        </Carte>
      )}

      {memeSiren.length > 0 && (
        <Carte titre={`Autres fiches de la même entreprise (${memeSiren.length})`}>
          <ListeFiches fiches={memeSiren} />
        </Carte>
      )}

      <Carte titre={`Contacts (${contacts.length})`}>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun contact.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-1 py-2 text-gray-900">{[c.civilite, c.prenom, c.nom].filter(Boolean).join(' ') || <span className="text-gray-400">Sans nom</span>}</td>
                    <td className="px-1 py-2 text-gray-500">{c.fonction ?? ''}</td>
                    <td className="px-1 py-2">{c.email ? <a href={`mailto:${c.email}`} className="text-ockham-teal-dark hover:underline">{c.email}</a> : ''}</td>
                    <td className="px-1 py-2 text-gray-500 whitespace-nowrap">{c.mobile ?? c.telephone ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      <div className="grid lg:grid-cols-2 gap-4">
        {champs.length > 0 && (
          <Carte titre="Informations Axonaut">
            {champs.map(([cle, valeur]) => (
              <Ligne key={cle} label={LIBELLE_CHAMP_AXONAUT[cle] ?? cle} valeur={valeur === true ? 'Oui' : String(valeur)} />
            ))}
          </Carte>
        )}
        {fiche.consignes && (
          <Carte titre="Consignes et commentaires">
            <p className="text-sm text-gray-700 whitespace-pre-line">{fiche.consignes}</p>
          </Carte>
        )}
      </div>
    </div>
  )
}

function Carte({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{titre}</h2>
      {children}
    </div>
  )
}

function Ligne({ label, valeur }: { label: string; valeur: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-gray-700 text-right">{valeur}</span>
    </div>
  )
}

function ListeFiches({ fiches }: { fiches: { id: string; nom: string; ville: string | null; ca_annee: number; classement: Classement; classement_statut: 'suggere' | 'valide'; chantier: boolean; chantier_termine: boolean }[] }) {
  return (
    <div className="divide-y divide-gray-50">
      {fiches.map(s => (
        <div key={s.id} className="flex items-center gap-3 py-2 text-sm">
          <Link to={`/comptes-clients/${s.id}`} className="text-gray-900 hover:text-ockham-teal-dark flex-1 min-w-0 truncate">{s.nom}</Link>
          <span className="text-xs text-gray-400 hidden md:inline">{s.ville ?? ''}</span>
          <BadgeClassement tiers={s} />
          <span className="w-24 text-right font-medium text-gray-700">{s.ca_annee ? euros(s.ca_annee) : '—'}</span>
        </div>
      ))}
    </div>
  )
}
