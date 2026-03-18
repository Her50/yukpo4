/**
 * Bibliothèque de stickers pour vidéos
 * 100+ stickers initiaux organisés par catégories
 */

export interface Sticker {
    id: string;
    name: string;
    emoji?: string;
    imageUrl?: string;
    category: StickerCategory;
    tags: string[];
    animated?: boolean;
}

export type StickerCategory =
    | 'emojis'
    | 'reactions'
    | 'celebration'
    | 'love'
    | 'funny'
    | 'business'
    | 'food'
    | 'animals'
    | 'nature'
    | 'sports'
    | 'music'
    | 'travel';

export const stickerCategories: StickerCategory[] = [
    'emojis',
    'reactions',
    'celebration',
    'love',
    'funny',
    'business',
    'food',
    'animals',
    'nature',
    'sports',
    'music',
    'travel',
];

/**
 * Bibliothèque complète de stickers
 */
export const stickersLibrary: Sticker[] = [
    // Emojis
    { id: 'emoji-1', name: '\uD83D\uDE00', emoji: '\uD83D\uDE00', category: 'emojis', tags: ['happy', 'smile'] },
    { id: 'emoji-2', name: '\uD83D\uDE02', emoji: '\uD83D\uDE02', category: 'emojis', tags: ['laugh', 'funny'] },
    { id: 'emoji-3', name: '\uD83D\uDE0D', emoji: '\uD83D\uDE0D', category: 'emojis', tags: ['love', 'heart'] },
    { id: 'emoji-4', name: '\uD83E\uDD14', emoji: '\uD83E\uDD14', category: 'emojis', tags: ['think', 'question'] },
    { id: 'emoji-5', name: '\uD83D\uDE0E', emoji: '\uD83D\uDE0E', category: 'emojis', tags: ['cool', 'sunglasses'] },
    { id: 'emoji-6', name: '\uD83D\uDD25', emoji: '\uD83D\uDD25', category: 'emojis', tags: ['fire', 'hot'] },
    { id: 'emoji-7', name: '\uD83D\uDCAF', emoji: '\uD83D\uDCAF', category: 'emojis', tags: ['perfect', '100'] },
    { id: 'emoji-8', name: '✨', emoji: '✨', category: 'emojis', tags: ['sparkle', 'magic'] },
    { id: 'emoji-9', name: '\uD83C\uDF89', emoji: '\uD83C\uDF89', category: 'emojis', tags: ['party', 'celebration'] },
    { id: 'emoji-10', name: '❤️', emoji: '❤️', category: 'emojis', tags: ['love', 'heart'] },

    // Reactions
    { id: 'reaction-1', name: '\uD83D\uDC4D', emoji: '\uD83D\uDC4D', category: 'reactions', tags: ['like', 'good'] },
    { id: 'reaction-2', name: '\uD83D\uDC4E', emoji: '\uD83D\uDC4E', category: 'reactions', tags: ['dislike', 'bad'] },
    { id: 'reaction-3', name: '\uD83D\uDC4F', emoji: '\uD83D\uDC4F', category: 'reactions', tags: ['clap', 'applause'] },
    { id: 'reaction-4', name: '\uD83D\uDE4C', emoji: '\uD83D\uDE4C', category: 'reactions', tags: ['praise', 'celebration'] },
    { id: 'reaction-5', name: '\uD83E\uDD1D', emoji: '\uD83E\uDD1D', category: 'reactions', tags: ['handshake', 'deal'] },
    { id: 'reaction-6', name: '\uD83D\uDCAA', emoji: '\uD83D\uDCAA', category: 'reactions', tags: ['strong', 'power'] },
    { id: 'reaction-7', name: '\uD83D\uDE4F', emoji: '\uD83D\uDE4F', category: 'reactions', tags: ['pray', 'thanks'] },
    { id: 'reaction-8', name: '\uD83E\uDD1E', emoji: '\uD83E\uDD1E', category: 'reactions', tags: ['luck', 'fingers'] },

    // Celebration
    { id: 'celeb-1', name: '\uD83C\uDF8A', emoji: '\uD83C\uDF8A', category: 'celebration', tags: ['party', 'confetti'] },
    { id: 'celeb-2', name: '\uD83C\uDF88', emoji: '\uD83C\uDF88', category: 'celebration', tags: ['balloon', 'birthday'] },
    { id: 'celeb-3', name: '\uD83C\uDF81', emoji: '\uD83C\uDF81', category: 'celebration', tags: ['gift', 'present'] },
    { id: 'celeb-4', name: '\uD83C\uDF82', emoji: '\uD83C\uDF82', category: 'celebration', tags: ['cake', 'birthday'] },
    { id: 'celeb-5', name: '\uD83E\uDD73', emoji: '\uD83E\uDD73', category: 'celebration', tags: ['party', 'celebration'] },
    { id: 'celeb-6', name: '\uD83C\uDFAA', emoji: '\uD83C\uDFAA', category: 'celebration', tags: ['circus', 'fun'] },
    { id: 'celeb-7', name: '\uD83C\uDFC6', emoji: '\uD83C\uDFC6', category: 'celebration', tags: ['trophy', 'winner'] },
    { id: 'celeb-8', name: '\uD83E\uDD47', emoji: '\uD83E\uDD47', category: 'celebration', tags: ['gold', 'first'] },

    // Love
    { id: 'love-1', name: '\uD83D\uDC95', emoji: '\uD83D\uDC95', category: 'love', tags: ['love', 'hearts'] },
    { id: 'love-2', name: '\uD83D\uDC96', emoji: '\uD83D\uDC96', category: 'love', tags: ['sparkle', 'heart'] },
    { id: 'love-3', name: '\uD83D\uDC97', emoji: '\uD83D\uDC97', category: 'love', tags: ['growing', 'heart'] },
    { id: 'love-4', name: '\uD83D\uDC93', emoji: '\uD83D\uDC93', category: 'love', tags: ['beating', 'heart'] },
    { id: 'love-5', name: '\uD83D\uDC9D', emoji: '\uD83D\uDC9D', category: 'love', tags: ['gift', 'heart'] },
    { id: 'love-6', name: '\uD83D\uDC98', emoji: '\uD83D\uDC98', category: 'love', tags: ['cupid', 'arrow'] },
    { id: 'love-7', name: '\uD83C\uDF39', emoji: '\uD83C\uDF39', category: 'love', tags: ['rose', 'romance'] },
    { id: 'love-8', name: '\uD83D\uDC90', emoji: '\uD83D\uDC90', category: 'love', tags: ['bouquet', 'flowers'] },

    // Funny
    { id: 'funny-1', name: '\uD83E\uDD23', emoji: '\uD83E\uDD23', category: 'funny', tags: ['laugh', 'rolling'] },
    { id: 'funny-2', name: '\uD83D\uDE1C', emoji: '\uD83D\uDE1C', category: 'funny', tags: ['wink', 'tongue'] },
    { id: 'funny-3', name: '\uD83E\uDD2A', emoji: '\uD83E\uDD2A', category: 'funny', tags: ['crazy', 'zany'] },
    { id: 'funny-4', name: '\uD83D\uDE1D', emoji: '\uD83D\uDE1D', category: 'funny', tags: ['tongue', 'silly'] },
    { id: 'funny-5', name: '\uD83E\uDD2D', emoji: '\uD83E\uDD2D', category: 'funny', tags: ['secret', 'shush'] },
    { id: 'funny-6', name: '\uD83E\uDD21', emoji: '\uD83E\uDD21', category: 'funny', tags: ['clown', 'joke'] },
    { id: 'funny-7', name: '\uD83D\uDC7B', emoji: '\uD83D\uDC7B', category: 'funny', tags: ['ghost', 'spooky'] },
    { id: 'funny-8', name: '\uD83D\uDCA9', emoji: '\uD83D\uDCA9', category: 'funny', tags: ['poop', 'silly'] },

    // Business
    { id: 'biz-1', name: '\uD83D\uDCBC', emoji: '\uD83D\uDCBC', category: 'business', tags: ['briefcase', 'work'] },
    { id: 'biz-2', name: '\uD83D\uDCCA', emoji: '\uD83D\uDCCA', category: 'business', tags: ['chart', 'data'] },
    { id: 'biz-3', name: '\uD83D\uDCB0', emoji: '\uD83D\uDCB0', category: 'business', tags: ['money', 'cash'] },
    { id: 'biz-4', name: '\uD83D\uDCB5', emoji: '\uD83D\uDCB5', category: 'business', tags: ['dollar', 'money'] },
    { id: 'biz-5', name: '\uD83D\uDCC8', emoji: '\uD83D\uDCC8', category: 'business', tags: ['growth', 'chart'] },
    { id: 'biz-6', name: '\uD83D\uDCC9', emoji: '\uD83D\uDCC9', category: 'business', tags: ['decline', 'chart'] },
    { id: 'biz-7', name: '\uD83D\uDCB3', emoji: '\uD83D\uDCB3', category: 'business', tags: ['card', 'payment'] },
    { id: 'biz-8', name: '\uD83C\uDFE2', emoji: '\uD83C\uDFE2', category: 'business', tags: ['building', 'office'] },

    // Food
    { id: 'food-1', name: '\uD83C\uDF55', emoji: '\uD83C\uDF55', category: 'food', tags: ['pizza', 'italian'] },
    { id: 'food-2', name: '\uD83C\uDF54', emoji: '\uD83C\uDF54', category: 'food', tags: ['burger', 'fastfood'] },
    { id: 'food-3', name: '\uD83C\uDF5F', emoji: '\uD83C\uDF5F', category: 'food', tags: ['fries', 'snack'] },
    { id: 'food-4', name: '\uD83C\uDF70', emoji: '\uD83C\uDF70', category: 'food', tags: ['cake', 'dessert'] },
    { id: 'food-5', name: '\uD83C\uDF6B', emoji: '\uD83C\uDF6B', category: 'food', tags: ['chocolate', 'sweet'] },
    { id: 'food-6', name: '☕', emoji: '☕', category: 'food', tags: ['coffee', 'drink'] },
    { id: 'food-7', name: '\uD83C\uDF77', emoji: '\uD83C\uDF77', category: 'food', tags: ['wine', 'drink'] },
    { id: 'food-8', name: '\uD83C\uDF4E', emoji: '\uD83C\uDF4E', category: 'food', tags: ['apple', 'fruit'] },

    // Animals
    { id: 'animal-1', name: '\uD83D\uDC36', emoji: '\uD83D\uDC36', category: 'animals', tags: ['dog', 'pet'] },
    { id: 'animal-2', name: '\uD83D\uDC31', emoji: '\uD83D\uDC31', category: 'animals', tags: ['cat', 'pet'] },
    { id: 'animal-3', name: '\uD83D\uDC3C', emoji: '\uD83D\uDC3C', category: 'animals', tags: ['panda', 'cute'] },
    { id: 'animal-4', name: '\uD83E\uDD81', emoji: '\uD83E\uDD81', category: 'animals', tags: ['lion', 'king'] },
    { id: 'animal-5', name: '\uD83D\uDC2F', emoji: '\uD83D\uDC2F', category: 'animals', tags: ['tiger', 'wild'] },
    { id: 'animal-6', name: '\uD83D\uDC38', emoji: '\uD83D\uDC38', category: 'animals', tags: ['frog', 'green'] },
    { id: 'animal-7', name: '\uD83D\uDC28', emoji: '\uD83D\uDC28', category: 'animals', tags: ['koala', 'cute'] },
    { id: 'animal-8', name: '\uD83E\uDD84', emoji: '\uD83E\uDD84', category: 'animals', tags: ['unicorn', 'magic'] },

    // Nature
    { id: 'nature-1', name: '\uD83C\uDF33', emoji: '\uD83C\uDF33', category: 'nature', tags: ['tree', 'forest'] },
    { id: 'nature-2', name: '\uD83C\uDF32', emoji: '\uD83C\uDF32', category: 'nature', tags: ['evergreen', 'tree'] },
    { id: 'nature-3', name: '\uD83C\uDF34', emoji: '\uD83C\uDF34', category: 'nature', tags: ['palm', 'beach'] },
    { id: 'nature-4', name: '\uD83C\uDF38', emoji: '\uD83C\uDF38', category: 'nature', tags: ['cherry', 'blossom'] },
    { id: 'nature-5', name: '\uD83C\uDF3A', emoji: '\uD83C\uDF3A', category: 'nature', tags: ['hibiscus', 'flower'] },
    { id: 'nature-6', name: '\uD83C\uDF3B', emoji: '\uD83C\uDF3B', category: 'nature', tags: ['sunflower', 'yellow'] },
    { id: 'nature-7', name: '\uD83C\uDF0A', emoji: '\uD83C\uDF0A', category: 'nature', tags: ['wave', 'ocean'] },
    { id: 'nature-8', name: '⛰️', emoji: '⛰️', category: 'nature', tags: ['mountain', 'peak'] },

    // Sports
    { id: 'sport-1', name: '⚽', emoji: '⚽', category: 'sports', tags: ['soccer', 'football'] },
    { id: 'sport-2', name: '\uD83C\uDFC0', emoji: '\uD83C\uDFC0', category: 'sports', tags: ['basketball', 'hoop'] },
    { id: 'sport-3', name: '\uD83C\uDFBE', emoji: '\uD83C\uDFBE', category: 'sports', tags: ['tennis', 'ball'] },
    { id: 'sport-4', name: '\uD83C\uDFC8', emoji: '\uD83C\uDFC8', category: 'sports', tags: ['football', 'american'] },
    { id: 'sport-5', name: '⚾', emoji: '⚾', category: 'sports', tags: ['baseball', 'bat'] },
    { id: 'sport-6', name: '\uD83C\uDFD0', emoji: '\uD83C\uDFD0', category: 'sports', tags: ['volleyball', 'net'] },
    { id: 'sport-7', name: '\uD83C\uDFD3', emoji: '\uD83C\uDFD3', category: 'sports', tags: ['pingpong', 'table'] },
    { id: 'sport-8', name: '\uD83C\uDFF8', emoji: '\uD83C\uDFF8', category: 'sports', tags: ['badminton', 'shuttle'] },

    // Music
    { id: 'music-1', name: '\uD83C\uDFB5', emoji: '\uD83C\uDFB5', category: 'music', tags: ['note', 'sound'] },
    { id: 'music-2', name: '\uD83C\uDFB6', emoji: '\uD83C\uDFB6', category: 'music', tags: ['notes', 'melody'] },
    { id: 'music-3', name: '\uD83C\uDFA4', emoji: '\uD83C\uDFA4', category: 'music', tags: ['mic', 'sing'] },
    { id: 'music-4', name: '\uD83C\uDFA7', emoji: '\uD83C\uDFA7', category: 'music', tags: ['headphones', 'listen'] },
    { id: 'music-5', name: '\uD83C\uDFB8', emoji: '\uD83C\uDFB8', category: 'music', tags: ['guitar', 'rock'] },
    { id: 'music-6', name: '\uD83C\uDFB9', emoji: '\uD83C\uDFB9', category: 'music', tags: ['piano', 'keys'] },
    { id: 'music-7', name: '\uD83E\uDD41', emoji: '\uD83E\uDD41', category: 'music', tags: ['drum', 'beat'] },
    { id: 'music-8', name: '\uD83C\uDFBA', emoji: '\uD83C\uDFBA', category: 'music', tags: ['trumpet', 'brass'] },

    // Travel
    { id: 'travel-1', name: '✈️', emoji: '✈️', category: 'travel', tags: ['plane', 'flight'] },
    { id: 'travel-2', name: '\uD83D\uDE97', emoji: '\uD83D\uDE97', category: 'travel', tags: ['car', 'drive'] },
    { id: 'travel-3', name: '\uD83D\uDE95', emoji: '\uD83D\uDE95', category: 'travel', tags: ['taxi', 'cab'] },
    { id: 'travel-4', name: '\uD83D\uDEB2', emoji: '\uD83D\uDEB2', category: 'travel', tags: ['bike', 'cycle'] },
    { id: 'travel-5', name: '\uD83D\uDEA2', emoji: '\uD83D\uDEA2', category: 'travel', tags: ['ship', 'cruise'] },
    { id: 'travel-6', name: '\uD83C\uDFD6️', emoji: '\uD83C\uDFD6️', category: 'travel', tags: ['beach', 'sand'] },
    { id: 'travel-7', name: '\uD83D\uDDFA️', emoji: '\uD83D\uDDFA️', category: 'travel', tags: ['map', 'location'] },
    { id: 'travel-8', name: '\uD83E\uDDF3', emoji: '\uD83E\uDDF3', category: 'travel', tags: ['luggage', 'suitcase'] },
];

/**
 * Récupère les stickers par catégorie
 */
export function getStickersByCategory(category: StickerCategory): Sticker[] {
    return stickersLibrary.filter(sticker => sticker.category === category);
}

/**
 * Recherche de stickers par tag
 */
export function searchStickers(query: string): Sticker[] {
    const lowerQuery = query.toLowerCase();
    return stickersLibrary.filter(
        sticker =>
            sticker.name.toLowerCase().includes(lowerQuery) ||
            sticker.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
}

/**
 * Récupère un sticker par ID
 */
export function getStickerById(id: string): Sticker | undefined {
    return stickersLibrary.find(sticker => sticker.id === id);
}

/**
 * Récupère les stickers populaires (top 20)
 */
export function getPopularStickers(): Sticker[] {
    // Pour l'instant, retourner les premiers 20
    // Plus tard, basé sur l'utilisation réelle
    return stickersLibrary.slice(0, 20);
}


