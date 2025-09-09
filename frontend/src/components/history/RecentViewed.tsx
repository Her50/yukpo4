import React, { useEffect, useState } from 'react';

type Item = {
  id: number;
  service_id: number;
  timestamp: string;
};

export function RecentViewed({ userId }: { userId: number }) {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`/api/historique/${userId}`)
      .then((res) => res.json())
      .then(setItems);
  }, [userId]);

  if (!items.length) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-bold mb-2">Vous avez consulté récemment</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="bg-white p-3 shadow rounded"
          >
            Service ID : {item.service_id} — à {new Date(item.timestamp).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RecentViewed;
