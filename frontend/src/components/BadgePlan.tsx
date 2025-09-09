// @ts-check
import React from "react";
import { useUserPlan } from "@/hooks/useUserPlan";

const BadgePlan = () => {
  const { plan } = useUserPlan();

  const colors = {
    free: "bg-gray-300 text-gray-800",
    pro: "bg-blue-500 text-white",
    enterprise: "bg-green-600 text-white",
  };

  const label = {
    free: "Free",
    pro: "Pro",
    enterprise: "Entreprise",
  };

  return (
    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${colors[plan]}`}>
      Plan : {label[plan]}
    </span>
  );
};

export default BadgePlan;
