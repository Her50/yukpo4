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
    { id: 'emoji-1', name: '😀', emoji: '😀', category: 'emojis', tags: ['happy', 'smile'] },
    { id: 'emoji-2', name: '😂', emoji: '😂', category: 'emojis', tags: ['laugh', 'funny'] },
    { id: 'emoji-3', name: '😍', emoji: '😍', category: 'emojis', tags: ['love', 'heart'] },
    { id: 'emoji-4', name: '🤔', emoji: '🤔', category: 'emojis', tags: ['think', 'question'] },
    { id: 'emoji-5', name: '😎', emoji: '😎', category: 'emojis', tags: ['cool', 'sunglasses'] },
    { id: 'emoji-6', name: '🔥', emoji: '🔥', category: 'emojis', tags: ['fire', 'hot'] },
    { id: 'emoji-7', name: '💯', emoji: '💯', category: 'emojis', tags: ['perfect', '100'] },
    { id: 'emoji-8', name: '✨', emoji: '✨', category: 'emojis', tags: ['sparkle', 'magic'] },
    { id: 'emoji-9', name: '🎉', emoji: '🎉', category: 'emojis', tags: ['party', 'celebration'] },
    { id: 'emoji-10', name: '❤️', emoji: '❤️', category: 'emojis', tags: ['love', 'heart'] },

    // Reactions
    { id: 'reaction-1', name: '👍', emoji: '👍', category: 'reactions', tags: ['like', 'good'] },
    { id: 'reaction-2', name: '👎', emoji: '👎', category: 'reactions', tags: ['dislike', 'bad'] },
    { id: 'reaction-3', name: '👏', emoji: '👏', category: 'reactions', tags: ['clap', 'applause'] },
    { id: 'reaction-4', name: '🙌', emoji: '🙌', category: 'reactions', tags: ['praise', 'celebration'] },
    { id: 'reaction-5', name: '🤝', emoji: '🤝', category: 'reactions', tags: ['handshake', 'deal'] },
    { id: 'reaction-6', name: '💪', emoji: '💪', category: 'reactions', tags: ['strong', 'power'] },
    { id: 'reaction-7', name: '🙏', emoji: '🙏', category: 'reactions', tags: ['pray', 'thanks'] },
    { id: 'reaction-8', name: '🤞', emoji: '🤞', category: 'reactions', tags: ['luck', 'fingers'] },

    // Celebration
    { id: 'celeb-1', name: '🎊', emoji: '🎊', category: 'celebration', tags: ['party', 'confetti'] },
    { id: 'celeb-2', name: '🎈', emoji: '🎈', category: 'celebration', tags: ['balloon', 'birthday'] },
    { id: 'celeb-3', name: '🎁', emoji: '🎁', category: 'celebration', tags: ['gift', 'present'] },
    { id: 'celeb-4', name: '🎂', emoji: '🎂', category: 'celebration', tags: ['cake', 'birthday'] },
    { id: 'celeb-5', name: '🥳', emoji: '🥳', category: 'celebration', tags: ['party', 'celebration'] },
    { id: 'celeb-6', name: '🎪', emoji: '🎪', category: 'celebration', tags: ['circus', 'fun'] },
    { id: 'celeb-7', name: '🏆', emoji: '🏆', category: 'celebration', tags: ['trophy', 'winner'] },
    { id: 'celeb-8', name: '🥇', emoji: '🥇', category: 'celebration', tags: ['gold', 'first'] },

    // Love
    { id: 'love-1', name: '💕', emoji: '💕', category: 'love', tags: ['love', 'hearts'] },
    { id: 'love-2', name: '💖', emoji: '💖', category: 'love', tags: ['sparkle', 'heart'] },
    { id: 'love-3', name: '💗', emoji: '💗', category: 'love', tags: ['growing', 'heart'] },
    { id: 'love-4', name: '💓', emoji: '💓', category: 'love', tags: ['beating', 'heart'] },
    { id: 'love-5', name: '💝', emoji: '💝', category: 'love', tags: ['gift', 'heart'] },
    { id: 'love-6', name: '💘', emoji: '💘', category: 'love', tags: ['cupid', 'arrow'] },
    { id: 'love-7', name: '🌹', emoji: '🌹', category: 'love', tags: ['rose', 'romance'] },
    { id: 'love-8', name: '💐', emoji: '💐', category: 'love', tags: ['bouquet', 'flowers'] },

    // Funny
    { id: 'funny-1', name: '🤣', emoji: '🤣', category: 'funny', tags: ['laugh', 'rolling'] },
    { id: 'funny-2', name: '😜', emoji: '😜', category: 'funny', tags: ['wink', 'tongue'] },
    { id: 'funny-3', name: '🤪', emoji: '🤪', category: 'funny', tags: ['crazy', 'zany'] },
    { id: 'funny-4', name: '😝', emoji: '😝', category: 'funny', tags: ['tongue', 'silly'] },
    { id: 'funny-5', name: '🤭', emoji: '🤭', category: 'funny', tags: ['secret', 'shush'] },
    { id: 'funny-6', name: '🤡', emoji: '🤡', category: 'funny', tags: ['clown', 'joke'] },
    { id: 'funny-7', name: '👻', emoji: '👻', category: 'funny', tags: ['ghost', 'spooky'] },
    { id: 'funny-8', name: '💩', emoji: '💩', category: 'funny', tags: ['poop', 'silly'] },

    // Business
    { id: 'biz-1', name: '💼', emoji: '💼', category: 'business', tags: ['briefcase', 'work'] },
    { id: 'biz-2', name: '📊', emoji: '📊', category: 'business', tags: ['chart', 'data'] },
    { id: 'biz-3', name: '💰', emoji: '💰', category: 'business', tags: ['money', 'cash'] },
    { id: 'biz-4', name: '💵', emoji: '💵', category: 'business', tags: ['dollar', 'money'] },
    { id: 'biz-5', name: '📈', emoji: '📈', category: 'business', tags: ['growth', 'chart'] },
    { id: 'biz-6', name: '📉', emoji: '📉', category: 'business', tags: ['decline', 'chart'] },
    { id: 'biz-7', name: '💳', emoji: '💳', category: 'business', tags: ['card', 'payment'] },
    { id: 'biz-8', name: '🏢', emoji: '🏢', category: 'business', tags: ['building', 'office'] },

    // Food
    { id: 'food-1', name: '🍕', emoji: '🍕', category: 'food', tags: ['pizza', 'italian'] },
    { id: 'food-2', name: '🍔', emoji: '🍔', category: 'food', tags: ['burger', 'fastfood'] },
    { id: 'food-3', name: '🍟', emoji: '🍟', category: 'food', tags: ['fries', 'snack'] },
    { id: 'food-4', name: '🍰', emoji: '🍰', category: 'food', tags: ['cake', 'dessert'] },
    { id: 'food-5', name: '🍫', emoji: '🍫', category: 'food', tags: ['chocolate', 'sweet'] },
    { id: 'food-6', name: '☕', emoji: '☕', category: 'food', tags: ['coffee', 'drink'] },
    { id: 'food-7', name: '🍷', emoji: '🍷', category: 'food', tags: ['wine', 'drink'] },
    { id: 'food-8', name: '🍎', emoji: '🍎', category: 'food', tags: ['apple', 'fruit'] },

    // Animals
    { id: 'animal-1', name: '🐶', emoji: '🐶', category: 'animals', tags: ['dog', 'pet'] },
    { id: 'animal-2', name: '🐱', emoji: '🐱', category: 'animals', tags: ['cat', 'pet'] },
    { id: 'animal-3', name: '🐼', emoji: '🐼', category: 'animals', tags: ['panda', 'cute'] },
    { id: 'animal-4', name: '🦁', emoji: '🦁', category: 'animals', tags: ['lion', 'king'] },
    { id: 'animal-5', name: '🐯', emoji: '🐯', category: 'animals', tags: ['tiger', 'wild'] },
    { id: 'animal-6', name: '🐸', emoji: '🐸', category: 'animals', tags: ['frog', 'green'] },
    { id: 'animal-7', name: '🐨', emoji: '🐨', category: 'animals', tags: ['koala', 'cute'] },
    { id: 'animal-8', name: '🦄', emoji: '🦄', category: 'animals', tags: ['unicorn', 'magic'] },

    // Nature
    { id: 'nature-1', name: '🌳', emoji: '🌳', category: 'nature', tags: ['tree', 'forest'] },
    { id: 'nature-2', name: '🌲', emoji: '🌲', category: 'nature', tags: ['evergreen', 'tree'] },
    { id: 'nature-3', name: '🌴', emoji: '🌴', category: 'nature', tags: ['palm', 'beach'] },
    { id: 'nature-4', name: '🌸', emoji: '🌸', category: 'nature', tags: ['cherry', 'blossom'] },
    { id: 'nature-5', name: '🌺', emoji: '🌺', category: 'nature', tags: ['hibiscus', 'flower'] },
    { id: 'nature-6', name: '🌻', emoji: '🌻', category: 'nature', tags: ['sunflower', 'yellow'] },
    { id: 'nature-7', name: '🌊', emoji: '🌊', category: 'nature', tags: ['wave', 'ocean'] },
    { id: 'nature-8', name: '⛰️', emoji: '⛰️', category: 'nature', tags: ['mountain', 'peak'] },

    // Sports
    { id: 'sport-1', name: '⚽', emoji: '⚽', category: 'sports', tags: ['soccer', 'football'] },
    { id: 'sport-2', name: '🏀', emoji: '🏀', category: 'sports', tags: ['basketball', 'hoop'] },
    { id: 'sport-3', name: '🎾', emoji: '🎾', category: 'sports', tags: ['tennis', 'ball'] },
    { id: 'sport-4', name: '🏈', emoji: '🏈', category: 'sports', tags: ['football', 'american'] },
    { id: 'sport-5', name: '⚾', emoji: '⚾', category: 'sports', tags: ['baseball', 'bat'] },
    { id: 'sport-6', name: '🏐', emoji: '🏐', category: 'sports', tags: ['volleyball', 'net'] },
    { id: 'sport-7', name: '🏓', emoji: '🏓', category: 'sports', tags: ['pingpong', 'table'] },
    { id: 'sport-8', name: '🏸', emoji: '🏸', category: 'sports', tags: ['badminton', 'shuttle'] },

    // Music
    { id: 'music-1', name: '🎵', emoji: '🎵', category: 'music', tags: ['note', 'sound'] },
    { id: 'music-2', name: '🎶', emoji: '🎶', category: 'music', tags: ['notes', 'melody'] },
    { id: 'music-3', name: '🎤', emoji: '🎤', category: 'music', tags: ['mic', 'sing'] },
    { id: 'music-4', name: '🎧', emoji: '🎧', category: 'music', tags: ['headphones', 'listen'] },
    { id: 'music-5', name: '🎸', emoji: '🎸', category: 'music', tags: ['guitar', 'rock'] },
    { id: 'music-6', name: '🎹', emoji: '🎹', category: 'music', tags: ['piano', 'keys'] },
    { id: 'music-7', name: '🥁', emoji: '🥁', category: 'music', tags: ['drum', 'beat'] },
    { id: 'music-8', name: '🎺', emoji: '🎺', category: 'music', tags: ['trumpet', 'brass'] },

    // Travel
    { id: 'travel-1', name: '✈️', emoji: '✈️', category: 'travel', tags: ['plane', 'flight'] },
    { id: 'travel-2', name: '🚗', emoji: '🚗', category: 'travel', tags: ['car', 'drive'] },
    { id: 'travel-3', name: '🚕', emoji: '🚕', category: 'travel', tags: ['taxi', 'cab'] },
    { id: 'travel-4', name: '🚲', emoji: '🚲', category: 'travel', tags: ['bike', 'cycle'] },
    { id: 'travel-5', name: '🚢', emoji: '🚢', category: 'travel', tags: ['ship', 'cruise'] },
    { id: 'travel-6', name: '🏖️', emoji: '🏖️', category: 'travel', tags: ['beach', 'sand'] },
    { id: 'travel-7', name: '🗺️', emoji: '🗺️', category: 'travel', tags: ['map', 'location'] },
    { id: 'travel-8', name: '🧳', emoji: '🧳', category: 'travel', tags: ['luggage', 'suitcase'] },
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

