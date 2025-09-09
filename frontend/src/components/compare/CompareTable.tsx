// @generated
import React from 'react';
import weights from '@/data/regional_weights.json';

interface Item {
  id: number;
  name: string;
  category: string;
  price: number;
  features: string[];
  region?: string;
}

interface Props {
  items: Item[];
  region: string;
}

const CompareTable: React.FC<Props> = ({ items, region }) => {
  const allFeatures = Array.from(new Set(items.flatMap((i) => i.features)));
  const regionWeights = (weights as any)[region] || {};

  return (
    <table className="w-full border mt-6 text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 text-left">Service</th>
          <th className="p-2 text-left">Prix (FCFA)</th>
          {allFeatures.map((f) => (
            <th key={f} className="p-2 text-left">
              {f} ({regionWeights[f] || 1})
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((service) => (
          <tr key={service.id} className="border-t">
            <td className="p-2">{service.name}</td>
            <td className="p-2 text-green-600 font-semibold">{service.price.toLocaleString()}</td>
            {allFeatures.map((f) => (
              <td key={f} className="p-2 text-center">
                {service.features.includes(f) ? '✅' : '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CompareTable;
