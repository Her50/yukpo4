// ✅ src/pages/ServicesPage.tsx (version publique, branding Yukpo appliqué, IA supprimée)
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { useUser } from "@/hooks/useUser";
import { useUserPlan } from "@/hooks/useUserPlan";

const YukpoBrand = () => (
  <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-bold">
    Yukpo
  </span>
);

interface Service {
  id: number;
  nom: string;
  description: string;
  icon?: string;
  categorie?: string;
  plan?: "free" | "pro" | "enterprise";
}

const ServicesPage: React.FC = () => {
  const { user } = useUser();
  const { plan } = useUserPlan();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setServices([
        {
          id: 1,
          nom: "Yukpo Immobilier",
          description: "Publier des biens professionnels",
          plan: "free",
        },
        {
          id: 2,
          nom: "Yukpo Transport",
          description: "Réserver billets ou hôtels partenaires",
          plan: "pro",
        },
      ]);
    }, 500);
  }, []);

  const isAllowed = (s: Service) => {
    const tiers = ["free", "pro", "enterprise"];
    return user && tiers.indexOf(plan) >= tiers.indexOf(s.plan || "free");
  };

  const handleClick = (id: number) => {
    navigate(`/services/${id}`);
  };

  return (
    <AppLayout>
      <section className="py-16 px-4 font-sans text-center bg-gradient-to-br from-yellow-50 via-white to-red-50">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-12">
          Comment <YukpoBrand /> peut vous aider ?
        </h1>

        {/* Bloc 1 - Accès rapides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 shadow-md p-6 rounded-lg hover:shadow-lg transition">
            <h3 className="text-lg font-bold mb-2">🎯 Trouver un service</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Exprimez un besoin, <YukpoBrand /> vous connecte automatiquement.
            </p>
            <button
              onClick={() => navigate(ROUTES.MATCH)}
              className="mt-4 text-primary underline text-sm"
            >
              Lancer une recherche
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-md p-6 rounded-lg hover:shadow-lg transition">
            <h3 className="text-lg font-bold mb-2">⚙️ Créer un service</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Service assisté personnalisé en quelques clics.
            </p>
            <button
              onClick={() => navigate(ROUTES.SERVICE_CREATE)}
              className="mt-4 text-primary underline text-sm"
            >
              Créer maintenant
            </button>
          </div>
        </div>

        {/* Bloc 2 - Liste des services dynamiques */}
        <h2 className="text-2xl font-bold mb-6">📦 Services disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {services.map(
            (s) =>
              isAllowed(s) && (
                <div
                  key={s.id}
                  onClick={() => handleClick(s.id)}
                  className="cursor-pointer border p-5 rounded-lg hover:shadow-lg bg-white dark:bg-gray-800"
                >
                  <h3 className="text-lg font-bold">{s.nom}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{s.description}</p>
                  <span className="text-xs mt-2 inline-block bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-2 py-1 rounded">
                    {s.plan?.toUpperCase()}
                  </span>
                </div>
              )
          )}
        </div>

        {/* Bloc 3 - Boutons contextuels */}
        <div className="mt-16 flex flex-wrap gap-4 justify-center text-sm">
          <a
            href={ROUTES.PLANS}
            className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
          >
            Voir les formules
          </a>
          <a
            href={ROUTES.CONTACT}
            className="px-4 py-2 bg-gray-100 border text-gray-800 rounded hover:bg-gray-200 transition"
          >
            Contacter l'équipe <YukpoBrand />
          </a>
        </div>
      </section>
    </AppLayout>
  );
};

export default ServicesPage;
