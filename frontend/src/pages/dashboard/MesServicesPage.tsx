// @ts-check
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useUser } from "@/hooks/useUser";
import { useUserPlan } from "@/hooks/useUserPlan";
import BusinessServiceCard from "@/components/cards/ServiceCard";

const YukpoBrand = () => (
  <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-bold">
    Yukpo
  </span>
);

interface Service {
  id: number;
  nom: string;
  description: string;
  categorie?: string;
  plan: "free" | "pro" | "enterprise";
}

const MesServices: React.FC = () => {
  const { user } = useUser();
  const { plan } = useUserPlan();
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    const fullList: Service[] = [
      {
        id: 1,
        nom: "Yukpo Immobilier",
        description: "Publier et gérer vos annonces immobilières professionnelles.",
        plan: "free",
      },
      {
        id: 2,
        nom: "Yukpo Transport",
        description: "Réservation de billets et hôtels partenaires.",
        plan: "pro",
      },
      {
        id: 3,
        nom: "Yukpo Partenaires",
        description: "Accès aux prestataires validés et services complémentaires.",
        plan: "enterprise",
      },
    ];

    const tiers = ["free", "pro", "enterprise"];
    const filtered = fullList.filter((s) => tiers.indexOf(plan) >= tiers.indexOf(s.plan));
    setServices(filtered);
  }, [plan]);

  return (
    <AppLayout>
      <section className="py-16 px-4 font-sans text-center bg-white dark:bg-gray-900">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
          ⚙️ Mes services <YukpoBrand />
        </h1>

        {services.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            Aucun service disponible avec votre formule actuelle.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-8">
            {services.map((s) => (
              <BusinessServiceCard
                key={s.id}
                nom={s.nom}
                description={s.description}
                plan_requis={s.plan} // ✅ Maintenant reconnu
              />
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
};

export default MesServices;
