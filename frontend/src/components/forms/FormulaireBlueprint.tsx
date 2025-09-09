// 📦 Yukpo – Formulaire basé sur un modèle détecté
// @ts-nocheck

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/buttons";

export function FormulaireBlueprint({ model }) {
  return (
    <div className="space-y-4 border p-4 rounded-lg bg-white shadow mt-6">
      <h2 className="text-lg font-semibold text-green-700">
        📘 Modèle détecté : {model.name}
      </h2>
      <p className="text-sm text-gray-500">{model.description}</p>

      {model.champs_specifiques.map((champ, i) => (
        <Input key={i} placeholder={champ} />
      ))}

      <Button className="mt-4">📤 Soumettre ce service</Button>
    </div>
  );
}
