// @generated
import React, { useState } from 'react';

interface Service {
  id: number;
  name: string;
  category: string;
  price: number;
  features: string[];
}

interface Props {
  items: Service[];
}

const AdvancedSearch: React.FC<Props> = ({ items }) => {
  const [query, setQuery] = useState('');

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6">
      <input
        type="text"
        placeholder="Rechercher un service..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="p-2 border rounded w-full"
      />

      <ul className="mt-4 space-y-2">
        {filteredItems.map((item) => (
          <li
            key={item.id}
            className="border p-4 rounded shadow-sm bg-white hover:shadow-md transition"
          >
            <div className="font-semibold text-lg">{item.name}</div>
            <div className="text-sm text-gray-500">{item.category}</div>
            <div className="text-green-600 font-bold mt-1">{item.price} FCFA</div>
            <ul className="mt-2 list-disc list-inside text-sm text-gray-700">
              {item.features.map((feat, index) => (
                <li key={index}>{feat}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdvancedSearch;
