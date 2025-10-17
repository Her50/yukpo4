// 📦 Yukpo – Affinage intelligent des besoins utilisateur (responsive)
// @ts-nocheck

import * as React from "react";
import { useEffect, useState } from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/buttons";
import { useNavigation, useLocation } from "@react-navigation/native";
import axios from "axios";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const AffinerBesoinPanel = () => {
  const navigate = useNavigation();
  const { state } = useLocation();
  const { texte = "" } = state || {};

  const [texteAffiné, setTexteAffiné] = useState(texte);
  const [loading, setLoading] = useState(false);
  const [blueprintFields, setBlueprintFields] = useState([]);
  const [dynamicValues, setDynamicValues] = useState({});
  const [localisation, setLocalisation] = useState("");
  const [budget, setBudget] = useState("");
  const [frequence, setFrequence] = useState("");
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    if (texte) {
      axios.post("/api/match/blueprint", { texte }).then((res) => {
        setBlueprintFields(res.data?.champs_specifiques || []);
      }).catch(() => {
        console.warn("🔍 Aucun modèle Yukpo détecté.");
      });
    }
  }, [texte]);

  const handleRelancerAnalyse = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("texte", texteAffiné);
    formData.append("localisation", localisation);
    formData.append("budget", budget);
    formData.append("frequence", frequence);
    Object.entries(dynamicValues).forEach(([k, v]) => {
      formData.append(k, v);
    });

    try {
      const res = await axios.post("/api/analyse-visuelle", formData);
      navigation.navigate("/resultats-besoin", {
        state: {
          resultats: res.data?.correspondances || [],
          type: "affinage",
        },
      });
    } catch (err) {
      alert("❌ Erreur lors de l’analyse Yukpo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDynamicChange = (field, value) => {
    setDynamicValues((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout padding>
      <View style="relative max-w-3xl mx-auto py-10 space-y-6 px-4 sm:px-6 lg:px-8 bg-white rounded shadow">
        {/* ☰ Sheet menu mobile */}
        <Sheet open={openMenu} onOpenChange={setOpenMenu}>
          <SheetTrigger asChild>
            <TouchableOpacity
              style="absolute top-4 right-4 text-gray-600 hover:text-primary focus:outline-none"
              onPress={() => setOpenMenu(true)}
            >
              <Menu style="w-6 h-6" />
            </TouchableOpacity>
          </SheetTrigger>
          <SheetContent side="right" style="w-64 p-4 bg-white border-l border-gray-200">
            <Text style="text-lg font-semibold mb-4 text-primary">⚙️ Options</Text>
            <ul style="space-y-2 text-sm">
              <li><TouchableOpacity variant="ghost" style="w-full">📋 Mes besoins</TouchableOpacity></li>
              <li><TouchableOpacity variant="ghost" style="w-full">🧪 Tester un autre besoin</TouchableOpacity></li>
            </ul>
          </SheetContent>
        </Sheet>

        <Text style="text-2xl font-bold text-center text-primary">
          🛠️ Yukpo affine votre besoin
        </Text>
        <Text style="text-sm text-gray-600 text-center">
          Quelques précisions supplémentaires aideront Yukpo à mieux répondre à votre demande.
        </Text>

        <Textarea
          value={texteAffiné}
          onChange={(e) => setTexteAffiné(e.target.value)}
          placeholder="Affinez votre description ici..."
        />

        <TextInput
          placeholder="📍 Ville / Quartier"
          value={localisation}
          onChange={(e) => setLocalisation(e.target.value)}
        />

        <TextInput
          placeholder="💰 Budget maximum (FCFA)"
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />

        <select
          style="border rounded px-3 py-2 w-full"
          value={frequence}
          onChange={(e) => setFrequence(e.target.value)}
        >
          <option value="">📆 Fréquence souhaitée</option>
          <option value="ponctuel">Ponctuel</option>
          <option value="hebdomadaire">Hebdomadaire</option>
          <option value="mensuel">Mensuel</option>
        </select>

        {blueprintFields.length > 0 && (
          <View style="space-y-3">
            <Text style="text-lg font-semibold mt-6">🔎 Détails spécifiques Yukpo</Text>
            {blueprintFields.map((field, i) => (
              <TextInput
                key={i}
                placeholder={field}
                value={dynamicValues[field] || ""}
                onChange={(e) => handleDynamicChange(field, e.target.value)}
              />
            ))}
          </View>
        )}

        <View style="text-center mt-6">
          <TouchableOpacity onPress={handleRelancerAnalyse} disabled={loading}>
            {loading ? "Chargement..." : "📤 Relancer l’analyse Yukpo"}
          </TouchableOpacity>
        </View>
      </View>
    </AppLayout>
  );
};

export default AffinerBesoinPanel;





