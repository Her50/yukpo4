import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Header({ title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleAuth() {
    if (user) {
      logout()
    } else {
      navigate('/login')
    }
  }

  return (
    <header className="bg-primary text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      <button
        onClick={handleAuth}
        className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
      >
        {user ? `${user.prenom || user.nom || 'Moi'} ↩` : 'Connexion'}
      </button>
    </header>
  )
}
