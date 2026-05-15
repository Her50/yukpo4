import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', nom: '', prenom: '', telephone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register({ email: form.email, password: form.password, nom: form.nom, prenom: form.prenom, telephone: form.telephone })
      }
      navigate(-1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4 py-8">
      <div className="max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🌍</div>
          <h1 className="text-2xl font-bold text-gray-800">Yukpo</h1>
          <p className="text-gray-500 text-sm">Pharmacie · Livres · Restaurant</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
            >
              Connexion
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'register' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <>
                <input
                  className="input"
                  type="text"
                  placeholder="Prénom"
                  value={form.prenom}
                  onChange={(e) => update('prenom', e.target.value)}
                  required
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Nom"
                  value={form.nom}
                  onChange={(e) => update('nom', e.target.value)}
                  required
                />
                <input
                  className="input"
                  type="tel"
                  placeholder="Téléphone"
                  value={form.telephone}
                  onChange={(e) => update('telephone', e.target.value)}
                />
              </>
            )}
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
            />

            {error && <p className="text-danger text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-medium disabled:opacity-60"
            >
              {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>
        </div>

        <button onClick={() => navigate(-1)} className="mt-4 w-full text-center text-gray-400 text-sm">
          Continuer sans compte
        </button>
      </div>
    </div>
  )
}
