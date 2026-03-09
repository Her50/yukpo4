# Clean Gradle cache and dependencies for WebRTC timeout fix

Write-Host "🧹 Cleaning Gradle cache and dependencies..." -ForegroundColor Green

# Clean Gradle cache
Set-Location android
& .\gradlew clean

# Remove specific WebRTC cached artifacts that might be corrupted
Write-Host "🗑️ Removing WebRTC cached artifacts..." -ForegroundColor Yellow
Remove-Item -Path "$env:USERPROFILE\.gradle\caches\modules-2\files-2.1\org.webrtc" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.gradle\caches\transforms-3\org.webrtc" -Recurse -Force -ErrorAction SilentlyContinue

# Clean node_modules and reinstall to ensure fresh dependencies
Set-Location ..
Write-Host "📦 Cleaning and reinstalling node_modules..." -ForegroundColor Yellow
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
npm install

Write-Host "✅ Cache cleaning complete. You can now run the build again:" -ForegroundColor Green
Write-Host "   npm run android"
Write-Host "   or"
Write-Host "   eas build --platform android" -ForegroundColor White
