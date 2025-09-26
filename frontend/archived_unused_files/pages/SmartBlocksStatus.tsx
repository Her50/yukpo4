import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Card, CardContent } from "@/components/ui/card";

interface BlockStatus {
  bloc: number;
  status: string;
}

const SmartBlocksStatus: React.FC = () => {
  const [blocks, setBlocks] = useState<BlockStatus[]>([]);

  useEffect(() => {
    fetch("/api/admin/block-status")
      .then((res) => res.json())
      .then((data) => setBlocks(data))
      .catch((err) => {
        console.error("Erreur de chargement des blocs IA :", err);
        setBlocks([]);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📦 Suivi des Blocs IA (33–100)</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {blocks.map((block) => (
          <Card key={block.bloc}>
            <CardContent className="p-4">
              <p className="text-lg font-semibold">Bloc {block.bloc}</p>
              <p className="text-sm text-gray-600">{block.status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SmartBlocksStatus;