import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

﻿// @generated
import CompareTable from '@/components/compare/CompareTable';
import catalogue from '@/data/catalogues.json';

function ComparePage() {
  const [selected, setSelected] = useState<number[]>([]);
  const [region, setRegion] = useState<string>('Douala');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const filtered = catalogue.filter((c: any) => selected.includes(c.id));
    setItems(filtered.map((item: any) => ({ ...item, region })));
  }, [selected, region]);

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <View style="p-6">
      <h1 style="text-xl font-bold mb-4">Comparateur Yukpomnang</h1>

      <View style="mb-4">
        <label style="mr-2 font-semibold">Région :</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          style=""
        >
          <option>Douala</option>
          <option>Yaoundé</option>
          <option>Libreville</option>
        </select>
      </View>

      <View style="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {catalogue.map((item: any) => (
          <TouchableOpacity
            key={item.id}
            onClick={() => toggleSelect(item.id)}
            style={`p-2 border rounded ${
              selected.includes(item.id) ? 'bg-green-200' : ''
            }`}
          >
            {item.name}
          </TouchableOpacity>
        ))}
      </View>

      {items.length > 0 && <CompareTable items={items} region={region} />}
    </View>
  );
}

export default ComparePage;
