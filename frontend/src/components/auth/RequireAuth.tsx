// @ts-check
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/hooks/useUser";

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
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        🚫 Accès interdit — votre rôle <code>{user.role}</code> ne permet pas d’accéder à cette page.
      </div>
    );
  }

  // ✅ Autorisé
  return <>{children}</>;
};

export default RequireAuth;
