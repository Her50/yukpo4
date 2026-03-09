# WebRTC Build Timeout Fix - Summary

## Problem
Mobile build was failing with timeout when downloading `org.webrtc:google-webrtc:1.0.32006` from JitPack, causing builds to take 30+ minutes and ultimately fail.

## Root Causes
1. JitPack repository timeout for WebRTC dependency
2. Repository priority issues (JitPack before Maven Central)
3. Gradle cache corruption from failed builds
4. Network connectivity issues

## Fixes Applied

### 1. Repository Configuration (android/build.gradle)
- **Prioritized Maven Central for WebRTC**: Added dedicated Maven Central block with `includeGroup 'org.webrtc'`
- **Excluded WebRTC from JitPack**: Added `excludeGroup 'org.webrtc'` in JitPack repository configuration
- **Optimized repository order**: Maven Central first, then JitPack as last priority

### 2. Dependency Management (android/app/build.gradle)
- **Explicit WebRTC version**: Added `implementation('org.webrtc:google-webrtc:1.0.32006')` with exclusion for conflicting modules
- **Forced version resolution**: Added `force 'org.webrtc:google-webrtc:1.0.32006'` in resolutionStrategy
- **Removed transitive conflicts**: Added `exclude group: 'org.webrtc', module: 'webrtc-java'`

### 3. Timeout Configuration (android/gradle.properties)
- **Increased timeouts**: All network timeouts increased from 10 to 15 minutes (900000ms)
- **Added build cache optimization**: Enabled Gradle caching with cleanup
- **Extended daemon timeout**: Set daemon idle timeout to 1 hour

### 4. Build Scripts
- **Created cleaning scripts**: 
  - `scripts/clean-build-webrtc.ps1` (PowerShell)
  - `scripts/clean-build-webrtc.sh` (Bash)
  - `build-fix.bat` (Windows Batch)
- **Added npm scripts**: 
  - `clean:webrtc` - PowerShell cleaning
  - `eas:build:clean` - Clean + EAS build

## Usage

### Quick Fix
```bash
npm run clean:webrtc
npm run android
```

### For EAS Builds
```bash
npm run eas:build:clean
```

### Manual Cleaning (Windows)
```cmd
build-fix.bat
```

### Manual Cleaning (PowerShell)
```powershell
.\scripts\clean-build-webrtc-fixed.ps1
```

## Architecture Changes

### Repository Priority (New Order)
1. Maven Central (prioritized for WebRTC)
2. React Native local repository
3. JSC Android repository  
4. Google Maven repository
5. Maven Central (general)
6. JitPack (last priority, WebRTC excluded)

### Dependency Resolution
- WebRTC is now forced from Maven Central, not JitPack
- Version conflicts are resolved through explicit forcing
- Transitive dependencies that cause conflicts are excluded

## Expected Results
- Build time reduced from 30+ minutes to 5-10 minutes
- No more WebRTC timeout failures
- More reliable builds with proper caching
- Better dependency resolution

## Verification
After applying fixes:
1. Run `npm run clean:webrtc`
2. Run `npm run android` or `npm run eas:build:clean`
3. Build should complete without WebRTC timeouts
4. App should build and run successfully

## Files Modified
- `android/build.gradle` - Repository configuration
- `android/app/build.gradle` - Dependency management  
- `android/gradle.properties` - Timeout settings
- `package.json` - Added build scripts
- Created cleaning scripts in `scripts/` directory
