import React, { useState, useEffect } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import RequireAccess from "@/components/auth/RequireAccess";
import { useUser } from "@/hooks/useUser";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const MonProfil: React.FC = () => {
  const { user, login } = useUser();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    photo: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: (user as any).name || "",
        email: user.email || "",
        photo: (user as any).photo || (user as any).picture || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ ...(user as any), ...formData });
    alert("✅ Profil mis à jour localement.");
  };

  const handlePasswordChange = () => {
    alert("🔐 Redirection vers changement de mot de passe (à implémenter).");
  };

  if (!user) {
    return (
      <p className="p-4 text-center text-red-600">
        Vous devez être connecté pour voir cette page.
      </p>
    );
  }

  return (
    <RequireAccess role="user" plan="pro">
      <ResponsiveContainer className="py-10">
        <h1 className="text-2xl font-bold mb-6">👤 Mon Profil</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl mx-auto">
          <label className="flex flex-col">
            Nom complet
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </label>

          <label className="flex flex-col">
            Adresse email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </label>

          <label className="flex flex-col">
            URL photo de profil
            <input
              type="text"
              name="photo"
              value={formData.photo}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </label>

          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              💾 Enregistrer
            </button>
            <button
              type="button"
              onClick={handlePasswordChange}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              🔐 Changer mon mot de passe
            </button>
          </div>
        </form>

        {/* 🚀 CONTEXTUAL BUTTONS */}
        <div className="mt-10 flex flex-wrap gap-4 justify-center text-sm">
          <a href={ROUTES.SERVICES} className="text-blue-600 hover:underline">
            Découvrir d'autres services
          </a>
          <a href={ROUTES.PLANS} className="text-blue-600 hover:underline">
            Voir les formules
          </a>
          <a href={ROUTES.CONTACT} className="text-blue-600 hover:underline">
            Contacter l’équipe{" "}
            <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
              Yukpo
            </span>
          </a>
        </div>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default MonProfil;
