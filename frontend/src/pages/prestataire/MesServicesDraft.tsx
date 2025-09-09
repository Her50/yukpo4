// @ts-nocheck
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import UploaderByService from "@/components/media/UploaderByService";

const MesServicesDraft = () => {
  const [drafts, setDrafts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDrafts = async () => {
      const res = await axios.get("/api/prestataire/drafts");
      setDrafts(res.data);
    };
    fetchDrafts();
  }, []);

  const handleEdit = (suggestion: any) => {
    navigate(`/formulaire-pre-rempli/${suggestion.categorie}`, {
      state: { suggestion },
    });
  };

  return (
    <AppLayout padding>
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <h1 className="text-2xl font-bold text-primary text-center">
          Brouillons de services
        </h1>

        {drafts.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            Aucun service en attente de validation pour le moment.
          </p>
        ) : (
          drafts.map((s, i) => (
            <div key={i} className="border p-4 rounded shadow-sm space-y-3">
              <h2 className="font-semibold">{s.titre || "Service sans titre"}</h2>
              <p className="text-sm text-gray-600">{s.description}</p>

              <div className="flex flex-wrap gap-4">
                <Button onClick={() => handleEdit(s)}>✏️ Modifier / Valider</Button>
              </div>

              {s.id && <UploaderByService serviceId={s.id} />}
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
};

export default MesServicesDraft;
