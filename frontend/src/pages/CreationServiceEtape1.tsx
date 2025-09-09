// 📦 Yukpo – Étape 1 de création de service (version responsive + IA)
// @ts-nocheck

import React, { useState } from "react";
import axios from "axios";
import { AffinerBesoinPanel } from "@/components/AffinerBesoinPanel";
import { FormulaireBlueprint } from "@/components/FormulaireBlueprint";
import { CreationLibreForm } from "@/components/CreationLibreForm";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/buttons";

export default function CreationServiceEtape1() {
  const [texte, setTexte] = useState("");
  const [matchResult, setMatchResult] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);

  const handleAnalyse = async () => {
    const res = await axios.post("/api/match/blueprint", {
      texte,
      plan: "pro", // ou "free", "enterprise", etc.
    });
    setMatchResult(res.data);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8 bg-white rounded-lg shadow">
      {/* ☰ Menu mobile latéral */}
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
            <li><Button variant="ghost" className="w-full">📋 Mes services</Button></li>
            <li><Button variant="ghost" className="w-full">🔧 Modifier un service</Button></li>
            <li><Button variant="ghost" className="w-full">🏪 Ma vitrine</Button></li>
          </ul>
        </SheetContent>
      </Sheet>

      <h1 className="text-2xl font-bold text-center text-primary mb-4">🧠 Étape 1 : Analyse de votre service</h1>

      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Décrivez le service que vous souhaitez créer..."
        className="w-full border rounded p-3 mb-4"
      />

      <Button className="mb-6" onClick={handleAnalyse}>
        🔍 Lancer l’analyse Yukpo
      </Button>

      {/* Résultats IA dynamiques */}
      {matchResult?.decision === "use_existing" && matchResult.model && (
        <FormulaireBlueprint model={matchResult.model} />
      )}

      {matchResult?.decision === "affiner" && <AffinerBesoinPanel texteInitial={texte} />}

      {matchResult?.decision === "create_new" && <CreationLibreForm texteInitial={texte} />}
    </div>
  );
}
