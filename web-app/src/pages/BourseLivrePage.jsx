import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import Modal from '../components/Modal'
import { bourseApi } from '../api/bourse'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

// ─── Constantes ────────────────────────────────────────────────────────────
const CLASSES = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Tle']
const NIVEAUX = ['Primaire', 'Collège', 'Lycée']
const MATIERES = ['Mathématiques', 'Français', 'Anglais', 'Histoire-Géo', 'SVT', 'Physique-Chimie', 'Philosophie', 'Informatique', 'Économie', 'Autre']
const ETATS = ['Neuf', 'Très bon', 'Bon', 'Acceptable']
const MODES = [{ val: 'vente', label: '💰 Vente' }, { val: 'troc', label: '🔄 Troc' }, { val: 'don', label: '🎁 Don' }]

const STATUT_LABELS = { en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé', complete: 'Complété', annule: 'Annulé' }
const STATUT_COLORS = {
  en_attente: 'bg-yellow-100 text-yellow-800',
  accepte: 'bg-green-100 text-green-800',
  refuse: 'bg-red-100 text-red-800',
  complete: 'bg-indigo-100 text-indigo-800',
  annule: 'bg-gray-100 text-gray-600',
}

// ─── Sous-composants ────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[statut] || 'bg-gray-100 text-gray-600'}`}>
      {STATUT_LABELS[statut] || statut}
    </span>
  )
}

