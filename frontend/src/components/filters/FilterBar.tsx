import React, { useState } from 'react';

type Props = {
  onFilter: (filters: Record<string, any>) => void;
};

const FilterBar: React.FC<Props> = ({ onFilter }) => {
  const [categorie, setCategorie] = useState('');
  const [prixMin, setPrixMin] = useState('');
  const [prixMax, setPrixMax] = useState('');
  const [localisation, setLocalisation] = useState('');
  const [disponible, setDisponible] = useState(false);

  const handleSubmit = () => {
    onFilter({
      categorie,
      prix_min: prixMin,
      prix_max: prixMax,
      localisation,
      disponible,
    });
  };

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-white rounded-md shadow-md mb-4">
      <input
        className="border p-2 rounded"
        placeholder="Catégorie"
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
      />
      <input
        className="border p-2 rounded"
        placeholder="Prix Min"
        type="number"
        value={prixMin}
        onChange={(e) => setPrixMin(e.target.value)}
      />
      <input
        className="border p-2 rounded"
        placeholder="Prix Max"
        type="number"
        value={prixMax}
        onChange={(e) => setPrixMax(e.target.value)}
      />
      <input
        className="border p-2 rounded"
        placeholder="Localisation"
        value={localisation}
        onChange={(e) => setLocalisation(e.target.value)}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={disponible}
          onChange={(e) => setDisponible(e.target.checked)}
        />
        Disponible
      </label>
      <button
        onClick={handleSubmit}
        className="bg-[#C8102E] text-white px-4 py-2 rounded"
      >
        Filtrer
      </button>
    </div>
  );
};

export default FilterBar;
