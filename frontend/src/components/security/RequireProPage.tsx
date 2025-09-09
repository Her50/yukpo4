// @ts-check
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";

const RequireProPage = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || (user.plan !== "pro" && user.plan !== "enterprise")) {
      navigate("/dashboard/upgrade");
    }
  }, [user, navigate]);

  if (!user || (user.plan !== "pro" && user.plan !== "enterprise")) {
    return null; // Masque le contenu pendant la redirection
  }

  return <>{children}</>;
};

export default RequireProPage;
