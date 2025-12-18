// @ts-check
import * as React from "react";
import { Text } from 'react-native';
import { View } from 'react-native';

const TestimonialsAndPartners = () => (
  <section style="py-16 bg-gray-50 text-center">
    <Text style="text-3xl font-bold text-gray-800 mb-10">Ce que disent nos utilisateurs</Text>

    <View style="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-16">
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
        <View key={idx} style="bg-white p-6 rounded-xl shadow-md">
          <Text style="italic text-gray-600">“{item.message}”</Text>
          <Text style="mt-4 font-semibold">{item.name}</Text>
        </View>
      ))}
    </View>

    <Text style="text-3xl font-bold text-gray-800 mb-6">Ils nous font confiance</Text>
    <View style="flex justify-center items-center gap-10 flex-wrap max-w-4xl mx-auto opacity-80">
      <img src="/partner1.png" alt="Partenaire 1" style="h-10" />
      <img src="/partner2.png" alt="Partenaire 2" style="h-10" />
      <img src="/partner3.png" alt="Partenaire 3" style="h-10" />
      <img src="/partner4.png" alt="Partenaire 4" style="h-10" />
    </View>
  </section>
);

export default TestimonialsAndPartners;





