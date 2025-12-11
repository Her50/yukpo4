// 📁 src/components/GroupeForm.tsx

import * as React from "react";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../utils/safeStorage';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Étape {groupe.ordre_groupe + 1} — {groupe.groupe_actuel}
        </Text>
        <Text style={styles.subtitle}>Remplissez les informations suivantes</Text>
      </View>

      <View style={styles.fieldsContainer}>
        {champs.map((champ) => (
          <View key={champ.nomChamp} style={styles.fieldContainer}>
            {/* Note: DynamicField doit être un composant React Native */}
            {erreurs[champ.nomChamp] && (
              <Text style={styles.errorText}>{erreurs[champ.nomChamp]}</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "⏳ Vérification..." : groupe.terminé ? "Soumettre" : "Suivant"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 24,
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  fieldsContainer: {
    width: '100%',
  },
  fieldContainer: {
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  button: {
    width: '100%',
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default GroupeForm;





