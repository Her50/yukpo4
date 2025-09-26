import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() => Promise.resolve({
        coords: { latitude: 48.8566, longitude: 2.3522 }
    }))
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    launchImageLibraryAsync: jest.fn(() => Promise.resolve({ cancelled: false, uri: 'mock-image.jpg' }))
}));

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
    close: jest.fn(),
    send: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
    })
);

