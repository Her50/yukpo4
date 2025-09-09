import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons';

interface ExpiringUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  plan_expiry: string | null;
}

const AdminExpirationsPanel: React.FC = () => {
  const [users, setUsers] = useState<ExpiringUser[]>([]);

  useEffect(() => {
    axios.get('/api/admin/users/expiring').then(res => setUsers(res.data));
  }, []);

  const handleExport = () => {
    window.print();
  };

  return (
    <AppLayout padding>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">⏳ Utilisateurs à expiration imminente</h1>

        <Button className="mb-4" onClick={handleExport}>
          📄 Exporter en PDF
        </Button>

        {users.length === 0 ? (
          <p>Aucun utilisateur avec expiration dans les 5 prochains jours.</p>
        ) : (
          <div className="printable">
            <table className="w-full border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Nom</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Plan</th>
                  <th className="p-2 text-left">Expire le</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="p-2">{u.name || "—"}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.plan}</td>
                    <td className="p-2">{u.plan_expiry?.slice(0, 10) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminExpirationsPanel;
