import Button from "@/components/ui/button";
import { toast } from "react-toastify";

const FixFrontendButton = () => {
  const handleFix = async () => {
    try {
      const res = await fetch("/admin/fix-frontend-exports");
      if (res.ok) {
        toast.success("✅ Correction exécutée avec succès !");
      } else {
        toast.error("❌ Échec de l'exécution du correcteur.");
      }
    } catch (err) {
      toast.error("⚠️ Erreur réseau.");
    }
  };

  return (
    <Button onClick={handleFix}>
      🛠️ Corriger exports/imports React
    </Button>
  );
};

export default FixFrontendButton;
