import React, { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/buttons";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

interface RaffinementModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RaffinementModal: React.FC<RaffinementModalProps> = ({ open, onClose, onSuccess }) => {
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("texte", texte);
    if (fichier) formData.append("fichier", fichier);

    const res = await fetch("/api/ia/enrichir-contexte", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      onSuccess?.();
      onClose();
    } else {
      alert("❌ Erreur lors de l'enrichissement");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <motion.div
          className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Dialog.Title className="text-xl font-semibold mb-4">🔍 Raffiner votre besoin</Dialog.Title>

          <div className="space-y-4">
            <Textarea
              placeholder="Ajouter un détail ou une précision contextuelle"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
            />
            <Input type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)} />
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="ghost" onClick={onClose}>Annuler</Button>
            <Button loading={loading} onClick={handleSubmit}>Valider</Button>
          </div>
        </motion.div>
      </div>
    </Dialog>
  );
};

export default RaffinementModal;
