// @ts-check
import React, { useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from "axios";
import { Button } from "@/components/ui/buttons";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const ScraperDashboard: React.FC = () => {
  const [urls, setUrls] = useState<string>("https://example.com,https://exemple.cm");
  const [result, setResult] = useState<any[]>([]);

  const launchScraper = async () => {
    try {
      const list = urls.split(",").map((u) => u.trim());
      const res = await axios.get("/scraper/launch", { params: { urls: list } });
      setResult(res.data.results || []);
    } catch (err) {
      console.error("Erreur lors du scraping :", err);
      alert("❌ Une erreur est survenue lors du scraping.");
    }
  };

  return (
    <ResponsiveContainer className="py-10">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">🕷️ Scraper <span className="text-primary font-bold">Yukpo</span></h2>

      <textarea
        className="w-full border rounded p-3 mb-4 text-sm"
        rows={3}
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder="Collez ici les URLs à scraper, séparées par des virgules"
      />

      <Button onClick={launchScraper} className="mb-6">
        🚀 Lancer le scraping
      </Button>

      {result.length > 0 ? (
        <ul className="space-y-2">
          {result.map((r, i) => (
            <li key={i} className="border p-3 rounded bg-gray-50">
              <p><strong>Nom :</strong> {r.name}</p>
              <p><strong>URL :</strong> {r.url}</p>
              <p><strong>Localisation :</strong> {r.location}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">Aucun résultat pour l’instant.</p>
      )}

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-10 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="text-blue-600 underline hover:text-blue-800">
          Découvrir d'autres services
        </a>
        <a href={ROUTES.PLANS} className="text-blue-600 underline hover:text-blue-800">
          Voir les formules
        </a>
        <a href={ROUTES.CONTACT} className="text-blue-600 underline hover:text-blue-800">
          Contacter l'équipe Yukpo
        </a>
      </div>
    </ResponsiveContainer>
  );
};

export default ScraperDashboard;
