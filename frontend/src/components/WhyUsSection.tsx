import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { useUser } from "@/hooks/useUser";

interface Feature {
  icon: string;
  title: string;
  desc: React.ReactNode;
  link: string;
}

const YukpoBrand = () => (
  <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-bold">
    Yukpo
  </span>
);

const WhyUsSection: React.FC = () => {
  const { user } = useUser();

  const features: Feature[] = [
    {
      icon: "🎯",
      title: "Connexion intelligente",
      desc: (
        <>
          <YukpoBrand /> vous connecte au bon service, au bon moment.
        </>
      ),
      link: ROUTES.SERVICES,
    },
    {
      icon: "⚡",
      title: "Réponse immédiate",
      desc: "Trouvez une solution sans attendre.",
      link: user ? ROUTES.DASHBOARD_HOME : ROUTES.LOGIN,
    },
    {
      icon: "🎙️",
      title: "Interaction vocale",
      desc: (
        <>
          Exprimez vos besoins, <YukpoBrand /> agit automatiquement.
        </>
      ),
      link: ROUTES.VOICE_ASSISTANT,
    },
    {
      icon: "🛠️",
      title: "Création de service 1-clic",
      desc: "Créez un service en quelques secondes.",
      link: user ? ROUTES.SERVICE_CREATE : ROUTES.REGISTER,
    },
  ];

  return (
    <section className="py-16 bg-white text-center">
      <h2 className="text-3xl font-bold text-gray-800 mb-10">
        Pourquoi choisir <YukpoBrand /> ?
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {features.map(({ icon, title, desc, link }) => (
          <Link to={link} key={title} className="group">
            <div className="h-full flex flex-col justify-between bg-gray-50 p-6 rounded-xl shadow-md hover:shadow-xl transition-all">
              <h3 className="text-xl font-semibold mb-2">
                {icon} {title}
              </h3>
              <p className="text-gray-600">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default WhyUsSection;
