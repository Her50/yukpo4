import React from "react";

interface OAuthButtonProps {
  provider: "google" | "facebook";
}

const OAuthButton: React.FC<OAuthButtonProps> = ({ provider }) => {
  const label = provider === "google" ? "Google" : "Facebook";
  const bg = provider === "google" ? "bg-red-500" : "bg-blue-600";

  const handleOAuth = async () => {
    const tokenId = prompt(`Simuler un token OAuth ${label}`);
    if (!tokenId) return alert("Aucun token fourni.");

    try {
      const res = await fetch("/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_id: tokenId, provider }),
      });

      if (!res.ok) throw new Error("Erreur OAuth");

      const data = await res.json();
      alert(`Bienvenue ${data.email} ! Vous êtes connecté.`);
    } catch (err) {
      console.error(err);
      alert("Connexion échouée.");
    }
  };

  return (
    <button
      onClick={handleOAuth}
      className={`w-full ${bg} text-white py-2 rounded hover:opacity-90 transition`}
    >
      Continuer avec {label}
    </button>
  );
};

export default OAuthButton;
