// ✅ frontend/src/pages/admin/BlueprintManager.tsx
import * as React from "react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/layout/AppLayout";

interface Blueprint {
  _id: string;
  id: string;
  categorie: string;
  champs_specifiques: string[];
  keywords: string[];
  tags_ia: string[];
  valide: boolean;
}

export default function BlueprintManager() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [refresh, setRefresh] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [newBlueprint, setNewBlueprint] = useState<Partial<Blueprint>>({
    id: "",
    categorie: "",
    champs_specifiques: [],
    keywords: [],
    tags_ia: [],
    valide: false,
  });

  useEffect(() => {
    fetch("/api/admin/blueprints")
      .then(res => res.json())
      .then(setBlueprints);
  }, [refresh]);

  const filtered = blueprints.filter(bp =>
    (filter === "all" || bp.categorie === filter) &&
    (bp.id.toLowerCase().includes(search.toLowerCase()) ||
     bp.keywords.join(",").toLowerCase().includes(search.toLowerCase()))
  );

  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const categories = Array.from(new Set(blueprints.map(bp => bp.categorie)));

  const updateBlueprint = async (bp: Blueprint) => {
    await fetch(`/api/admin/blueprints/${bp._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bp),
    });
    setRefresh(!refresh);
  };

  const deleteBlueprint = async (id: string) => {
    await fetch(`/api/admin/blueprints/${id}`, { method: "DELETE" });
    setRefresh(!refresh);
  };

  const createBlueprint = async () => {
    await fetch(`/api/admin/blueprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newBlueprint),
    });
    setNewBlueprint({ id: "", categorie: "", champs_specifiques: [], keywords: [], tags_ia: [], valide: false });
    setRefresh(!refresh);
  };

  return (
    <AppLayout padding>
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">🧠 Gestion des modèles Yukpo dynamiques</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <Input placeholder="🔍 Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="border rounded px-2" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Toutes les catégories</option>
            {categories.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4">
          {paginated.map((bp) => (
            <Card key={bp._id}>
              <CardContent className="space-y-2">
                <div className="font-bold">{bp.id}</div>
                <div className="text-sm text-muted">{bp.categorie}</div>
                <div className="text-xs text-gray-600">Champs : {bp.champs_specifiques.join(", ")}</div>
                <div className="text-xs text-gray-600">Keywords : {bp.keywords.join(", ")}</div>
                <div className="text-xs text-gray-600">Tags Yukpo : {bp.tags_ia?.join(", ")}</div>
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bp.valide}
                    onChange={(e) => updateBlueprint({ ...bp, valide: e.target.checked })}
                  />
                  Valider ce modèle
                </label>
                <div className="flex gap-2 mt-2">
                  <Button variant="destructive" onClick={() => deleteBlueprint(bp._id)}>🗑 Supprimer</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center mt-4">
          <Button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>⬅️ Précédent</Button>
          <span className="text-sm">Page {currentPage}</span>
          <Button disabled={currentPage * pageSize >= filtered.length} onClick={() => setCurrentPage(p => p + 1)}>Suivant ➡️</Button>
        </div>

        <hr className="my-6" />

        <div className="space-y-2">
          <h3 className="font-semibold">➕ Ajouter un nouveau blueprint</h3>
          <Input placeholder="ID modèle" value={newBlueprint.id} onChange={e => setNewBlueprint({ ...newBlueprint, id: e.target.value })} />
          <Input placeholder="Catégorie" value={newBlueprint.categorie} onChange={e => setNewBlueprint({ ...newBlueprint, categorie: e.target.value })} />
          <Input placeholder="Champs (séparés par virgule)" onChange={e => setNewBlueprint({ ...newBlueprint, champs_specifiques: e.target.value.split(",") })} />
          <Input placeholder="Keywords (séparés par virgule)" onChange={e => setNewBlueprint({ ...newBlueprint, keywords: e.target.value.split(",") })} />
          <Button onClick={createBlueprint}>➕ Ajouter</Button>
        </div>
      </div>
    </AppLayout>
  );
}
