import { useState } from 'react'
import Header from '../components/Header'
import Modal from '../components/Modal'
import { pharmacieApi } from '../api/pharmacie'

const VILLES = ['', 'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua', 'Ngaoundéré', 'Bertoua', 'Ebolowa', 'Kribi']

function PharmacieCard({ p, onClick }) {
  return (
    <div onClick={() => onClick(p)} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer active:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{p.nom}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{p.quartier}{p.ville ? `, ${p.ville}` : ''}</p>
          {p.adresse && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.adresse}</p>}
        </div>
        {p.is_on_duty_now && (
          <span className="ml-2 shrink-0 bg-secondary/10 text-secondary text-xs font-medium px-2 py-0.5 rounded-full">Garde</span>
        )}
      </div>
      {p.telephone && (
        <a href={`tel:${p.telephone}`} onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center gap-1 text-primary text-sm font-medium">
          📞 {p.telephone}
        </a>
      )}
    </div>
  )
}

export default function PharmaciePage() {
  const [tab, setTab] = useState('garde')
  const [query, setQuery] = useState('')
  const [ville, setVille] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [medQuery, setMedQuery] = useState('')
  const [medList, setMedList] = useState([{ nom: '' }])
  const [searched, setSearched] = useState(false)

  async function searchGarde() {
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await pharmacieApi.onDuty(ville)
      setResults(Array.isArray(data) ? data : data.pharmacies || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function searchPharmacies() {
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await pharmacieApi.search(query, ville)
      setResults(Array.isArray(data) ? data : data.pharmacies || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function searchByMeds() {
    const meds = medList.map(m => m.nom).filter(Boolean)
    if (!meds.length) return
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await pharmacieApi.searchByMeds(meds)
      setResults(Array.isArray(data) ? data : data.pharmacies || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  function addMed() { setMedList(l => [...l, { nom: '' }]) }
  function removeMed(i) { setMedList(l => l.filter((_, idx) => idx !== i)) }
  function updateMed(i, val) { setMedList(l => l.map((m, idx) => idx === i ? { nom: val } : m)) }

  function handleSearch(e) {
    e.preventDefault()
    if (tab === 'garde') searchGarde()
    else if (tab === 'search') searchPharmacies()
    else searchByMeds()
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="💊 Pharmacie" />

      <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'garde', label: '🕐 De garde' },
          { id: 'search', label: '🔍 Chercher' },
          { id: 'meds', label: '💉 Par médicament' },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResults([]); setSearched(false) }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="px-4 space-y-2 pb-3">
        <select
          value={ville}
          onChange={e => setVille(e.target.value)}
          className="input"
        >
          {VILLES.map(v => <option key={v} value={v}>{v || 'Toutes les villes'}</option>)}
        </select>

        {tab === 'search' && (
          <input className="input" placeholder="Nom de la pharmacie..." value={query}
            onChange={e => setQuery(e.target.value)} />
        )}

        {tab === 'meds' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 font-medium">Médicaments à trouver :</p>
            {medList.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-1" placeholder={`Médicament ${i + 1}`}
                  value={m.nom} onChange={e => updateMed(i, e.target.value)} />
                {medList.length > 1 && (
                  <button type="button" onClick={() => removeMed(i)}
                    className="text-danger text-xl px-2">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addMed}
              className="text-primary text-sm font-medium">+ Ajouter un médicament</button>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60">
          {loading ? 'Recherche...' : tab === 'garde' ? 'Voir les pharmacies de garde' : 'Rechercher'}
        </button>
      </form>

      <div className="flex-1 px-4 pb-24 space-y-3">
        {error && <p className="text-danger text-sm text-center py-4">{error}</p>}
        {searched && !loading && results.length === 0 && !error && (
          <p className="text-gray-400 text-center py-8">Aucun résultat trouvé</p>
        )}
        {results.map((p, i) => (
          <PharmacieCard key={p.id || i} p={p} onClick={setSelected} />
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.nom || ''}>
        {selected && (
          <div className="space-y-3">
            {selected.adresse && <p className="text-gray-600">📍 {selected.adresse}</p>}
            {selected.quartier && <p className="text-gray-600">🏘️ {selected.quartier}{selected.ville ? `, ${selected.ville}` : ''}</p>}
            {selected.heures_ouverture && (
              <p className="text-gray-600">🕐 {selected.heures_ouverture} – {selected.heures_fermeture}</p>
            )}
            {selected.permanent_24h && <p className="text-secondary font-medium">✅ Ouvert 24h/24</p>}
            {selected.is_on_duty_now && <p className="text-secondary font-medium">🟢 En garde maintenant</p>}
            {selected.jours_garde && <p className="text-gray-600">📅 Jours de garde : {selected.jours_garde}</p>}
            {selected.services?.length > 0 && (
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Services :</p>
                <div className="flex flex-wrap gap-1">
                  {selected.services.map(s => (
                    <span key={s} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2 space-y-2">
              {selected.telephone && (
                <a href={`tel:${selected.telephone}`}
                  className="flex items-center justify-center gap-2 w-full bg-primary text-white py-3 rounded-xl font-medium">
                  📞 Appeler : {selected.telephone}
                </a>
              )}
              {selected.whatsapp && (
                <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-secondary text-white py-3 rounded-xl font-medium">
                  💬 WhatsApp
                </a>
              )}
              {selected.gps && (
                <a href={`https://maps.google.com/?q=${selected.gps}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium">
                  🗺️ Voir sur la carte
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
