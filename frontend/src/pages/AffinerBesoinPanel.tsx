// 📦 Yukpo – Affinage intelligent des besoins utilisateur (responsive)
// @ts-nocheck

import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/buttons";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const AffinerBesoinPanel = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { texte = "" } = state || {};

  const [texteAffiné, setTexteAffiné] = useState(texte);
  const [loading, setLoading] = useState(false);
  const [blueprintFields, setBlueprintFields] = useState([]);
  const [dynamicValues, setDynamicValues] = useState({});
  const [localisation, setLocalisation] = useState("");
  const [budget, setBudget] = useState("");
  const [frequence, setFrequence] = useState("");
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    if (texte) {
      axios.post("/api/match/blueprint", { texte }).then((res) => {
        setBlueprintFields(res.data?.champs_specifiques || []);
      }).catch(() => {
        console.warn("🔍 Aucun modèle Yukpo détecté.");
      });
    }
  }, [texte]);

  const handleRelancerAnalyse = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("texte", texteAffiné);
    formData.append("localisation", localisation);
    formData.append("budget", budget);
    formData.append("frequence", frequence);
    Object.entries(dynamicValues).forEach(([k, v]) => {
      formData.append(k, v);
    });

    try {
      const res = await axios.post("/api/analyse-visuelle", formData);
      navigate("/resultats-besoin", {
        state: {
          resultats: res.data?.correspondances || [],
          type: "affinage",
        },
      });
    } catch (err) {
      alert("❌ Erreur lors de l’analyse Yukpo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDynamicChange = (field, value) => {
    setDynamicValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout padding>
      <div className="relative max-w-3xl mx-auto py-10 space-y-6 px-4 sm:px-6 lg:px-8 bg-white rounded shadow">
        {/* ☰ Sheet menu mobile */}
        <Sheet open={openMenu} onOpenChange={setOpenMenu}>
          <SheetTrigger asChild>
            <button
              className="absolute top-4 right-4 text-gray-600 hover:text-primary focus:outline-none"
              onClick={() => setOpenMenu(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-4 bg-white border-l border-gray-200">
            <h2 className="text-lg font-semibold mb-4 text-primary">⚙️ Options</h2>
            <ul className="space-y-2 text-sm">
              <li><Button variant="ghost" className="w-full">📋 Mes besoins</Button></li>
              <li><Button variant="ghost" className="w-full">🧪 Tester un autre besoin</Button></li>
            </ul>
          </SheetContent>
        </Sheet>

        <h1 className="text-2xl font-bold text-center text-primary">
          🛠️ Yukpo affine votre besoin
        </h1>
        <p className="text-sm text-gray-600 text-center">
          Quelques précisions supplémentaires aideront Yukpo à mieux répondre à votre demande.
        </p>

        <Textarea
          value={texteAffiné}
          onChange={(e) => setTexteAffiné(e.target.value)}
          placeholder="Affinez votre description ici..."
        />

        <Input
          placeholder="📍 Ville / Quartier"
          value={localisation}
          onChange={(e) => setLocalisation(e.target.value)}
        />

        <Input
          placeholder="💰 Budget maximum (FCFA)"
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />

        <select
          className="border rounded px-3 py-2 w-full"
          value={frequence}
          onChange={(e) => setFrequence(e.target.value)}
        >
          <option value="">📆 Fréquence souhaitée</option>
          <option value="ponctuel">Ponctuel</option>
          <option value="hebdomadaire">Hebdomadaire</option>
          <option value="mensuel">Mensuel</option>
        </select>

        {blueprintFields.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold mt-6">🔎 Détails spécifiques Yukpo</h2>
            {blueprintFields.map((field, i) => (
              <Input
                key={i}
                placeholder={field}
                value={dynamicValues[field] || ""}
                onChange={(e) => handleDynamicChange(field, e.target.value)}
              />
            ))}
          </div>
        )}

        <div className="text-center mt-6">
          <Button onClick={handleRelancerAnalyse} disabled={loading}>
            {loading ? "Chargement..." : "📤 Relancer l’analyse Yukpo"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AffinerBesoinPanel;
