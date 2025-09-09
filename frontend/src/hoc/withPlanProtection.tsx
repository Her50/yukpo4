import React from "react";
import { useUserPlan } from "@/hooks/useUserPlan";
import ProOnlyBanner from "@/components/ProOnlyBanner";

function withPlanProtection<T extends JSX.IntrinsicAttributes>(
  Component: React.ComponentType<T>
): React.FC<T> {
  return function WrappedComponent(props: T) {
    const { isFree } = useUserPlan();
    return isFree ? <ProOnlyBanner /> : <Component {...props} />;
  };
}

export default withPlanProtection;
