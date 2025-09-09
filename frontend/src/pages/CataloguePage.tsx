// src/pages/CataloguePage.tsx
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/routes/AppRoutesRegistry";

interface ServiceItem {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  type: string;
  plan_minimal: "free" | "pro" | "enterprise";
}

const mockServices: ServiceItem[] = [
  {
    id: "1",
    nom: "Yukpo Immobilier",
    description: "Publication et gestion de biens immobiliers",
    categorie: "Immobilier",
    type: "plateforme",
    plan_minimal: "free",
  },
  {
    id: "2",
    nom: "Yukpo Transport",
    description: "Réservation de billets et hôtels",
    categorie: "Transport",
    type: "service",
    plan_minimal: "pro",
  },
  {
    id: "3",
    nom: "Yukpo Social Listening",
    description: "Suivi intelligent des tendances sociales",
    categorie: "Analyse & Intelligence",
    type: "moteur",
    plan_minimal: "enterprise",
  },
];

const CataloguePage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<ServiceItem[]>([]);

  useEffect(() => {
    setFiltered(
      mockServices.filter((s) =>
        s.nom.toLowerCase().includes(query.toLowerCase()) ||
        s.description.toLowerCase().includes(query.toLowerCase())
      )
    );
  }, [query]);

  return (
    <AppLayout>
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-center mb-6">
            🎯 Catalogue des services disponibles
          </h1>

          <Input
            type="text"
            placeholder="Rechercher un service..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full mb-6"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((service) => (
              <Card key={service.id} className="shadow-md border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">{service.nom}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-800 rounded">
                      {service.categorie}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {service.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {service.type.toUpperCase()}
                    </span>
                    <Button className="text-xs px-3 py-1 bg-primary hover:bg-primary/80 text-white rounded">
                      Découvrir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-gray-500 mt-10">
              Aucun service ne correspond à votre recherche.
            </p>
          )}
        </div>
      </section>
    </AppLayout>
  );
};

export default CataloguePage;
