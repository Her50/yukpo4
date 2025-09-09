// src/utils/needInterpreter.ts

export async function interpretNeed(input: string): Promise<string> {
    const normalized = input.toLowerCase();
  
    if (normalized.includes("maison") || normalized.includes("terrain") || normalized.includes("immobilier")) {
      return "/formulaire/immobilier";
    } else if (normalized.includes("vol") || normalized.includes("billet") || normalized.includes("voyage")) {
      return "/formulaire/voyage";
    } else if (normalized.includes("coiffure") || normalized.includes("plombier") || normalized.includes("rapide")) {
      return "/match/rapide";
    } else {
      return "/formulaire/general";
    }
  }
  