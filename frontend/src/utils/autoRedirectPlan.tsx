import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserPlan } from "@/hooks/useUserPlan";

type Plan = "free" | "pro" | "enterprise";
type RedirectRules = Partial<Record<Plan, string>>;

export const useAutoRedirectByPlan = (rules: RedirectRules): void => {
  const { plan } = useUserPlan();
  const navigate = useNavigate();

  useEffect(() => {
    if (plan && rules[plan]) {
      navigate(rules[plan]!);
    }
  }, [plan, navigate, rules]);
};
