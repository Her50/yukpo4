// 📁 src/utils/validateInputContextIA.ts
import { z } from "zod";

export const historiqueItemSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum(["texte", "image", "audio", "fichier", "gps"]),
  valeur: z.union([
    z.string(),
    z.array(z.string()),
    z.record(z.string(), z.any()),
  ]),
  commentaire: z.string().optional(),
});

export const inputContextIASchema = z.object({
  modalites: z.record(z.string(), z.unknown()),
  historique: z.array(historiqueItemSchema).optional(),
  user_id: z.number().optional(),
});

// ✅ Fonction de validation avec retour typé
export function validateInputContextIA(data: unknown) {
  const result = inputContextIASchema.safeParse(data);
  return result;
}
