// @ts-check
import React, { ReactNode } from "react";
import UserContext from "@/context/UserContext";

type PlanType = "free" | "pro" | "enterprise";
type UserRole = "admin" | "user" | "public";

interface Props {
  plan: PlanType;
  children: ReactNode;
}

const TestUserProvider = ({ plan, children }: Props) => {
  const user = {
    id: "1",
    email: "test@yukpomnang.com",
    roles: ["user"] as UserRole[],
    plan,
    exp: Date.now() / 1000 + 3600,
  };

  return (
    <UserContext.Provider value={{ user, setUser: () => {} }}>
      {children}
    </UserContext.Provider>
  );
};

export default TestUserProvider;
