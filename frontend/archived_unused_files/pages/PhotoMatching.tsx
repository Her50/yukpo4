import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const PhotoMatching: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [results, setResults] = useState<
    { product: string; prix: string; name: string; distance_km: number }[]
  >([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const getLocationAndMatch = async () => {
    if (!image) return alert("Ajoutez une image d’abord.");

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await axios.post("/api/photo-match", {
          base64_image: image,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setResults(res.data.results || []);
      } catch (error) {
        alert("Erreur lors de la recherche d’offres.");
        console.error(error);
      }
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📷 Recherche intelligente d’un produit</h2>

      <input type="file" accept="image/*" onChange={handleImageUpload} className="mb-4" />

      <button
        onClick={getLocationAndMatch}
        className=""
      >
        🔍 Chercher les offres proches
      </button>

      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          {results.map((r, i) => (
            <div key={i} className="border p-4 rounded shadow">
              <p><strong>Produit :</strong> {r.product}</p>
              <p><strong>Prix :</strong> {r.prix}</p>
              <p><strong>Magasin :</strong> {r.name}</p>
              <p><strong>Distance :</strong> {r.distance_km} km</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoMatching;