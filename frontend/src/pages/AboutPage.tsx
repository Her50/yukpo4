// src/pages/AboutPage.tsx
import React from "react";
import AppLayout from "@/components/layout/AppLayout";

const YukpoBrand = ({ children = "Yukpo" }) => (
  <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 text-transparent bg-clip-text font-bold">
    {children}
  </span>
);

const AboutPage: React.FC = () => {
  return (
    <AppLayout>
      <section
        className="py-20 px-6 font-sans text-gray-800 dark:text-gray-200"
        style={{
          backgroundImage: "url('/assets/ndop-texture.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="max-w-4xl mx-auto bg-white/80 dark:bg-gray-900/80 rounded-xl shadow-xl p-10 backdrop-blur-sm space-y-8">

          <h1 className="text-4xl font-extrabold text-center">
            <YukpoBrand>Yukpomnang</YukpoBrand> — l’écoute qui comprend vraiment
          </h1>

          <p className="text-lg leading-relaxed text-center text-gray-700 dark:text-gray-300">
            Aussi appelé <YukpoBrand>Yukpo</YukpoBrand>, le nom de la plateforme signifie <em>« l’écoute des gens »</em> en langue <strong>Bayangam</strong>,
            parlée au cœur de l’Afrique centrale par <strong>un peuple Bamiléké du Cameroun</strong>.
          </p>

          <p className="leading-relaxed text-gray-800 dark:text-gray-200 text-justify">
            Fidèle à cette racine linguistique et humaine, <YukpoBrand>Yukpomnang</YukpoBrand> est une plateforme de connexion directe
            entre <span className="text-yellow-600 font-medium">les besoins exprimés</span> et <span className="text-orange-600 font-medium">les solutions concrètes</span> : services, opportunités, accompagnement.
          </p>

          <p className="leading-relaxed text-gray-800 dark:text-gray-200 text-justify">
            Grâce à son infrastructure multilingue, <YukpoBrand /> comprend et transmet les besoins dans plusieurs langues parlées sur le continent africain :
            <span className="text-blue-600 font-medium">
              {" "}fulfuldé, lingala, ewé, swahili, wolof, baoulé, mooré, bambara, haoussa, sango
            </span>, mais aussi dans les langues internationales comme le français, l’anglais, l’arabe ou le portugais.
          </p>

          <p className="leading-relaxed text-gray-800 dark:text-gray-200 text-justify">
            Que vous vous exprimiez à l’oral ou à l’écrit, même dans votre langue maternelle, <YukpoBrand /> vous comprend et vous répond.
            La plateforme est conçue pour être accessible même aux personnes <span className="text-pink-600 font-medium">aveugles, analphabètes ou en situation de handicap</span>.
          </p>

          <p className="leading-relaxed text-gray-800 dark:text-gray-200 text-justify">
            Que vous soyez <span className="text-red-600 font-semibold">citoyen, entrepreneur, diaspora ou acteur public</span>,
            <YukpoBrand>Yukpomnang</YukpoBrand> vous accompagne à chaque étape : recherche, recommandation, mise en relation.
            C’est un réseau de confiance, enraciné dans la culture et tourné vers l’avenir.
          </p>

          <p className="text-center text-lg font-semibold">
            🌍 <YukpoBrand /> — une oreille pour chacun, une réponse pour tous.
          </p>
        </div>
      </section>
    </AppLayout>
  );
};

export default AboutPage;
