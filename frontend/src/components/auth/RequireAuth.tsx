// @ts-check
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { isAdminRole, isAdminUser } from "@/utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useUser();
  const location = useLocation();

  // ⏳ Attente du chargement de l'utilisateur
  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Chargement...</div>;
  }

  // 🔐 Non connecté
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ⛔ Non autorisé par rôle
  if (allowedRoles) {
    // ✅ CORRECTION 2026-02-06: Si 'admin' est dans allowedRoles, vérifier aussi super_admin
    const hasAccess = allowedRoles.some(role => {
      if (role === 'admin') {
        // Si on cherche 'admin', accepter aussi 'super_admin'
        return isAdminRole(user.role);
      }
      // Pour les autres rôles, vérification normale
      return user.role === role;
    });

    if (!hasAccess) {
      return (
        <div className="p-8 text-center text-red-600 font-semibold">
          🚫 Accès interdit — votre rôle <code>{user.role}</code> ne permet pas d'accéder à cette page.
        </div>
      );
    }
  }

  // ✅ Autorisé
  return <>{children}</>;
};

export default RequireAuth;
