/** Variables Expo (EXPO_PUBLIC_*) — typage pour process.env */
declare namespace NodeJS {
    interface ProcessEnv {
        EXPO_PUBLIC_API_URL?: string;
        EXPO_PUBLIC_API_BASE_URL?: string;
        EXPO_PUBLIC_WS_URL?: string;
        EXPO_PUBLIC_ENVIRONMENT?: string;
        EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY?: string;
        EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY?: string;
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
        EXPO_PUBLIC_UPLOAD_BASE_URL?: string;
        EXPO_PUBLIC_CDN_GCP_URL?: string;
        EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL?: string;
        EXPO_PUBLIC_WASABI_DIRECT_URL?: string;
        EXPO_PUBLIC_SAGACI_API_KEY?: string;
        EXPO_PUBLIC_SAGACI_API_URL?: string;
        EXPO_PUBLIC_SAGACI_ENABLED?: string;
    }
}

export {};
