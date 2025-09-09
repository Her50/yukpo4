import React, { useState } from "react";
import { Button } from "@/components/ui/buttons";
import { useNavigate } from "react-router-dom";
import { useUser } from '@/hooks/useUser';
import { toast } from 'react-hot-toast';

const FallbackIA: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);

  // Simule une relance IA avancée (à remplacer par une vraie action si dispo)
  const handleAdvancedSearch = async () => {
    setLoading(true);
    try {
      // Ici, tu pourrais appeler une API ou déclencher une action IA
      await new Promise((resolve) => setTimeout(resolve, 1200));
      toast.success("Recherche IA avancée lancée ! Vous serez notifié en cas de résultat.");
    } catch (e) {
      toast.error("Erreur lors de la relance IA avancée.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center bg-blue-50 border border-blue-200 p-6 rounded-md mt-8 max-w-xl mx-auto shadow">
      <h2 className="text-lg font-semibold text-blue-900 mb-2">Recherche IA avancée</h2>
      <p className="text-blue-800 mb-2">
        💡 Notre IA peut tenter de trouver ce service ou ce bien en dehors de la plateforme (marketplaces, forums, réseaux sociaux…).
      </p>
      {user && (
        <div className="mb-2 text-sm text-blue-700">
          <span className="font-medium">Votre solde de tokens&nbsp;:</span> {user.credits ?? 0} {user.currency || 'XAF'}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
        <Button
          variant="default"
          size="sm"
          loading={loading}
          onClick={handleAdvancedSearch}
          aria-label="Relancer une recherche IA avancée"
        >
          ⚡ Relancer la recherche IA avancée
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/contact")}
          aria-label="Contacter l'équipe Yukpo"
        >
          📞 Contacter l'équipe Yukpo
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/")}
          aria-label="Retour à l'accueil"
        >
          🏠 Retour à l'accueil
        </Button>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        Si vous souhaitez affiner votre recherche, vous pouvez aussi modifier vos critères ou contacter notre support.
      </div>
    </div>
  );
};

export default FallbackIA;
