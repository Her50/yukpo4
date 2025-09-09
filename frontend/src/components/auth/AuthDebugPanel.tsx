import React, { useState } from 'react';
import { login, logout, toggleDevMode } from '@/lib/yukpoaclient';
import { useUser } from '@/hooks/useUser';

export const AuthDebugPanel: React.FC = () => {
  const [email, setEmail] = useState('admin@yukpo.dev');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useUser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await login(email, password);
      window.location.reload(); // Recharger pour mettre à jour l'état utilisateur
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleToggleDevMode = () => {
    toggleDevMode();
  };

  // Si l'utilisateur est connecté, afficher les infos
  if (user) {
    return (
      <div className="auth-debug-panel bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold text-green-800 mb-2">✅ Utilisateur connecté</h3>
        <div className="space-y-1 text-sm">
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Rôle:</strong> {user.role}</p>
          <p><strong>Crédits:</strong> {user.credits} {user.currency}</p>
        </div>
        <div className="mt-3 space-x-2">
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Se déconnecter
          </button>
          <button
            onClick={handleToggleDevMode}
            className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
          >
            Mode Dev
          </button>
        </div>
      </div>
    );
  }

  // Sinon, afficher le formulaire de connexion
  return (
    <div className="auth-debug-panel bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-blue-800 mb-3">🔐 Connexion</h3>
      
      <form onSubmit={handleLogin} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
          />
        </div>
        
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          
          <button
            type="button"
            onClick={handleToggleDevMode}
            className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            Mode Dev
          </button>
        </div>
      </form>
      
      <div className="mt-3 text-xs text-gray-600">
        <p>💡 <strong>Mode Dev:</strong> Utilise un token de bypass sans authentification réelle</p>
        <p>💡 <strong>Connexion:</strong> Utilise l'authentification JWT réelle</p>
      </div>
    </div>
  );
};
