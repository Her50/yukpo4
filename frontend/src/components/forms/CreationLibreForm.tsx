// 📦 Yukpo – Création libre d’un service (mobile-ready)
// @ts-check

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/buttons";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

interface CreationLibreFormProps {
  texteInitial: string;
}

export function CreationLibreForm({ texteInitial }: CreationLibreFormProps) {
  const [openMenu, setOpenMenu] = useState(false);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState(texteInitial);
  const [prix, setPrix] = useState("");

  const handleSubmit = () => {
    if (!titre || !description) {
      alert("Merci de remplir au moins le titre et la description.");
      return;
    }
    alert(`✅ Service "${titre}" prêt à être publié !`);
    // 🔁 Envoi vers API à insérer ici
  };

  return (
    <div className="relative w-full max-w-md mx-auto px-4 py-6 sm:px-6 lg:px-8 bg-white rounded-lg shadow-md">
      {/* 🔽 Menu mobile collapsible */}
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
          <h2 className="text-lg font-semibold mb-4 text-primary">🔧 Options rapides</h2>
          <ul className="space-y-2 text-sm">
            <li><Button variant="ghost" className="w-full">📋 Mes services</Button></li>
            <li><Button variant="ghost" className="w-full">🔧 Modifier un service</Button></li>
            <li><Button variant="ghost" className="w-full">🏪 Ma vitrine</Button></li>
          </ul>
        </SheetContent>
      </Sheet>

      {/* 🧱 Formulaire principal */}
      <h1 className="text-xl font-bold text-center mb-4 text-red-600">🧱 Créer un service libre avec Yukpo</h1>
      <p className="text-sm text-center text-gray-500 mb-6">
        Yukpo n’a pas reconnu de modèle existant. Créez manuellement votre service.
      </p>

      <div className="space-y-4">
        <Input placeholder="Titre du service" value={titre} onChange={(e) => setTitre(e.target.value)} />
        <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input placeholder="Prix estimatif (en FCFA)" value={prix} onChange={(e) => setPrix(e.target.value)} />

        <Button className="w-full mt-4" onClick={handleSubmit}>
          📤 Publier ce service librement
        </Button>
      </div>
    </div>
  );
}
