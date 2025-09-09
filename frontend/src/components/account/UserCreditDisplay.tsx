import React, { useEffect, useState } from 'react';
import axios from 'axios';

const prixTokenUSD = {
  gpt4: { input: 0.01, output: 0.03 },
  gpt35: { input: 0.0005, output: 0.0015 },
};

function getFacteurYukpo(type: string): number {
  return type === "creation_service" ? 100 : 10;
}

const UserCreditDisplay = ({ userId, tokens, type_demande }: {
  userId: string;
  tokens: number;
  type_demande: "creation_service" | "recherche_besoin";
}) => {
  const [localMontant, setLocalMontant] = useState<number | null>(null);
  const [devise, setDevise] = useState("XAF");

  useEffect(() => {
    const modele = "gpt4";
    const sens = "input";
    const usd = (tokens / 1000) * prixTokenUSD[modele][sens];
    const montantYukpo = usd * getFacteurYukpo(type_demande);

    // Exemple fixe pour XAF (ou récupérable via profil prestataire)
    axios.get(`https://api.exchangerate.host/latest?base=USD&symbols=${devise}`)
      .then(res => {
        const taux = res.data.rates[devise];
        setLocalMontant(montantYukpo * taux);
      });
  }, [userId, tokens, type_demande, devise]);

  return (
    <div className="text-sm">
      💡 Coût estimé IA : {localMontant?.toFixed(0)} {devise}
    </div>
  );
};

export default UserCreditDisplay;
