// Polyfills pour React Native/Expo
import { Buffer } from 'buffer';

// Global Buffer polyfill
global.Buffer = Buffer;
global.process = require('process');

// Crypto polyfill basique pour axios
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

console.log('[Polyfills] ✅ Crypto et Buffer polyfills chargés');
