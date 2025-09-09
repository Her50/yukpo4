// @ts-check
import React, { useState, useEffect } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import BusinessServiceCard from "@/components/cards/BusinessServiceCard";

interface Service {
  id: number;
  nom: string;
  description: string;
  categorie: string;
  prix: number;
  plan_requis?: "free" | "pro" | "enterprise";
  badge?: string;
  note?: number;
}

const ExplorePage: React.FC = () => {
  const [categorie, setCategorie] = useState("all");
  const [services, setServices] = useState<Service[]>([]);
  const categories = ["all", "immobilier", "assistance", "communication", "mobilier"];

  useEffect(() => {
    fetch("/data/services.json")
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error("Erreur chargement services.json", err));
  }, []);

  const filtered = categorie === "all"
    ? services
    : services.filter((s) => s.categorie === categorie);

  return (
    <ResponsiveContainer className="py-8">
      <h1 className="text-2xl font-bold mb-4">🌐 Explorer les services disponibles</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategorie(cat)}
            className={`px-4 py-2 rounded-full border ${
              categorie === cat ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filtered.map((service) => (
          <BusinessServiceCard
            key={service.id}
            nom={service.nom}
            description={service.description}
            categorie={service.categorie}
            prix={service.prix}
            plan_requis={service.plan_requis}
            badge={service.badge}
            note={service.note}
          />
        ))}
      </div>
    </ResponsiveContainer>
  );
};

export default ExplorePage;
