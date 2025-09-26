// @ts-check
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useUser } from '@/hooks/useUser';
import RequireAccess from '@/components/auth/RequireAccess';
import RequireAnyRole from '@/components/auth/RequireAnyRole';
import RequireNotRole from '@/components/auth/RequireNotRole';
import { ROUTES } from '@/routes/AppRoutesRegistry';

const DebugRolesPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate(ROUTES.LOGIN);
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null; // ou un composant de type <Unauthorized /> selon ta stratégie
  }

  return (
    <ResponsiveContainer>
      <h1 className="text-3xl font-bold mb-6">🛡️ Debug des rôles Yukpomnang</h1>

      <div className="mb-4 text-gray-800">
        <p>
          Rôle actuel : <strong>{user.role}</strong>
        </p>
      </div>

      <div className="space-y-4">
        <RequireAccess role="admin">
          <div className="p-4 bg-green-100 border rounded">
            ✅ Visible pour : <strong>admin</strong>
          </div>
        </RequireAccess>

        <RequireAnyRole roles={['admin', 'user']}>
          <div className="p-4 bg-blue-100 border rounded">
            ✅ Visible pour : <strong>admin</strong> ou <strong>user</strong>
          </div>
        </RequireAnyRole>

        <RequireNotRole role="client">
          <div className="p-4 bg-yellow-100 border rounded">
            ✅ Visible pour tous sauf : <strong>client</strong>
          </div>
        </RequireNotRole>

        <RequireNotRole role="admin">
          <div className="p-4 bg-red-100 border rounded">
            ❌ Visible uniquement pour les non-admins
          </div>
        </RequireNotRole>
      </div>
    </ResponsiveContainer>
  );
};

export default DebugRolesPage;
