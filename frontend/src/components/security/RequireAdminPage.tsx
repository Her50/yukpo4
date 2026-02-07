// src/components/security/RequireAdminPage.tsx
// @ts-check
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ chemin correct au besoin
import { isAdminUser } from '@/utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

function RequireAdminPage({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user || !isAdminUser(user)) {
      navigate(ROUTES.LOGIN);
    } else {
      setChecking(false);
    }
  }, [user, navigate]);

  if (checking) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500 text-sm">
        🔐 Vérification des autorisations administrateur...
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireAdminPage;
