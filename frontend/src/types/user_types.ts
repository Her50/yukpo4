import { WalletYukpo } from "./plan_types";

export interface UtilisateurYukpo {
  id: number;
  nom?: string;
  email: string;
  actif: boolean;
  date_creation: string;
  roles: string[]; // ex: ["admin", "client"]
  wallet: WalletYukpo;
  credits: number;
  currency: string;
  preferences?: {
    langue?: string;
    theme?: "clair" | "sombre";
    notifications?: boolean;
  };
}
