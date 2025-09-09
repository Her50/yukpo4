import React, { useState } from 'react';

interface TagSelectorProps {
  options?: string[];
  valeur?: string[];
  onChange: (selected: string[]) => void;
}

const ALL_OPTIONS = ["option1", "option2", "option3"];

const TagSelector: React.FC<TagSelectorProps> = ({ valeur = [], onChange, options = ALL_OPTIONS }) => {
  const [selected, setSelected] = useState<string[]>(valeur);

  const toggle = (val: string) => {
    const updated = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    setSelected(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Sélectionnez les éléments</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            className={`px-3 py-1 rounded-full border ${selected.includes(opt) ? 'bg-primary text-white' : 'bg-white'}`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TagSelector;
