// 📁 src/components/GroupeForm.tsx

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DynamicField from "@/components/intelligence/DynamicFields";
import { Button } from "@/components/ui/buttons";
import { ComposantFrontend, dispatchChampsFormulaireIA } from "@/utils/form_constraint_dispatcher";
import { toast } from "react-toastify";

interface GroupeFormProps {
  groupe: {
    groupe_actuel: string;
    contenu: Record<string, ComposantFrontend>;
    ordre_groupe: number;
    terminé: boolean;
  };
  onNext: () => void;
}

const GroupeForm: React.FC<GroupeFormProps> = ({ groupe, onNext }) => {
  const [valeurs, setValeurs] = useState<Record<string, any>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [champs, setChamps] = useState<ComposantFrontend[]>([]);

  useEffect(() => {
    const tampon = localStorage.getItem("tampon_groupe_local");
    if (tampon) {
      const parsed = JSON.parse(tampon);
      const existants = parsed[groupe.groupe_actuel] || {};
      setValeurs(existants);
    }

    // ✅ Ajout de contexte_demande fictif pour satisfaire le type ProfilIA
    const contenuAvecContexte = {
      contexte_demande: {
        valeur: null,
        type_donnee: "texte",
      },
      ...groupe.contenu,
    };

    const dynamic = dispatchChampsFormulaireIA({
      services_detectes: [
        {
          modele_service: "groupe_dyn",
          profil_ia: contenuAvecContexte,
          origine_champs: {},
          medias_utilises: {
            images: [],
            documents: [],
            audio: false,
            texte: true,
          },
        },
      ],
    });

    setChamps(dynamic);
  }, [groupe.groupe_actuel]);

  const handleChange = (champNom: string, valeur: any) => {
    setValeurs((prev) => ({ ...prev, [champNom]: valeur }));
    setErreurs((prev) => ({ ...prev, [champNom]: "" }));

    const tamponStr = localStorage.getItem("tampon_groupe_local");
    const tampon = tamponStr ? JSON.parse(tamponStr) : {};
    tampon[groupe.groupe_actuel] = { ...tampon[groupe.groupe_actuel], [champNom]: valeur };
    localStorage.setItem("tampon_groupe_local", JSON.stringify(tampon));
  };

  const validerChamp = (champ: ComposantFrontend, valeur: any): string | null => {
    if (champ.obligatoire && (valeur === undefined || valeur === "" || valeur === null)) {
      return "Ce champ est requis.";
    }
    if (champ.min && typeof valeur === "string" && valeur.length < champ.min) {
      return `Min ${champ.min} caractères`;
    }
    if (champ.max && typeof valeur === "string" && valeur.length > champ.max) {
      return `Max ${champ.max} caractères`;
    }
    if (champ.typeDonnee === "email" && valeur && !/^\S+@\S+\.\S+$/.test(valeur)) {
      return "Email invalide.";
    }
    return null;
  };

  const handleSubmit = () => {
    let valid = true;
    const nouvellesErreurs: Record<string, string> = {};

    for (const champ of champs) {
      const val = valeurs[champ.nomChamp];
      const erreur = validerChamp(champ, val);
      if (erreur) {
        valid = false;
        nouvellesErreurs[champ.nomChamp] = erreur;
      }
    }

    if (!valid) {
      setErreurs(nouvellesErreurs);
      toast.error("🚫 Veuillez corriger les champs.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onNext();
    }, 600);
  };

  return (
    <motion.div
      className="flex flex-col gap-6 w-full max-w-3xl mx-auto p-4 sm:p-6 backdrop-blur rounded-2xl shadow-xl bg-white/80"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-semibold mb-1">
          Étape {groupe.ordre_groupe + 1} — {groupe.groupe_actuel}
        </h2>
        <p className="text-sm text-gray-500">Remplissez les informations suivantes</p>
      </div>

      <AnimatePresence>
        {champs.map((champ) => (
          <motion.div
            key={champ.nomChamp}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <DynamicField
              champ={champ}
              valeurExistante={valeurs[champ.nomChamp]}
              onChange={(val) => handleChange(champ.nomChamp, val)}
            />
            {erreurs[champ.nomChamp] && (
              <p className="text-sm text-red-500 mt-1">{erreurs[champ.nomChamp]}</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={handleSubmit}
          className="w-full sm:w-auto px-8 py-2"
          disabled={loading}
        >
          {loading ? "⏳ Vérification..." : groupe.terminé ? "Soumettre" : "Suivant"}
        </Button>
      </div>
    </motion.div>
  );
};

export default GroupeForm;
