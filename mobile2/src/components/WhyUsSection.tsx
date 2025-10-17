import * as React from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { Link } from "@react-navigation/native";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { useUser } from "@/hooks/useUser";

interface Feature {
  icon: string;
  title: string;
  desc: React.ReactNode;
  link: string;
}

const YukpoBrand = () => (
  <Text style="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-bold">
    Yukpo
  </Text>
);

const WhyUsSection: React.FC = () => {
  const { user } = useAuth();

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
    <section style="py-16 bg-white text-center">
      <Text style="text-3xl font-bold text-gray-800 mb-10">
        Pourquoi choisir <YukpoBrand /> ?
      </Text>

      <View style="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {features.map(({ icon, title, desc, link }) => (
          <Link to={link} key={title} style="group">
            <View style="h-full flex flex-col justify-between bg-gray-50 p-6 rounded-xl shadow-md hover:shadow-xl transition-all">
              <Text style="text-xl font-semibold mb-2">
                {icon} {title}
              </Text>
              <Text style="text-gray-600">{desc}</Text>
            </View>
          </Link>
        ))}
      </View>
    </section>
  );
};

export default WhyUsSection;





