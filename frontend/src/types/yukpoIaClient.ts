// 📁 frontend/src/types/yukpoaclient.ts

export interface MultiModalInput {
  texte?: string;

  // ✅ Données multimodales encodées
  base64_image?: string[];       // Images encodées (via FileReader)
  doc_base64?: string[];         // Documents PDF, DOCX encodés
  audio_base64?: string[];       // Audio unique (MP3, WAV, etc.)
  video_base64?: string[];       // Vidéo encodée (MP4, MOV)
  excel_base64?: string[];       // Fichier Excel (.xlsx)

  // 🎨 Identité visuelle
  logo?: string[];               // Logo du service (PNG, SVG recommandé)
  banner?: string[];             // Bannière du service (JPG, PNG recommandé)

  // ✅ Enrichissements contextuels
  site_web?: string;             // Lien à analyser
  langue_preferee?: string;      // Pour analyse IA personnalisée
  gps_mobile?: string;           // Coordonnées GPS

  // ?? NOUVEAU : Champs GPS manquants pour la création de service
  gps_fixe?: boolean;            // Indique si le GPS est fixe
  gps_fixe_coords?: string;      // Coordonnées GPS fixes du service
  gps_zone?: string;             // Zone GPS sélectionnée

  // 🔁 Pour extensions futures (images Drive, OCR, etc.)
  [cle: string]: any;
}
