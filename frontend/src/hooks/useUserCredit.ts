import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "./useUser";

const detectDevise = (): string => {
  // Détection basée sur la géolocalisation et préférence utilisateur
  const lang = navigator.language;
  const region = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Zone Franc CFA (Afrique de l'Ouest et Centrale)
  if (region.includes("Africa") || 
      lang.includes("fr") && (region.includes("Dakar") || region.includes("Abidjan") || region.includes("Douala"))) {
    return "XAF"; // Franc CFA
  }
  
  // Afrique du Sud
  if (region.includes("Johannesburg") || region.includes("Cape_Town")) {
    return "ZAR"; // Rand sud-africain
  }
  
  // Nigeria
  if (region.includes("Lagos")) {
    return "NGN"; // Naira nigérian
  }
  
  // Zone Euro
  if (region.includes("Europe") && 
      (region.includes("Paris") || region.includes("Berlin") || region.includes("Madrid"))) {
    return "EUR";
  }
  
  // États-Unis et Canada
  if (region.includes("America") && 
      (region.includes("New_York") || region.includes("Chicago") || region.includes("Toronto"))) {
    return "USD";
  }
  
  // Royaume-Uni
  if (region.includes("London")) {
    return "GBP";
  }
  
  return "XAF"; // Devise par défaut de l'application (zone cible principale)
};

export function useUserCredit(polling: boolean = true) {
  const { user } = useUser();
  const [creditDevise, setCreditDevise] = useState<number | null>(null);
  const [devise, setDevise] = useState<string>(detectDevise());

  const fetchCredit = async () => {
    if (!user?.id) return;
    
    // Utiliser d'abord les informations du JWT si disponibles
    if (user?.credits !== undefined) {
      const credit_xaf = user.credits; // user.credits correspond à tokens_balance en XAF/10ème
      
      if (devise === "XAF") {
        // Convertir les XAF/10ème en XAF réels pour l'affichage
        setCreditDevise(credit_xaf / 10); // Diviser par 10 car les tokens sont en dixièmes de XAF
      } else {
        // Conversion vers autre devise depuis XAF
        try {
          const xaf_reel = credit_xaf / 10; // Convertir d'abord en XAF réels
          const conversion = await axios.get(
            `https://api.exchangerate.host/latest?base=XAF&symbols=${devise}`
          );
          const taux = conversion.data?.rates?.[devise] || 1;
          setCreditDevise(xaf_reel * taux);
        } catch (err) {
          setCreditDevise(credit_xaf / 10); // Fallback en XAF
        }
      }
      return;
    }
    
    // Fallback : récupérer depuis l'API si pas dans le JWT
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/users/balance", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const credit_xaf = res.data.tokens_balance || 0;
      
      if (devise === "XAF") {
        setCreditDevise(credit_xaf / 10); // Diviser par 10 pour affichage en XAF réels
      } else {
        // Conversion vers autre devise
        const xaf_reel = credit_xaf / 10;
        const conversion = await axios.get(
          `https://api.exchangerate.host/latest?base=XAF&symbols=${devise}`
        );
        const taux = conversion.data?.rates?.[devise] || 1;
        setCreditDevise(xaf_reel * taux);
      }
    } catch (err) {
      console.error("Erreur de mise à jour solde", err);
    }
  };

  useEffect(() => {
    fetchCredit();

    if (!polling || !user?.id) return;

    const interval = setInterval(() => {
      fetchCredit();
    }, 15000); // toutes les 15 sec

    return () => clearInterval(interval);
  }, [user, devise, polling]);

  return { creditDevise, devise };
}
