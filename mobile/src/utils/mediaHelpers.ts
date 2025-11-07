export const MAX_PRODUCT_IMAGES = 10;

const ensureImageDataUri = (value: string): string | null => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    if (
        trimmed.startsWith('data:image') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('file://') ||
        trimmed.startsWith('content://') ||
        trimmed.startsWith('blob:')
    ) {
        return trimmed;
    }

    if (trimmed.startsWith('data:')) {
        // Autres data URI (audio, pdf...) ignorés pour l'aperçu image
        return null;
    }

    // Par défaut, considérer que c'est un buffer base64 sans préfixe
    return `data:image/jpeg;base64,${trimmed}`;
};

const collectImageStrings = (input: any, seen = new WeakSet()): string[] => {
    if (!input) {
        return [];
    }

    if (Array.isArray(input)) {
        return input.flatMap((item) => collectImageStrings(item, seen));
    }

    if (typeof input === 'string') {
        const normalized = ensureImageDataUri(input);
        return normalized ? [normalized] : [];
    }

    if (typeof input === 'object') {
        if (seen.has(input)) {
            return [];
        }

        seen.add(input);

        if (input.valeur !== undefined) {
            return collectImageStrings(input.valeur, seen);
        }

        if (input.base64 !== undefined) {
            return collectImageStrings(input.base64, seen);
        }

        if (input.base64_image !== undefined) {
            return collectImageStrings(input.base64_image, seen);
        }

        if (input.images !== undefined) {
            return collectImageStrings(input.images, seen);
        }

        if (input.url !== undefined) {
            return collectImageStrings(input.url, seen);
        }

        return Object.values(input).flatMap((value) => collectImageStrings(value, seen));
    }

    return [];
};

export const sanitizeImageArray = (input: any, limit: number = MAX_PRODUCT_IMAGES): string[] => {
    const rawImages = collectImageStrings(input);
    const sanitized: string[] = [];

    rawImages.forEach((image) => {
        if (sanitized.includes(image)) {
            return;
        }

        if (sanitized.length < limit) {
            sanitized.push(image);
        }
    });

    return sanitized;
};

export const mergeImageSources = (limit: number = MAX_PRODUCT_IMAGES, ...sources: any[]): string[] => {
    const merged: string[] = [];

    sources.forEach((source) => {
        const images = sanitizeImageArray(source, limit);
        images.forEach((image) => {
            if (!merged.includes(image) && merged.length < limit) {
                merged.push(image);
            }
        });
    });

    return merged;
};

export const orderImagesWithPrimary = (
    imagesInput: any,
    currentPrimary: string | null | undefined,
    limit: number = MAX_PRODUCT_IMAGES
): { images: string[]; primary: string | null } => {
    const sanitized = sanitizeImageArray(imagesInput, limit);

    if (sanitized.length === 0) {
        return {
            images: [],
            primary: null,
        };
    }

    if (currentPrimary && sanitized.includes(currentPrimary)) {
        const filtered = sanitized.filter((image) => image !== currentPrimary);
        return {
            images: [currentPrimary, ...filtered],
            primary: currentPrimary,
        };
    }

    return {
        images: sanitized,
        primary: sanitized[0],
    };
};


