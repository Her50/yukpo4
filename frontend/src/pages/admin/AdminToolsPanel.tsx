// @ts-check
import React from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import FlushTestButton from "@/components/admin/FlushTestButton";

const AdminToolsPanel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <RequireAuth allowedRoles={["admin"]}>
      <AppLayout padding>
        <div className="max-w-6xl mx-auto py-10 px-4">
          <h1 className="text-3xl font-bold mb-6 text-center">🧰 Outils d’administration Yukpo</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Bloc : Flush données test */}
            <Card className="shadow-lg">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-lg font-semibold mb-2">🧹 Nettoyage des données</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Supprime les données IA de test comme les traductions, modérations et plans (en mode dev uniquement).
                  </p>
                </div>
                <FlushTestButton />
              </CardContent>
            </Card>

            {/* Bloc : Dashboard IA */}
            <Card className="shadow-lg">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-lg font-semibold mb-2">📊 Charge des moteurs IA</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Consultez l'utilisation en temps réel des moteurs IA connectés (OpenAI, Mistral, Ollama…).
                  </p>
                </div>
                <Button onClick={() => navigate("/admin/load-test")}>
                  Voir le Dashboard IA
                </Button>
              </CardContent>
            </Card>

            {/* Bloc : Traduction IA admin */}
            <Card className="shadow-lg">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                  <h2 className="text-lg font-semibold mb-2">🌍 Test Traduction IA</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Testez la qualité des traductions multilingues pour votre contenu avec audit Mongo.
                  </p>
                </div>
                <Button onClick={() => navigate("/admin/translate/test")}>
                  Tester une traduction
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </RequireAuth>
  );
};

export default AdminToolsPanel;
