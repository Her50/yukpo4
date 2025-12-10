// 📁 src/components/GroupeForm.tsx

import * as React from "react";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from 'react-native';
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
// import { motion, AnimatePresence } from 'framer-motion'; // Animation React Native
// import DynamicField from "@/components/intelligence/DynamicFields";
// import { Button } from "@/components/ui/buttons";
// import { ComposantFrontend, dispatchChampsFormulaireIA } from "@/utils/form_constraint_dispatcher";
// import { toast } from "react-toastify";

interface ComposantFrontend {
  type: string;
  label: string;
  required: boolean;
}

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
    const loadTampon = async () => {
      try {
        const tampon = await SafeStorage.getItem("tampon_groupe_local");
        if (tampon) {
          const parsed = JSON.parse(tampon);
          const existants = parsed[groupe.groupe_actuel] || {};
          setValeurs(existants);
        }
      } catch (error) {
        console.error('Erreur chargement tampon:', error);
      }
    };
    
    loadTampon();

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

  const handleChange = async (champNom: string, valeur: any) => {
    setValeurs((prev) => ({ ...prev, [champNom]: valeur }));
    setErreurs((prev) => ({ ...prev, [champNom]: "" }));

    try {
      const tamponStr = await SafeStorage.getItem("tampon_groupe_local");
      const tampon = tamponStr ? JSON.parse(tamponStr) : {};
      tampon[groupe.groupe_actuel] = { ...tampon[groupe.groupe_actuel], [champNom]: valeur };
      await SafeStorage.setItem("tampon_groupe_local", JSON.stringify(tampon));
    } catch (error) {
      console.error('Erreur sauvegarde tampon:', error);
    }
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
      style="flex flex-col gap-6 w-full max-w-3xl mx-auto p-4 sm:p-6 backdrop-blur rounded-2xl shadow-xl bg-white/80"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <View style="text-center">
        <Text style="text-xl sm:text-2xl font-semibold mb-1">
          Étape {groupe.ordre_groupe + 1} — {groupe.groupe_actuel}
        </Text>
        <Text style="text-sm text-gray-500">Remplissez les informations suivantes</Text>
      </View>

      <AnimatePresence>
        {champs.map((champ) => (
          <motion.div
            key={champ.nomChamp}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style="w-full"
          >
            <DynamicField
              champ={champ}
              valeurExistante={valeurs[champ.nomChamp]}
              onChange={(val) => handleChange(champ.nomChamp, val)}
            />
            {erreurs[champ.nomChamp] && (
              <Text style="text-sm text-red-500 mt-1">{erreurs[champ.nomChamp]}</Text>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      <View style="mt-6 flex justify-end">
        <TouchableOpacity
          onPress={handleSubmit}
          style="w-full sm:w-auto px-8 py-2"
          disabled={loading}
        >
          {loading ? "⏳ Vérification..." : groupe.terminé ? "Soumettre" : "Suivant"}
        </TouchableOpacity>
      </View>
    </motion.div>
  );
};

export default GroupeForm;





