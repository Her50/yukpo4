import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '@/components/layout/AppLayout';

interface TagStat {
  tag: string;
  count: number;
}

const AdminTopTagsPanel: React.FC = () => {
  const [tags, setTags] = useState<TagStat[]>([]);

  useEffect(() => {
    axios.get('/api/tags/top')
      .then((res) => setTags(res.data))
      .catch((err) => console.error("Erreur chargement tags:", err));
  }, []);

  return (
    <AppLayout padding>
      <div className="max-w-4xl mx-auto py-10">
        <h1 className="text-2xl font-bold text-center mb-6">🔝 Tags les plus recherchés</h1>
        <table className="min-w-full bg-white border border-gray-200 rounded">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">#</th>
              <th className="py-2 px-4 border-b">Tag</th>
              <th className="py-2 px-4 border-b">Fréquence</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag, index) => (
              <tr key={index}>
                <td className="py-2 px-4 border-b">{index + 1}</td>
                <td className="py-2 px-4 border-b">{tag.tag}</td>
                <td className="py-2 px-4 border-b text-center">{tag.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
};

export default AdminTopTagsPanel;
