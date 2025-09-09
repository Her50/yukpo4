// @ts-check
import React, {
    createContext,
    useContext,
    type ReactNode,
    type FC,
  } from "react";
  
  type Plan = "free" | "pro" | "enterprise";
  
  interface PlanContextValue {
    plan: Plan;
    isPro: boolean;
    isEnterprise: boolean;
    isFree: boolean;
  }
  
  const defaultValue: PlanContextValue = {
    plan: "free",
    isPro: false,
    isEnterprise: false,
    isFree: true,
  };
  
  const PlanContext = createContext<PlanContextValue>(defaultValue);
  PlanContext.displayName = "YukpomnangPlanContext";
  
  /**
   * ✅ Hook principal pour récupérer le plan utilisateur
   */
  export const useUserPlan = () => useContext(PlanContext);
  
  /**
   * ✅ Fournisseur simulable pour les tests ou plans forcés
   * @param simulatedPlan Exemple: "pro" | "enterprise"
   */
  export const PlanProvider: FC<{
    children: ReactNode;
    simulatedPlan?: Plan;
  }> = ({ children, simulatedPlan = "free" }) => {
    const value: PlanContextValue = {
      plan: simulatedPlan,
      isPro: simulatedPlan === "pro",
      isEnterprise: simulatedPlan === "enterprise",
      isFree: simulatedPlan === "free",
    };
  
    return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
  };
  