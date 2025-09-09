// src/pages/PlansPage.tsx
import React from "react";
import AppLayout from "@/components/layout/AppLayout";

// Cette page a été désactivée. Les plans d'abonnement ne sont plus proposés.
export default function PlansPage() {
  return (
    <AppLayout>
      <div style={{ padding: 40, textAlign: "center" }}>
        La gestion des plans d'abonnement a été supprimée. Utilisez votre solde de
        crédits/tokens.
      </div>
    </AppLayout>
  );
}
