import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import { useUser } from '@/hooks/useUser';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/config/api';

const PartnerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useUser();
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    confirmPassword: '',
    partner_type: '' as 'pharmacie' | 'hopital' | 'laboratoire' | 'agence de voyage' | '',
    partner_name: '',
    partner_phone: '',
    partner_address: '',
    partner_city: '',
    partner_country: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const partnerTypes = [
    { value: 'pharmacie', label: 'Pharmacie' },
    { value: 'hopital', label: 'Hôpital/Clinique' },
    { value: 'laboratoire', label: 'Laboratoire' },
    { value: 'agence de voyage', label: 'Agence de Voyage' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!form.nom || !form.email || !form.password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!form.partner_type) {
      setError('Veuillez sélectionner un type de partenaire');
      return;
    }

    if (!form.partner_name) {
      setError('Le nom de votre établissement est obligatoire');
      return;
    }

    // Validation du mot de passe
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(form.password)) {
      setError('Mot de passe trop faible : 8 caractères, 1 majuscule, 1 chiffre minimum.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          name: form.nom || form.prenom || `${form.nom} ${form.prenom}`.trim(),
          email: form.email,
          password: form.password,
          lang: 'fr',
          is_partner: true,
          partner_type: form.partner_type,
          partner_name: form.partner_name,
          partner_phone: form.partner_phone,
          partner_address: form.partner_address,
          partner_city: form.partner_city,
          partner_country: form.partner_country,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Inscription réussie ! Votre compte partenaire est en attente de validation.');
        navigate(ROUTES.LOGIN, {
          state: {
            message: 'Votre compte partenaire est en attente de validation. Vous recevrez un email une fois approuvé.',
          },
        });
      } else {
        const err = await res.json();
        setError(err.message || "Erreur d'inscription");
        toast.error(err.message || "Erreur d'inscription");
      }
    } catch (err) {
      setError("Échec de la connexion au serveur.");
      toast.error("Échec de la connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-yellow-50 pt-24">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">
          Devenir partenaire{" "}
          <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </span>
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Créez votre compte partenaire. Votre compte sera validé par un administrateur.
        </p>

        {error && (
          <div className="mb-4 bg-red-100 text-red-800 px-4 py-2 rounded shadow text-center">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informations personnelles */}
          <div className="border-b pb-4 mb-4">
            <h2 className="text-xl font-semibold mb-4">Informations personnelles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="nom"
                placeholder="Nom *"
                value={form.nom}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              />
              <input
                type="text"
                name="prenom"
                placeholder="Prénom *"
                value={form.prenom}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              />
              <input
                type="email"
                name="email"
                placeholder="Email *"
                value={form.email}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              />
              <input
                type="password"
                name="password"
                placeholder="Mot de passe *"
                value={form.password}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirmer le mot de passe *"
                value={form.confirmPassword}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Informations partenaire */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Informations de votre établissement</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'établissement *
              </label>
              <select
                name="partner_type"
                value={form.partner_type}
                onChange={handleChange}
                className="w-full p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              >
                <option value="">Sélectionner un type</option>
                {partnerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="partner_name"
                placeholder="Nom de l'établissement *"
                value={form.partner_name}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                required
                disabled={loading}
              />
              <input
                type="tel"
                name="partner_phone"
                placeholder="Téléphone"
                value={form.partner_phone}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
              <input
                type="text"
                name="partner_address"
                placeholder="Adresse"
                value={form.partner_address}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary md:col-span-2"
                disabled={loading}
              />
              <input
                type="text"
                name="partner_city"
                placeholder="Ville"
                value={form.partner_city}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
              <input
                type="text"
                name="partner_country"
                placeholder="Pays"
                value={form.partner_country}
                onChange={handleChange}
                className="p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md transition font-semibold disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Inscription...' : "S'inscrire comme partenaire"}
          </button>
        </form>

        <p className="text-center text-sm mt-6 text-gray-700">
          <Link to={ROUTES.LOGIN} className="text-primary underline font-medium">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
};

export default PartnerRegisterPage;

