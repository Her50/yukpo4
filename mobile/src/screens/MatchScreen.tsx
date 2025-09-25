// @ts-check
import React, { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useUser } from "@/hooks/useUser";

const MatchPage: React.FC = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleSearch = () => {
    if (!query.trim()) return;
    setResult(`🔍 Résultat simulé pour : "${query}"`);
  };

  return (
    <AppLayout>
      <section style="max-w-3xl mx-auto py-16 px-4 text-center font-sans">
        <h1 style="text-4xl font-bold text-gray-900 dark:text-white mb-6">
          🎯 Rechercher un service intelligent
        </h1>
        <p style="text-gray-600 dark:text-gray-300 mb-8">
          {user
            ? `Bienvenue ${user.name || ""}, décris ton besoin en quelques mots.`
            : "Exprime ton besoin, l’IA Yukpo se charge du reste."}
        </Text>

        <View style="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <TextInput
            type="text"
            placeholder="Exemple : hébergement à Douala"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style="flex-1 px-4 py-3 border rounded shadow-sm w-full dark:bg-gray-800 dark:text-white"
          />
          <TouchableOpacity
            onClick={handleSearch}
            style="px-6 py-3 bg-primary text-white font-semibold rounded hover:bg-opacity-90 transition"
          >
            Trouver
          </TouchableOpacity>
        </View>

        {result && (
          <View style="mt-6 p-4 border border-green-500 bg-green-50 dark:bg-gray-900 dark:border-green-600 rounded text-green-700 dark:text-green-300">
            {result}
          </View>
        )}
      </section>
    </AppLayout>
  );
};

export default MatchPage;

