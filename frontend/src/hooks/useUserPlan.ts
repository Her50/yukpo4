// src/hooks/useUserPlan.ts
// @ts-check
import { useUser } from "./useUser";

// Ce hook n'est plus utilisé. Toute la logique de plan d'abonnement a été supprimée.
export const useUserPlan = () => ({ plan: undefined, isFree: false, isPro: false, isEnterprise: false });
