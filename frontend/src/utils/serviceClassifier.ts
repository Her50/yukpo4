// src/utils/serviceClassifier.ts

export async function detectServiceType(): Promise<string> {
    // Ici, simple simulation pour démonstration.
  
    // Simulation aléatoire pour développement
    const types = ["immobilier", "livre", "transport", "autre"];
    const index = Math.floor(Math.random() * types.length);
    return types[index];
  }
