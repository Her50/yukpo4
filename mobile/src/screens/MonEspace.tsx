// src/pages/MonEspace.tsx
import React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useUser } from "@/hooks/useUser";
import { useNavigation } from "@react-navigation/native";

const MonEspace: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigation();

  const recent = [
    { id: 1, label: "Publication d’un besoin à Douala", date: "2025-05-01" },
    { id: 2, label: "Mise à jour de mon profil", date: "2025-05-03" },
    { id: 3, label: "Connexion réussie", date: "2025-05-05" },
  ];

  const handleClick = () => {
    if (!user) return;
    if (user.role === "admin") {
      navigation.navigate("/adminpanel");
    } else if (user.plan === "enterprise") {
      navigation.navigate("/dashboard/stats");
    } else {
      navigation.navigate("/dashboard/services");
    }
  };

  return (
    <AppLayout>
      <section style="min-h-screen py-16 px-6 bg-gradient-to-tr from-white via-yellow-50 to-pink-50 dark:from-gray-900 dark:to-gray-950 font-sans">
        <View style="max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 space-y-6">
          <h1 style="text-3xl font-extrabold text-center text-gray-800 dark:text-white flex items-center justify-center gap-2">
            🧭 Mon Espace Personnel
          </h1>

          <View style="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
            <h2 style="text-xl font-bold mb-4 text-gray-700 dark:text-gray-200">
              Dernières interactions
            </h2>
            <ul style="space-y-4">
              {recent.map((item) => (
                <li
                  key={item.id}
                  style="flex items-start gap-4 border-l-4 border-yellow-500 pl-4"
                >
                  <View>
                    <p style="font-medium text-gray-800 dark:text-gray-100">
                      {item.label}
                    </Text>
                    <p style="text-sm text-gray-500 dark:text-gray-400">
                      {item.date}
                    </Text>
                  </View>
                </li>
              ))}
            </ul>
          </View>

          <View style="flex justify-center">
            <TouchableOpacity
              onClick={handleClick}
              style="bg-yellow-500 hover:bg-yellow-600 transition text-white font-semibold rounded-full px-6 py-3 flex items-center gap-2 shadow-lg"
            >
              🔍 Explorer mes opportunités
            </TouchableOpacity>
          </View>
        </View>
      </section>
    </AppLayout>
  );
};

export default MonEspace;

