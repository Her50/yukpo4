// @ts-check
import React, { useEffect, useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons";

type Infraction = {
  date: string;
  message: string;
  user?: string;
};

const InfractionArchivePage: React.FC = () => {
  const [archives, setArchives] = useState<Infraction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch("/data/infractions_archive.json");
      const data = await res.json();
      setArchives(data);
    } catch (err) {
      console.error("Erreur chargement archive :", err);
    }
    setLoading(false);
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(archives, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infractions_archive.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  return (
    <ResponsiveContainer className="py-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📦 Infractions Archivées</h1>
        <div className="flex gap-2">
          <Button onClick={fetchArchive}>🔄 Recharger</Button>
          <Button variant="secondary" onClick={downloadJSON}>
            📥 Télécharger
          </Button>
        </div>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="grid gap-4">
          {archives.length > 0 ? (
            archives.map((item, idx) => (
              <Card key={idx}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted">📅 {item.date}</p>
                  <p className="font-semibold">{item.message}</p>
                  <p className="text-xs">Utilisateur : {item.user || "N/A"}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted text-center">Aucune infraction archivée.</p>
          )}
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default InfractionArchivePage;
