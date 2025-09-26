// 📦 Yukpo – Création intelligente de service (prestataire unifiée et progressive + affinage intelligent + segmentation + publication externe + contrainte tarrisable dynamique + lien vitrine)
// ✅ UX optimale : 2 étapes, capture directe, refus contenu illicite, segmentation, accompagnement assisté, contrainte intelligente médias, partage externe, vitrine selon plan + image auto IA + nature_service persisté + backend prêt
// @ts-nocheck

import * as React from "react";
import { useState, useEffect } from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/buttons";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, CheckCircle } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useNavigation, useLocation } from "@react-navigation/native";
import axios from "axios";
import toast from "react-hot-toast";
import AffinerBesoinPanel from "@/pages/AffinerBesoinPanel";

const CreationService = () => {
  const { user } = useAuth();
  const navigate = useNavigation();
  const planActuel = user?.plan || "free";
  const username = user?.username || "";

  const { state } = useLocation();
  const suggestion = state?.suggestion || {};
  const type = state?.type || "general";

  const [form, setForm] = useState({
    titre: suggestion.titre || "",
    description: suggestion.description || "",
    prix: suggestion.prix || "",
    categorie: suggestion.categorie || type,
    localisation: suggestion.localisation || "",
    nature_service: "service",
  });
  const [details, setDetails] = useState({});
  const [blueprint, setBlueprint] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);
  const [texte, setTexte] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [requireAffinage, setRequireAffinage] = useState(false);
  const [affinageFields, setAffinageFields] = useState({ localisation: "", frequence: "", budget: "" });
  const [tarrisable, setTarrisable] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);

  useEffect(() => {
    if (texte.length > 10) {
      axios.post("/api/match/blueprint", { texte, plan: planActuel }).then((res) => {
        setMatchResult(res.data);
        if (res.data?.decision === "affiner") {
          setRequireAffinage(true);
          toast("🧪 Yukpo a besoin de quelques précisions…");
        } else {
          setShowForm(true);
          toast.success("✨ Yukpo a détecté un service compatible.");
        }
        if (res.data?.services && res.data.services.length > 1) {
          toast.success("🧠 Plusieurs services détectés. Segmentation activée.");
        }
        if (res.data?.model?.nature_service) {
          setTarrisable(res.data.model.nature_service === "tarissable");
          setForm((prev) => ({ ...prev, nature_service: res.data.model.nature_service }));
        }
      }).catch(() => toast.error("❌ Yukpo n'a pas pu identifier ce service."));
    }
  }, [texte]);

  useEffect(() => {
    if (type) {
      axios.get(`/api/service-fields/${type}`).then((res) => {
        setBlueprint(res.data.fields || []);
        if (res.data.nature_service) {
          setForm((prev) => ({ ...prev, nature_service: res.data.nature_service }));
        }
      }).catch(() => console.warn("Aucun blueprint détecté"));
    }
  }, [type]);

  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleDetailsChange = (e) => setDetails({ ...details, [e.target.name]: e.target.value });

  const generateDefaultImage = async () => {
    const prompt = `Image d'illustration simple pour un produit agricole : ${form.titre || form.categorie}`;
    const res = await axios.post("/api/image/generate", { prompt });
    const blob = await fetch(res.data.url).then((r) => r.blob());
    const file = new File([blob], "auto-image.png", { type: blob.type });
    setGeneratedImage(file);
  };

  const handleValidate = async () => {
    const texteCheck = texte.toLowerCase();
    if (/sexe|porno|violence|criminel/.test(texteCheck)) {
      toast.error("🚫 Contenu interdit détecté. Merci de modifier votre description.");
      return;
    }
    if (form.nature_service === "tarissable" && imageFiles.length === 0 && !generatedImage) {
      await generateDefaultImage();
      toast("📷 Une image générée automatiquement a été ajoutée pour un produit tarrissable.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post("/api/prestataire/valider-service", {
        ...form,
        details,
      });
      const service_id = res.data.id;

      const formData = new FormData();
      (imageFiles.length > 0 ? imageFiles : [generatedImage]).forEach((file) => file && formData.append("media", file));
      if (audioFile) formData.append("audio", audioFile);
      if (videoFile) formData.append("video", videoFile);

      await axios.post(`/api/prestataire/upload/${service_id}`, formData);
      
      // Déclencher l'événement service_created pour notifier MesServices
      window.dispatchEvent(new CustomEvent('service_created'));
      
      toast.success("🎉 Votre service est en ligne sur Yukpo !");
      navigation.navigate("/prestataire/services", { state: { justCreatedId: service_id } });
    } catch (err) {
      toast.error("❌ Une erreur est survenue lors de la publication.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout padding>
      <View style="w-full max-w-4xl mx-auto">
        {!showForm && !requireAffinage && (
          <>
            <Textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Décrivez brièvement votre service…"
              style="mb-4"
            />
            <TextInput type="file" accept="image/*" capture="environment" multiple onChange={(e) => setImageFiles(Array.from(e.target.files || []))} />
          </>
        )}

        {requireAffinage && <AffinerBesoinPanel data={affinageFields} onDone={() => { setRequireAffinage(false); setShowForm(true); }} />}

        {showForm && (
          <>
            <View style="bg-white rounded-md border p-4 space-y-4 shadow-sm mt-6">
              <Text style="text-lg font-semibold text-primary">🧾 Informations générales</Text>
              <TextInput name="titre" value={form.titre} onChange={handleFormChange} placeholder="Titre du service" />
              <Textarea name="description" value={form.description} onChange={handleFormChange} placeholder="Description du service" />
              <TextInput name="prix" value={form.prix} onChange={handleFormChange} placeholder="Prix (FCFA)" type="number" />
              <TextInput name="categorie" value={form.categorie} onChange={handleFormChange} placeholder="Catégorie" />
              <TextInput name="localisation" value={form.localisation} onChange={handleFormChange} placeholder="Ville / Quartier" />
            </View>

            {blueprint.length > 0 && (
              <View style="bg-white rounded-md border p-4 space-y-4 shadow-sm">
                <Text style="text-lg font-semibold text-primary">🧩 Spécificités de votre service</Text>
                {blueprint.map((field, i) => (
                  <View key={i} style="flex items-center gap-2">
                    <TextInput
                      name={field.name}
                      type={field.type}
                      placeholder={field.name}
                      onChange={handleDetailsChange}
                    />
                    {details[field.name] && <CheckCircle style="text-green-500 w-5 h-5" />}
                  </View>
                ))}
              </View>
            )}

            <View style="text-center mt-6">
              <TouchableOpacity onPress={handleValidate} disabled={loading} style="w-full">
                {loading ? "⏳ Publication en cours..." : "📤 Publier mon service Yukpo"}
              </TouchableOpacity>
              <Text style="text-xs text-gray-500 mt-2">🔗 Une fois publié, vous pourrez le partager ou générer votre vitrine pro Yukpo selon votre plan.</Text>
            </View>
          </>
        )}
      </View>
    </AppLayout>
  );
};

export default CreationService;





