// @ts-check
import React from "react";

const TestimonialsAndPartners = () => (
  <section className="py-16 bg-gray-50 text-center">
    <h2 className="text-3xl font-bold text-gray-800 mb-10">Ce que disent nos utilisateurs</h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
      {[
        {
          name: "Fatoumata, Dakar",
          message: "Yukpomnang a transformé la façon dont je trouve mes prestataires ! C’est rapide et intelligent.",
        },
        {
          name: "Jean-Pierre, Yaoundé",
          message: "Un outil puissant qui m’a aidé à générer des leads en quelques minutes seulement.",
        },
        {
          name: "Sofia, Abidjan",
          message: "J’adore l’interface et les suggestions IA sont bluffantes.",
        },
      ].map((item, idx) => (
        <div key={idx} className="bg-white p-6 rounded-xl shadow-md">
          <p className="italic text-gray-600">“{item.message}”</p>
          <p className="mt-4 font-semibold">{item.name}</p>
        </div>
      ))}
    </div>

    <h2 className="text-3xl font-bold text-gray-800 mb-6">Ils nous font confiance</h2>
    <div className="flex justify-center items-center gap-10 flex-wrap max-w-4xl mx-auto opacity-80">
      <img src="/partner1.png" alt="Partenaire 1" className="h-10" />
      <img src="/partner2.png" alt="Partenaire 2" className="h-10" />
      <img src="/partner3.png" alt="Partenaire 3" className="h-10" />
      <img src="/partner4.png" alt="Partenaire 4" className="h-10" />
    </div>
  </section>
);

export default TestimonialsAndPartners;
