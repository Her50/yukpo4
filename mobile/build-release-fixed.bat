@echo off
echo Starting Android build with optimized settings...

REM Set environment variables for build
set GRADLE_OPTS=-Xmx4G -XX:MaxMetaspaceSize=1G
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk

REM Clean first
echo Cleaning project...
cd android
gradlew clean --no-daemon --max-workers=1

REM Build release
echo Building release APK...
gradlew assembleRelease --no-daemon --max-workers=1 --stacktrace

echo Build completed!
pause
