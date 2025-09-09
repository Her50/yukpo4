import React, { useState, useEffect } from 'react';

import { Link } from "react-router-dom";
import DefaultPageLayout from "@/components/layout/DefaultPageLayout";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const ConfirmationPage: React.FC = () => {
  return (
    <DefaultPageLayout>
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-2xl font-bold text-green-700 mb-4">
          📧 Vérification requise pour{" "}
          <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </span>
        </h2>
        <p className="text-gray-700 mb-6">
          Un lien de confirmation vous a été envoyé par email.
          Veuillez vérifier votre boîte de réception pour activer votre compte.
        </p>

        <Link
          to={ROUTES.HOME}
          className="text-primary font-semibold hover:underline"
        >
          ⬅ Retour à l'accueil
        </Link>
      </div>
    </DefaultPageLayout>
  );
};

export default ConfirmationPage;