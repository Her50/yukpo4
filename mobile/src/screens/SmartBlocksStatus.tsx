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
    <View style="p-6">
      <h1 style="text-2xl font-bold mb-4">📦 Suivi des Blocs IA (33–100)</h1>
      <View style="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {blocks.map((block) => (
          <Card key={block.bloc}>
            <CardContent style="p-4">
              <p style="text-lg font-semibold">Bloc {block.bloc}</Text>
              <p style="text-sm text-gray-600">{block.status}</Text>
            </CardContent>
          </Card>
        ))}
      </View>
    </View>
  );
};

export default SmartBlocksStatus;
