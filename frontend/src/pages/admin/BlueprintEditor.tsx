// @ts-nocheck
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useUser } from "@/hooks/useUser";
import { Navigate } from "react-router-dom";

const BlueprintEditor = () => {
  const { user } = useUser();
  const [type, setType] = useState("immobilier");
  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState({ name: "", type: "text" });

  useEffect(() => {
    if (type) fetchFields();
  }, [type]);

  const fetchFields = async () => {
    try {
      const res = await axios.get(`/api/service-fields/${type}`, {
        headers: { "x-user-role": user?.role || "public" },
      });
      setFields(res.data.fields || []);
    } catch (err) {
      console.warn("Aucun blueprint trouvé.");
    }
  };

  const handleAddField = () => {
    if (newField.name) {
      setFields([...fields, { ...newField }]);
      setNewField({ name: "", type: "text" });
    }
  };

  const handleSave = async () => {
    try {
      await axios.post(
        "/api/admin/blueprints/update",
        { service_type: type, fields },
        { headers: { "x-user-role": user?.role || "public" } }
      );
      alert("✅ Blueprint mis à jour !");
    } catch (err) {
      alert("Erreur lors de l'enregistrement.");
    }
  };

  if (!user || user.role !== "superadmin") {
    return <Navigate to="/unauthorized" />;
  }

  return (
    <AppLayout padding>
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        <h1 className="text-xl font-bold text-primary text-center">
          🎛 Modifier les champs pour : {type}
        </h1>

        <Input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Type de service (ex: immobilier)"
        />

        {fields.map((f, i) => (
          <div key={i} className="flex gap-2">
            <Input value={f.name} disabled />
            <Input value={f.type} disabled />
          </div>
        ))}

        <div className="flex gap-2">
          <Input
            value={newField.name}
            onChange={(e) => setNewField({ ...newField, name: e.target.value })}
            placeholder="Nom du champ"
          />
          <Input
            value={newField.type}
            onChange={(e) => setNewField({ ...newField, type: e.target.value })}
            placeholder="Type (text, number, date...)"
          />
          <Button onClick={handleAddField}>➕</Button>
        </div>

        <Button className="mt-4" onClick={handleSave}>
          💾 Enregistrer le blueprint
        </Button>
      </div>
    </AppLayout>
  );
};

export default BlueprintEditor;
