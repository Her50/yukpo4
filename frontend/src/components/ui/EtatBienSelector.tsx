import React from "react";
import { Select } from "@/components/ui/select";
import { Info } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const EtatBienSelector: React.FC<Props> = ({ value, onChange }) => {
  const options = [
    {
      label: "🆕 Neuf",
      value: "neuf",
      description: "Bien jamais utilisé, encore sous garantie ou étiquette."
    },
    {
      label: "♻️ Occasion",
      value: "occasion",
      description: "Déjà utilisé, mais en bon état général."
    },
    {
      label: "🛠️ Réparable",
      value: "reparable",
      description: "Usagé ou endommagé mais potentiellement réutilisable."
    }
  ];

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium flex items-center gap-1">
        État du bien
        <Info size={14} className="text-muted-foreground" />
      </label>

      <div className="w-full sm:w-60">
        <Select
          options={options.map(({ label, value }) => ({ label, value }))}
          defaultValue={value}
          onValueChange={onChange}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {options.find((opt) => opt.value === value)?.description || "Sélectionnez l'état du bien."}
      </p>
    </div>
  );
};

export default EtatBienSelector;
