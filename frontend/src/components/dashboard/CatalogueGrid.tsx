// @generated
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ Import nécessaire ajouté

interface Item {
  title: string;
  price: number;
  options: string[];
}

interface Props {
  category: string;
  items: Item[];
}

const CatalogueGrid: React.FC<Props> = ({ category, items }) => (
  <div>
    <h2 className="text-xl font-bold mb-4">{category}</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, i) => (
        <div key={i} className="border p-4 shadow rounded">
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-green-700 font-bold">
            {item.price.toLocaleString()} FCFA
          </p>
          <ul className="text-sm mt-2 list-disc pl-4">
            {item.options.map((opt, j) => (
              <li key={j}>{opt}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    {/* 🚀 CONTEXTUAL BUTTONS intégrés correctement */}
    <div className="mt-6 flex flex-wrap gap-4 justify-center border-t pt-6">
      <a
        href={ROUTES.SERVICES}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
      >
        Découvrir d'autres services
      </a>
      <a
        href={ROUTES.PLANS}
        className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
      >
        Voir les formules
      </a>
      <a
        href={ROUTES.CONTACT}
        className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
      >
        Contacter l'équipe Yukpomnang
      </a>
    </div>
  </div>
);

export default CatalogueGrid;