function LivreCard({ l, onSelect }) {
  const modeCfg = { vente: { color: 'text-primary', label: l.prix_detecte ? `${l.prix_detecte} FCFA` : 'Vente' }, troc: { color: 'text-secondary', label: '🔄 Troc' }, don: { color: 'text-warning', label: '🎁 Don' } }
  const m = modeCfg[l.mode_listing] || modeCfg.vente
  return (
    <div onClick={() => onSelect(l)} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer active:bg-gray-50">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{l.titre}</h3>
          {l.auteur && <p className="text-xs text-gray-400">{l.auteur}</p>}
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">{l.classe_actuelle}</span>
            {l.classe_souhaitee && l.classe_souhaitee !== l.classe_actuelle && (
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">→ {l.classe_souhaitee}</span>
            )}
            {l.matiere && <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{l.matiere}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full ${l.etat_livre === 'Neuf' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>{l.etat_livre}</span>
          </div>
        </div>
        <p className={`text-sm font-bold shrink-0 ${m.color}`}>{m.label}</p>
      </div>
      {l.distance_km && <p className="text-xs text-gray-400 mt-1.5">📍 {l.distance_km.toFixed(1)} km</p>}
    </div>
  )
}

function ChecklistItem({ livre, checked, onToggle }) {
  return (
    <label className="flex items-start gap-3 bg-white rounded-xl p-4 cursor-pointer active:bg-gray-50">
      <input type="checkbox" checked={checked} onChange={() => onToggle(livre.id)}
        className="w-5 h-5 mt-0.5 rounded shrink-0 accent-primary" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm leading-tight">{livre.titre}</p>
        {livre.auteur && <p className="text-xs text-gray-400">{livre.auteur}</p>}
        <p className="text-xs text-gray-400 mt-0.5">{livre.matiere} · {livre.classe_actuelle}</p>
        {livre.etat_livre && <p className="text-xs text-yellow-600 mt-0.5">{livre.etat_livre}</p>}
        {livre.prix_detecte && <p className="text-xs text-primary font-medium mt-0.5">{livre.prix_detecte} FCFA</p>}
      </div>
    </label>
  )
}

// ─── Vues internes ──────────────────────────────────────────────────────────
function SearchView({ onSelectLivre }) {
  const [filters, setFilters] = useState({ classe_actuelle: '', classe_souhaitee: '', matiere: '', niveau: '', etat_livre: '', ville: '', quartier: '', rayon_km: 10 })
  const [gps, setGps] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  function update(k, v) { setFilters(f => ({ ...f, [k]: v })) }

  function useGPS() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude })
    }, () => { setError('Position GPS non disponible') })
  }

  async function search(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSearched(true)
    try {
      const params = { ...filters }
      if (gps) { params.gps_lat = gps.lat; params.gps_lon = gps.lon }
      const data = await bourseApi.search(params)
      setResults(Array.isArray(data) ? data : data.livres || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div>
      <form onSubmit={search} className="px-4 space-y-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Classe actuelle</label>
            <select className="input" value={filters.classe_actuelle} onChange={e => update('classe_actuelle', e.target.value)}>
              <option value="">Toutes</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Classe souhaitée</label>
            <select className="input" value={filters.classe_souhaitee} onChange={e => update('classe_souhaitee', e.target.value)}>
              <option value="">Toutes</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <select className="input" value={filters.matiere} onChange={e => update('matiere', e.target.value)}>
          <option value="">Toutes matières</option>
          {MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex gap-2">
          {NIVEAUX.map(n => (
            <button type="button" key={n} onClick={() => update('niveau', filters.niveau === n ? '' : n)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${filters.niveau === n ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {ETATS.map(e => (
            <button type="button" key={e} onClick={() => update('etat_livre', filters.etat_livre === e ? '' : e)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filters.etat_livre === e ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}>
              {e}
            </button>
          ))}
        </div>
        <input className="input" placeholder="Ville (ex: Douala)" value={filters.ville} onChange={e => update('ville', e.target.value)} />
        <input className="input" placeholder="Quartier" value={filters.quartier} onChange={e => update('quartier', e.target.value)} />

        <div className="flex gap-2">
          <button type="button" onClick={useGPS}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${gps ? 'bg-secondary/10 text-secondary border-secondary' : 'bg-white text-gray-600 border-gray-200'}`}>
            {gps ? `📍 GPS (${gps.lat.toFixed(2)}, ${gps.lon.toFixed(2)})` : '📍 Ma position GPS'}
          </button>
          {gps && (
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3">
              <button type="button" onClick={() => update('rayon_km', Math.max(1, filters.rayon_km - 1))} className="text-lg text-gray-500 w-6">−</button>
              <span className="text-sm font-medium text-gray-700 w-12 text-center">{filters.rayon_km} km</span>
              <button type="button" onClick={() => update('rayon_km', Math.min(50, filters.rayon_km + 1))} className="text-lg text-gray-500 w-6">+</button>
            </div>
          )}
        </div>
        <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60">
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </form>

      <div className="px-4 pb-24 space-y-3">
        {error && <p className="text-danger text-sm text-center py-2">{error}</p>}
        {searched && !loading && results.length === 0 && !error && (
          <p className="text-gray-400 text-center py-8">Aucun livre trouvé</p>
        )}
        {results.map((l, i) => <LivreCard key={l.id || i} l={l} onSelect={onSelectLivre} />)}
      </div>
    </div>
  )
}

function ClasseView() {
  const [classe, setClasse] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState({})
  const [searched, setSearched] = useState(false)

  function toggle(id) { setChecked(c => ({ ...c, [id]: !c[id] })) }

  async function browse(e) {
    e.preventDefault()
    if (!classe) return
    setLoading(true); setSearched(true)
    try {
      const data = await bourseApi.browseByClass(classe)
      setResults(Array.isArray(data) ? data : data.livres || [])
      setChecked({})
    } catch (e) {} finally { setLoading(false) }
  }

  const selected = results.filter(l => checked[l.id])
  const total = selected.reduce((s, l) => s + (parseFloat(l.prix_detecte) || 0), 0)

  return (
    <div>
      <form onSubmit={browse} className="px-4 space-y-2 pb-3">
        <select className="input" value={classe} onChange={e => setClasse(e.target.value)} required>
          <option value="">Sélectionner la classe</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" disabled={loading || !classe} className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60">
          {loading ? 'Chargement...' : 'Voir les livres'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mx-4 mb-3 bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
          <p className="font-medium">📋 Liste d'achats — cochez les livres qui vous intéressent</p>
          {selected.length > 0 && (
            <p className="mt-1">✅ {selected.length} sélectionné(s) · Estimation : <strong>{total.toLocaleString()} FCFA</strong></p>
          )}
        </div>
      )}

      <div className="px-4 pb-24 space-y-3">
        {searched && !loading && results.length === 0 && (
          <p className="text-gray-400 text-center py-8">Aucun livre pour cette classe</p>
        )}
        {results.map((l, i) => (
          <ChecklistItem key={l.id || i} livre={l} checked={!!checked[l.id]} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}

function MesLivresView({ onSelectLivre, openAddModal }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [livres, setLivres] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setError('')
    try {
      const data = await bourseApi.getMesLivres()
      setLivres(Array.isArray(data) ? data : data.livres || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  async function toggleAvail(l) {
    try {
      await bourseApi.updateAvailability(l.id, !l.is_available)
      load()
    } catch (e) { alert(e.message) }
  }

  async function deleteLivre(id) {
    if (!confirm('Supprimer ce livre ?')) return
    try { await bourseApi.deleteLivre(id); load() }
    catch (e) { alert(e.message) }
  }

  if (!user) return (
    <div className="text-center py-12 px-4">
      <p className="text-gray-400 mb-4">Connectez-vous pour gérer vos livres</p>
      <button onClick={() => navigate('/login')} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium">Se connecter</button>
    </div>
  )

  return (
    <div>
      <div className="px-4 pb-3">
        <button onClick={openAddModal} className="w-full bg-secondary text-white py-3 rounded-xl font-medium">+ Publier un livre</button>
      </div>
      {error && <p className="text-danger text-sm text-center px-4 mb-2">{error}</p>}
      {loading && <p className="text-center text-gray-400 py-6">Chargement...</p>}
      <div className="px-4 pb-24 space-y-3">
        {!loading && livres.length === 0 && !error && (
          <p className="text-gray-400 text-center py-8">Aucun livre publié</p>
        )}
        {livres.map((l, i) => (
          <div key={l.id || i} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectLivre(l)}>
                <p className="font-semibold text-gray-800 truncate">{l.titre}</p>
                <p className="text-xs text-gray-400 mt-0.5">{l.matiere} · {l.classe_actuelle} · {l.etat_livre}</p>
                <p className={`text-xs font-medium mt-0.5 ${l.mode_listing === 'vente' ? 'text-primary' : l.mode_listing === 'troc' ? 'text-secondary' : 'text-warning'}`}>
                  {l.mode_listing === 'vente' ? `${l.prix_detecte || '?'} FCFA` : l.mode_listing === 'troc' ? '🔄 Troc' : '🎁 Don'}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => toggleAvail(l)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${l.is_available ? 'border-secondary text-secondary' : 'border-gray-300 text-gray-400'}`}>
                  {l.is_available ? '✓ Dispo' : 'Indispo'}
                </button>
                <button onClick={() => deleteLivre(l.id)} className="text-danger p-1">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MesTrocsView({ onSelectTroc }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trocs, setTrocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [statut, setStatut] = useState('all')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setError('')
    try {
      const data = await bourseApi.getMesTrocs(statut)
      setTrocs(Array.isArray(data) ? data : (data.data?.trocs || data.trocs || []))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [user, statut])

  useEffect(() => { load() }, [load])

  if (!user) return (
    <div className="text-center py-12 px-4">
      <p className="text-gray-400 mb-4">Connectez-vous pour voir vos trocs</p>
      <button onClick={() => navigate('/login')} className="bg-primary text-white px-6 py-2.5 rounded-xl font-medium">Se connecter</button>
    </div>
  )

  const FILTRES = [{ k: 'all', l: 'Tous' }, { k: 'en_attente', l: 'En attente' }, { k: 'accepte', l: 'Acceptés' }, { k: 'complete', l: 'Complétés' }]

  return (
    <div>
      <div className="flex gap-1 px-4 pb-3 overflow-x-auto no-scrollbar">
        {FILTRES.map(f => (
          <button key={f.k} onClick={() => setStatut(f.k)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statut === f.k ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {f.l}
          </button>
        ))}
      </div>
      {error && <p className="text-danger text-sm text-center px-4 mb-2">{error}</p>}
      {loading && <p className="text-center text-gray-400 py-6">Chargement...</p>}
      <div className="px-4 pb-24 space-y-3">
        {!loading && trocs.length === 0 && !error && (
          <div className="text-center py-8">
            <p className="text-gray-400">Aucun troc</p>
            <p className="text-gray-300 text-sm mt-1">Trouvez un livre et proposez un échange</p>
          </div>
        )}
        {trocs.map((t, i) => {
          const userId = user?.id
          const isInit = userId === t.initiateur_id
          return (
            <div key={t.id || i} onClick={() => onSelectTroc(t)} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer active:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <StatutBadge statut={t.statut} />
                {t.type_troc === 'chaine' && (
                  <span className="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">🔗 Chaîne</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400">{isInit ? 'Vous offrez' : 'Vous recevez'}</p>
                  <p className="font-medium text-gray-800 truncate">{t.livre_offert?.titre || 'Livre offert'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">{isInit ? 'Vous recevez' : 'Vous offrez'}</p>
                  <p className="font-medium text-gray-800 truncate">{t.livre_souhaite?.titre || 'Livre souhaité'}</p>
                </div>
              </div>
              {t.distance_km && <p className="text-xs text-gray-400 mt-2">📍 {t.distance_km.toFixed(1)} km</p>}
              <div className="flex gap-2 mt-2 pt-2 border-t">
                <span className={`text-xs ${t.validation_initiateur ? 'text-secondary' : 'text-gray-300'}`}>✓ Initiateur</span>
                <span className={`text-xs ${t.validation_participant ? 'text-secondary' : 'text-gray-300'}`}>✓ Participant</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page principale ────────────────────────────────────────────────────────
export default function BourseLivrePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('chercher')

  // Modals
  const [selectedLivre, setSelectedLivre] = useState(null)
  const [selectedTroc, setSelectedTroc] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [matchings, setMatchings] = useState(null)
  const [matchingLoading, setMatchingLoading] = useState(false)
  const [trocDetail, setTrocDetail] = useState(null)
  const [trocLoading, setTrocLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Formulaire ajout livre
  const [newLivre, setNewLivre] = useState({ titre: '', auteur: '', classe_actuelle: '', classe_souhaitee: '', matiere: '', niveau: '', etat_livre: 'Bon', mode_listing: 'vente', prix_detecte: '', ville: '', quartier: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  function updateNew(k, v) { setNewLivre(n => ({ ...n, [k]: v })) }

  // --- Troc matching ---
  async function findMatchings(livre) {
    setMatchings(null); setMatchingLoading(true)
    try {
      const data = await bourseApi.getTrocMatchings(livre.id)
      setMatchings(data.data || data)
    } catch (e) { setMatchings({ error: e.message }) } finally { setMatchingLoading(false) }
  }

  async function createDirectTroc(livreOffertId, livreSouhaiteeId) {
    if (!user) { navigate('/login'); return }
    if (!confirm('Proposer cet échange ?')) return
    setActionLoading(true)
    try {
      await bourseApi.createDirectTroc(livreOffertId, livreSouhaiteeId)
      setSelectedLivre(null); setMatchings(null)
      setTab('mes-trocs')
    } catch (e) { alert(e.message) } finally { setActionLoading(false) }
  }

  // --- Troc détail ---
  async function openTrocDetail(t) {
    setSelectedTroc(t); setTrocDetail(null); setTrocLoading(true)
    try {
      const data = await bourseApi.getTrocDetails(t.id)
      setTrocDetail(data.data || data)
    } catch (e) { setTrocDetail({ error: e.message }) } finally { setTrocLoading(false) }
  }

  async function handleTrocAction(action) {
    if (!confirm(action === 'refuse' ? 'Refuser ce troc ?' : action === 'complete' ? "Confirmer que l'échange a été fait ?" : 'Accepter ce troc ?')) return
    setActionLoading(true)
    try {
      if (action === 'accept') await bourseApi.acceptTroc(selectedTroc.id)
      else if (action === 'refuse') { await bourseApi.refuseTroc(selectedTroc.id); setSelectedTroc(null); return }
      else if (action === 'complete') await bourseApi.completeTroc(selectedTroc.id)
      openTrocDetail(selectedTroc)
    } catch (e) { alert(e.message) } finally { setActionLoading(false) }
  }

  // --- Ajout livre ---
  async function submitLivre(e) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setAddLoading(true); setAddError('')
    try {
      await bourseApi.createLivre({ ...newLivre, prix_detecte: newLivre.prix_detecte ? parseFloat(newLivre.prix_detecte) : undefined })
      setAddModal(false)
      setNewLivre({ titre: '', auteur: '', classe_actuelle: '', classe_souhaitee: '', matiere: '', niveau: '', etat_livre: 'Bon', mode_listing: 'vente', prix_detecte: '', ville: '', quartier: '' })
      if (tab === 'mes-livres') {} // Mes livres va se recharger via effet
    } catch (e) { setAddError(e.message) } finally { setAddLoading(false) }
  }

  const TABS = [
    { id: 'chercher', label: '🔍 Chercher' },
    { id: 'classe', label: '🎓 Par classe' },
    { id: 'mes-livres', label: '📖 Mes livres' },
    { id: 'mes-trocs', label: '🔄 Mes trocs' },
  ]

  const troc = trocDetail?.troc || trocDetail
  const isInit = troc && user?.id === troc.initiateur_id
  const canAccept = troc && !isInit && troc.statut === 'en_attente'
  const canRefuse = troc && troc.statut === 'en_attente'
  const canComplete = troc && troc.statut === 'accepte'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="📚 Bourse du Livre" />

      <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'chercher' && <SearchView onSelectLivre={setSelectedLivre} />}
        {tab === 'classe' && <ClasseView />}
        {tab === 'mes-livres' && <MesLivresView onSelectLivre={setSelectedLivre} openAddModal={() => setAddModal(true)} />}
        {tab === 'mes-trocs' && <MesTrocsView onSelectTroc={openTrocDetail} />}
      </div>

      {/* ── Détail livre ── */}
      <Modal open={!!selectedLivre && !matchings && !matchingLoading} onClose={() => setSelectedLivre(null)} title={selectedLivre?.titre || ''}>
        {selectedLivre && (
          <div className="space-y-3">
            {selectedLivre.auteur && <p className="text-gray-600">✍️ {selectedLivre.auteur}</p>}
            <div className="flex flex-wrap gap-2">
              <span className="bg-blue-50 text-blue-600 text-sm px-3 py-1 rounded-full">{selectedLivre.classe_actuelle}</span>
              {selectedLivre.classe_souhaitee && <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">→ {selectedLivre.classe_souhaitee}</span>}
              {selectedLivre.matiere && <span className="bg-gray-100 text-gray-500 text-sm px-3 py-1 rounded-full">{selectedLivre.matiere}</span>}
              <span className="bg-yellow-50 text-yellow-600 text-sm px-3 py-1 rounded-full">{selectedLivre.etat_livre}</span>
            </div>
            {selectedLivre.description_etat && <p className="text-gray-500 text-sm">{selectedLivre.description_etat}</p>}
            {selectedLivre.mode_listing === 'vente' && selectedLivre.prix_detecte && (
              <p className="text-2xl font-bold text-primary">{selectedLivre.prix_detecte} FCFA</p>
            )}
            {selectedLivre.mode_listing === 'troc' && <p className="text-secondary font-medium">🔄 Disponible à l'échange (troc)</p>}
            {selectedLivre.mode_listing === 'don' && <p className="text-warning font-medium">🎁 Offert gratuitement</p>}
            {selectedLivre.ville && <p className="text-gray-500 text-sm">📍 {selectedLivre.quartier ? `${selectedLivre.quartier}, ` : ''}{selectedLivre.ville}</p>}
            {selectedLivre.distance_km && <p className="text-gray-400 text-sm">📏 {selectedLivre.distance_km.toFixed(1)} km de vous</p>}

            {(selectedLivre.mode_listing === 'troc' || !selectedLivre.mode_listing) && (
              <button onClick={() => findMatchings(selectedLivre)}
                className="w-full bg-secondary text-white py-3 rounded-xl font-medium mt-2">
                🔄 Trouver un troc
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* ── Chargement matchings ── */}
      {matchingLoading && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 text-center">
            <p className="text-gray-600">Recherche des correspondances...</p>
          </div>
        </div>
      )}

      {/* ── Matchings troc ── */}
      <Modal open={!!matchings && !matchingLoading} onClose={() => { setMatchings(null); setSelectedLivre(null) }} title="Correspondances de troc">
        {matchings && (
          <div className="space-y-4">
            {matchings.error && <p className="text-danger text-sm">{matchings.error}</p>}

            {matchings.direct_matches?.length > 0 && (
              <div>
                <p className="font-semibold text-gray-700 mb-2">Échanges directs (1 pour 1)</p>
                <div className="space-y-2">
                  {matchings.direct_matches.map((m, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3">
                      <p className="font-medium text-gray-800 text-sm">{m.livre_offert?.titre || m.titre}</p>
                      {m.distance_km && <p className="text-xs text-gray-400 mt-0.5">📍 {m.distance_km.toFixed(1)} km</p>}
                      {m.score_proximite && <p className="text-xs text-secondary mt-0.5">Score : {Math.round(m.score_proximite * 100)}%</p>}
                      <button onClick={() => createDirectTroc(selectedLivre.id, m.livre_offert?.id || m.id)}
                        disabled={actionLoading}
                        className="mt-2 w-full bg-secondary text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                        Proposer cet échange
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matchings.chain_matches?.length > 0 && (
              <div>
                <p className="font-semibold text-gray-700 mb-2">Chaînes d'échange</p>
                <div className="space-y-2">
                  {matchings.chain_matches.map((m, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-3">
                      <p className="text-sm text-gray-700">{m.nombre_participants || m.participants?.length || '?'} participants</p>
                      {m.distance_km && <p className="text-xs text-gray-400">📍 {m.distance_km.toFixed(1)} km</p>}
                      <button onClick={() => createDirectTroc(selectedLivre.id, m.chaine_id)}
                        disabled={actionLoading}
                        className="mt-2 w-full bg-primary text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                        Rejoindre cette chaîne
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!matchings.error && !matchings.direct_matches?.length && !matchings.chain_matches?.length && (
              <p className="text-center text-gray-400 py-4">Aucune correspondance trouvée pour ce livre</p>
            )}
          </div>
        )}
      </Modal>

      {/* ── Détail troc ── */}
      <Modal open={!!selectedTroc} onClose={() => { setSelectedTroc(null); setTrocDetail(null) }} title="Détail du troc">
        {trocLoading && <p className="text-center text-gray-400 py-6">Chargement...</p>}
        {trocDetail?.error && <p className="text-danger text-sm">{trocDetail.error}</p>}
        {troc && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatutBadge statut={troc.statut} />
              {troc.type_troc === 'chaine' && <span className="text-xs border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">🔗 Chaîne</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{isInit ? 'Vous offrez' : 'Vous recevez'}</p>
                <p className="font-semibold text-gray-800 text-sm">{(trocDetail.livre_offert || troc.livre_offert)?.titre || 'Livre offert'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{isInit ? 'Vous recevez' : 'Vous offrez'}</p>
                <p className="font-semibold text-gray-800 text-sm">{(trocDetail.livre_souhaite || troc.livre_souhaite)?.titre || 'Livre souhaité'}</p>
              </div>
            </div>

            {troc.distance_km && <p className="text-sm text-gray-500">📍 {troc.distance_km.toFixed(1)} km</p>}
            <p className="text-xs text-gray-400">📅 {new Date(troc.created_at).toLocaleDateString('fr-FR')}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className={`p-3 rounded-xl border-2 text-center ${troc.validation_initiateur ? 'border-secondary bg-green-50' : 'border-gray-200'}`}>
                <p className="text-sm font-medium">{troc.validation_initiateur ? '✅' : '○'} Initiateur</p>
              </div>
              <div className={`p-3 rounded-xl border-2 text-center ${troc.validation_participant ? 'border-secondary bg-green-50' : 'border-gray-200'}`}>
                <p className="text-sm font-medium">{troc.validation_participant ? '✅' : '○'} Participant</p>
              </div>
            </div>

            {(canAccept || canRefuse || canComplete) && (
              <div className="space-y-2 pt-2">
                {canAccept && (
                  <button onClick={() => handleTrocAction('accept')} disabled={actionLoading}
                    className="w-full bg-secondary text-white py-3 rounded-xl font-medium disabled:opacity-60">
                    {actionLoading ? 'Traitement...' : '✅ Accepter le troc'}
                  </button>
                )}
                {canComplete && (
                  <button onClick={() => handleTrocAction('complete')} disabled={actionLoading}
                    className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60">
                    {actionLoading ? 'Traitement...' : '🏁 Finaliser l\'échange'}
                  </button>
                )}
                {canRefuse && (
                  <button onClick={() => handleTrocAction('refuse')} disabled={actionLoading}
                    className="w-full border border-danger text-danger py-3 rounded-xl font-medium disabled:opacity-60">
                    Refuser
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Ajout livre ── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Publier un livre">
        <form onSubmit={submitLivre} className="space-y-3">
          <input className="input" placeholder="Titre du livre *" required
            value={newLivre.titre} onChange={e => updateNew('titre', e.target.value)} />
          <input className="input" placeholder="Auteur"
            value={newLivre.auteur} onChange={e => updateNew('auteur', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" required value={newLivre.classe_actuelle} onChange={e => updateNew('classe_actuelle', e.target.value)}>
              <option value="">Classe actuelle *</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={newLivre.classe_souhaitee} onChange={e => updateNew('classe_souhaitee', e.target.value)}>
              <option value="">Classe souhaitée</option>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select className="input" value={newLivre.matiere} onChange={e => updateNew('matiere', e.target.value)}>
            <option value="">Matière</option>
            {MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input" value={newLivre.niveau} onChange={e => updateNew('niveau', e.target.value)}>
            <option value="">Niveau</option>
            {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="input" value={newLivre.etat_livre} onChange={e => updateNew('etat_livre', e.target.value)}>
            {ETATS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input className="input" placeholder="Ville" value={newLivre.ville} onChange={e => updateNew('ville', e.target.value)} />
          <input className="input" placeholder="Quartier" value={newLivre.quartier} onChange={e => updateNew('quartier', e.target.value)} />

          <div>
            <p className="text-sm text-gray-500 font-medium mb-2">Mode de cession</p>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map(m => (
                <label key={m.val} className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-colors ${newLivre.mode_listing === m.val ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                  <input type="radio" name="mode" className="sr-only" value={m.val}
                    checked={newLivre.mode_listing === m.val} onChange={() => updateNew('mode_listing', m.val)} />
                  <span className="text-sm font-medium text-center">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {newLivre.mode_listing === 'vente' && (
            <input className="input" type="number" placeholder="Prix (FCFA)"
              value={newLivre.prix_detecte} onChange={e => updateNew('prix_detecte', e.target.value)} />
          )}

          {addError && <p className="text-danger text-sm">{addError}</p>}
          <button type="submit" disabled={addLoading} className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60">
            {addLoading ? 'Publication...' : 'Publier le livre'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
