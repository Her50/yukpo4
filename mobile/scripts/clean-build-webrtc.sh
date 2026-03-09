#!/bin/bash

echo "🧹 Cleaning Gradle cache and dependencies..."

# Clean Gradle cache
cd android
./gradlew clean

# Remove specific WebRTC cached artifacts that might be corrupted
echo "🗑️ Removing WebRTC cached artifacts..."
rm -rf ~/.gradle/caches/modules-2/files-2.1/org.webrtc/
rm -rf ~/.gradle/caches/transforms-3/org.webrtc/

# Clean node_modules and reinstall to ensure fresh dependencies
cd ..
echo "📦 Cleaning and reinstalling node_modules..."
rm -rf node_modules
npm install

echo "✅ Cache cleaning complete. You can now run the build again:"
echo "   npm run android"
echo "   or"
echo "   eas build --platform android"
