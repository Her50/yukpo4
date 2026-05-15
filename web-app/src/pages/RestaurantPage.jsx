import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Modal from '../components/Modal'
import { restaurantApi } from '../api/restaurant'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const VILLES = ['', 'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua']

function RestaurantCard({ r, onClick }) {
  return (
    <div onClick={() => onClick(r)} className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer active:bg-gray-50">
      {r.image_url && (
        <img src={r.image_url} alt={r.nom} className="w-full h-36 object-cover" />
      )}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800">{r.nom || r.service_name}</h3>
        {r.quartier && <p className="text-sm text-gray-500 mt-0.5">📍 {r.quartier}{r.ville ? `, ${r.ville}` : ''}</p>}
        <div className="flex items-center gap-2 mt-2">
          {r.note_moyenne && (
            <span className="text-yellow-500 text-sm">⭐ {parseFloat(r.note_moyenne).toFixed(1)}</span>
          )}
          {r.cuisine_type && (
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{r.cuisine_type}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuSection({ categorie, items, panier, onAdd, onRemove }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-gray-700 px-4 py-2 bg-gray-50">{categorie}</h3>
      <div className="divide-y divide-gray-100">
        {items.map(item => {
          const qty = panier[item.id] || 0
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              {item.image_url && (
                <img src={item.image_url} alt={item.nom} className="w-14 h-14 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{item.nom}</p>
                {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>}
                <p className="text-primary font-semibold text-sm mt-1">{item.prix?.toLocaleString()} FCFA</p>
              </div>
              {item.is_disponible !== false ? (
                <div className="flex items-center gap-2 shrink-0">
                  {qty > 0 && (
                    <>
                      <button onClick={() => onRemove(item)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">−</button>
                      <span className="w-5 text-center font-semibold">{qty}</span>
                    </>
                  )}
                  <button onClick={() => onAdd(item)} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold">+</button>
                </div>
              ) : (
                <span className="text-xs text-gray-400 shrink-0">Indispo.</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RestaurantPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('liste')
  const [query, setQuery] = useState('')
  const [ville, setVille] = useState('')
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [selectedResto, setSelectedResto] = useState(null)
  const [menu, setMenu] = useState([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [panier, setPanier] = useState({})
  const [orderModal, setOrderModal] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(null)
  const [history, setHistory] = useState([])

  async function loadListe() {
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await restaurantApi.list(ville)
      setRestaurants(Array.isArray(data) ? data : data.restaurants || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function searchRestos(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await restaurantApi.search(query, ville)
      setRestaurants(Array.isArray(data) ? data : data.restaurants || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function openResto(r) {
    setSelectedResto(r)
    setPanier({})
    setMenuLoading(true)
    try {
      const data = await restaurantApi.getMenu(r.service_id || r.id)
      setMenu(Array.isArray(data) ? data : data.items || data.menu || [])
    } catch (e) { setMenu([]) } finally { setMenuLoading(false) }
  }

  async function loadHistory() {
    if (!user) return
    setLoading(true)
    try {
      const data = await restaurantApi.getHistory()
      setHistory(Array.isArray(data) ? data : data.orders || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'historique' && user) loadHistory()
    if (tab === 'liste') loadListe()
  }, [tab])

  function addItem(item) {
    setPanier(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))
  }

  function removeItem(item) {
    setPanier(p => {
      const n = { ...p }
      if (n[item.id] > 1) n[item.id]--
      else delete n[item.id]
      return n
    })
  }

  const panierItems = menu.filter(i => panier[i.id] > 0)
  const totalPanier = panierItems.reduce((s, i) => s + i.prix * panier[i.id], 0)

  async function passCommande() {
    if (!user) { navigate('/login'); return }
    setOrderLoading(true)
    try {
      const items = panierItems.map(i => ({ menu_item_id: i.id, quantity: panier[i.id] }))
      const data = await restaurantApi.placeOrder(selectedResto.service_id || selectedResto.id, items, null)
      setOrderSuccess(data)
      setPanier({})
      setOrderModal(false)
    } catch (e) { alert(e.message) } finally { setOrderLoading(false) }
  }

  const categoriesMenu = [...new Set(menu.map(i => i.categorie || 'Menu'))].filter(Boolean)

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="🍽️ Restaurant" />

      <div className="flex gap-1 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'liste', label: '🏪 Restaurants' },
          { id: 'search', label: '🔍 Chercher' },
          { id: 'historique', label: '🧾 Mes commandes' },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setRestaurants([]); setSearched(false); setSelectedResto(null) }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'liste' || tab === 'search') && !selectedResto && (
        <form onSubmit={tab === 'search' ? searchRestos : (e) => { e.preventDefault(); loadListe() }} className="px-4 space-y-2 pb-3">
          <select className="input" value={ville} onChange={e => setVille(e.target.value)}>
            {VILLES.map(v => <option key={v} value={v}>{v || 'Toutes les villes'}</option>)}
          </select>
          {tab === 'search' && (
            <input className="input" placeholder="Nom du restaurant, cuisine..." value={query}
              onChange={e => setQuery(e.target.value)} />
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60">
            {loading ? 'Chargement...' : tab === 'liste' ? 'Voir les restaurants' : 'Rechercher'}
          </button>
        </form>
      )}

      <div className="flex-1 pb-28 overflow-y-auto">
        {error && <p className="text-danger text-sm text-center py-4 px-4">{error}</p>}

        {!selectedResto && (tab === 'liste' || tab === 'search') && (
          <div className="px-4 space-y-3">
            {searched && !loading && restaurants.length === 0 && !error && (
              <p className="text-gray-400 text-center py-8">Aucun restaurant trouvé</p>
            )}
            {restaurants.map((r, i) => (
              <RestaurantCard key={r.id || i} r={r} onClick={openResto} />
            ))}
          </div>
        )}

        {selectedResto && (
          <div>
            <div className="bg-white px-4 py-3 flex items-center gap-3 border-b">
              <button onClick={() => setSelectedResto(null)} className="text-primary font-medium">← Retour</button>
              <h2 className="font-semibold text-gray-800 flex-1 truncate">{selectedResto.nom || selectedResto.service_name}</h2>
            </div>

            {orderSuccess && (
              <div className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
                ✅ Commande passée avec succès ! Réf : {orderSuccess.id || orderSuccess.order_id}
              </div>
            )}

            {menuLoading && <p className="text-center text-gray-400 py-8">Chargement du menu...</p>}

            {!menuLoading && menu.length === 0 && (
              <p className="text-gray-400 text-center py-8">Menu non disponible</p>
            )}

            {categoriesMenu.map(cat => (
              <MenuSection
                key={cat}
                categorie={cat}
                items={menu.filter(i => (i.categorie || 'Menu') === cat)}
                panier={panier}
                onAdd={addItem}
                onRemove={removeItem}
              />
            ))}

            {panierItems.length > 0 && (
              <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40">
                <button onClick={() => setOrderModal(true)}
                  className="w-full bg-primary text-white py-3 px-4 rounded-xl font-medium shadow-lg flex items-center justify-between">
                  <span>🛒 Voir mon panier ({panierItems.length} article{panierItems.length > 1 ? 's' : ''})</span>
                  <span className="font-bold">{totalPanier.toLocaleString()} FCFA</span>
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'historique' && (
          <div className="px-4 space-y-3">
            {!user && (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-3">Connectez-vous pour voir vos commandes</p>
                <button onClick={() => navigate('/login')} className="bg-primary text-white px-6 py-2 rounded-xl font-medium">
                  Se connecter
                </button>
              </div>
            )}
            {user && !loading && history.length === 0 && (
              <p className="text-gray-400 text-center py-8">Aucune commande passée</p>
            )}
            {history.map((o, i) => (
              <div key={o.id || i} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">Commande #{o.id}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{o.restaurant_nom || o.service_name}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    o.statut === 'livree' ? 'bg-green-100 text-green-700' :
                    o.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'}`}>
                    {o.statut || o.status}
                  </span>
                </div>
                <p className="text-primary font-semibold mt-2">{o.montant_total?.toLocaleString()} FCFA</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={orderModal} onClose={() => setOrderModal(false)} title="Mon panier">
        <div className="space-y-3">
          {panierItems.map(item => (
            <div key={item.id} className="flex justify-between items-center">
              <div className="flex-1">
                <p className="font-medium text-gray-800 text-sm">{item.nom}</p>
                <p className="text-xs text-gray-400">{item.prix?.toLocaleString()} FCFA × {panier[item.id]}</p>
              </div>
              <p className="font-semibold text-primary">{(item.prix * panier[item.id]).toLocaleString()} FCFA</p>
            </div>
          ))}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-800">Total</span>
            <span className="font-bold text-primary text-lg">{totalPanier.toLocaleString()} FCFA</span>
          </div>
          <button onClick={passCommande} disabled={orderLoading}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-60 mt-2">
            {orderLoading ? 'Envoi...' : user ? 'Passer la commande' : 'Se connecter pour commander'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
