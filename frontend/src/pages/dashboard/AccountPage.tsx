// @ts-check
import React, { useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { RecentViewed } from "@/components/history/RecentViewed";
// import { MessageInbox } from '@/components/messaging/MessageInbox'; // à activer si disponible
import { ROUTES } from "@/routes/AppRoutesRegistry";

function AccountPage() {
  const user = { id: 1, plan: "Pro", factureUrl: "/pdfs/facture_1.pdf" };
  const [sending, setSending] = useState(false);

  const envoyerFacture = async () => {
    try {
      setSending(true);
      await fetch(`/api/facture/${user.id}/send`);
      alert("📤 Facture envoyée via WhatsApp ou Email !");
    } catch (error) {
      console.error("Erreur d'envoi :", error);
      alert("❌ Échec de l'envoi de la facture.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveContainer className="py-8">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          👤 Mon compte{" "}
          <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </span>
        </h1>

        <p className="text-gray-700">
          Plan actuel :{" "}
          <span className="font-semibold text-blue-700">{user.plan}</span>
        </p>

        <a
          href={user.factureUrl}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline hover:text-blue-800"
        >
          📄 Télécharger ma facture
        </a>

        <button
          onClick={envoyerFacture}
          disabled={sending}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          {sending ? "Envoi en cours..." : "📤 Envoyer facture"}
        </button>

        <div>
          <RecentViewed userId={user.id} />
        </div>

        {/* À activer si disponible */}
        {/* <MessageInbox userId={user.id} /> */}

        {/* 🚀 CONTEXTUAL BUTTONS */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <a href={ROUTES.SERVICES} className="text-sm text-blue-600 underline">
            Découvrir d'autres services
          </a>
          <a href={ROUTES.PLANS} className="text-sm text-blue-600 underline">
            Voir les formules
          </a>
          <a href={ROUTES.CONTACT} className="text-sm text-blue-600 underline">
            Contacter l'équipe Yukpo
          </a>
        </div>
      </div>
    </ResponsiveContainer>
  );
}

export default AccountPage;
