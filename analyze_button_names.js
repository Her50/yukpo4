console.log('🎯 ANALYSE MARKETING DES NOMS DE BOUTON DE LIVRAISON');
console.log('');

const options = [
    {
        nom: "Me livrer",
        avantages: ["Personnel et direct", "Action claire", "Engage l'utilisateur"],
        inconvenients: ["Formel", "Moins moderne", "Limité à la livraison"],
        score: 7
    },
    {
        nom: "Livraison",
        avantages: ["Simple et direct", "Moderne", "Universel"],
        inconvenients: ["Impersonnel", "Moins engageant", "Générique"],
        score: 6
    },
    {
        nom: "Commander",
        avantages: ["Action forte", "Moderne", "Incite à l'action"],
        inconvenients: ["Peut prêter à confusion", "Moins spécifique à la livraison"],
        score: 8
    },
    {
        nom: "Livrer maintenant",
        avantages: ["Urgence", "Action immédiate", "Marketing fort"],
        inconvenients: ["Long", "Trop agressif?", "Peut stresser"],
        score: 7
    },
    {
        nom: "Recevoir chez moi",
        avantages: ["Bénéfice clair", "Émotionnel positif", "Concret"],
        inconvenients: ["Long", "Moins direct", "Formel"],
        score: 6
    },
    {
        nom: "Ajouter au panier",
        avantages: ["Familier e-commerce", "Standard", "Logique"],
        inconvenients: ["Impersonnel", "Moins émotionnel", "Standard"],
        score: 8
    },
    {
        nom: "Commander la livraison",
        avantages: ["Clair et précis", "Action + bénéfice", "Professionnel"],
        inconvenients: ["Un peu long", "Moins punchy", "Formel"],
        score: 7
    },
    {
        nom: "Livraison express",
        avantages: ["Premium", "Rapidité", "Avantage concurrentiel"],
        inconvenients: ["Promesse forte", "Doit être vrai", "Pression"],
        score: 8
    }
];

console.log('📊 CLASSEMENT MARKETING:');
options.sort((a, b) => b.score - a.score).forEach((option, index) => {
    console.log(`${index + 1}. "${option.nom}" - Score: ${option.score}/10`);
    console.log(`   ✅ Avantages: ${option.avantages.slice(0, 2).join(', ')}`);
    console.log(`   ❌ Inconvénients: ${option.inconvenients.slice(0, 2).join(', ')}`);
    console.log('');
});

console.log('🎯 RECOMMANDATION MARKETING:');
console.log('');
console.log('🥇 MEILLEUR CHOIX: "Commander"');
console.log('   • Score: 8/10');
console.log('   • Pourquoi: Action forte, moderne, incite à l\'achat');
console.log('   • Contexte TikTok: Rapide, engageant, tendance');
console.log('');
console.log('🥈 DEUXIÈME CHOIX: "Livraison express"');
console.log('   • Score: 8/10');
console.log('   • Pourquoi: Premium, avantage concurrentiel clair');
console.log('   • Contexte: Met en valeur la rapidité du service');
console.log('');
console.log('🥉 TROISIÈME CHOIX: "Ajouter au panier"');
console.log('   • Score: 8/10');
console.log('   • Pourquoi: Familier, standard e-commerce');
console.log('   • Contexte: Logique pour les utilisateurs');
console.log('');

console.log('🚀 DÉCISION FINALE:');
console.log('Je recommande "Commander" pour:');
console.log('✅ Action forte et directe');
console.log('✅ Moderne et tendance (TikTok style)');
console.log('✅ Court et punchy');
console.log('✅ Universel et compris par tous');
console.log('✅ Incite à l\'achat immédiat');
