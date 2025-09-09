import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { useUserPlan } from "@/hooks/useUserPlan";

type Role = "admin" | "client" | "user";
type Plan = "free" | "pro" | "enterprise";

interface Props {
  children: ReactNode;
  allowedRoles?: Role[];
  allowedPlans?: Plan[];
}

// Ce composant n'est plus utilisé. Toute la logique d'accès par plan est supprimée.
export default function ProtectedRouteByPlanAndRole({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
