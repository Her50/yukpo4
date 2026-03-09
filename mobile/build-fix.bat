@echo off
echo Cleaning mobile build for WebRTC timeout fix...
cd /d %~dp0

echo Cleaning Gradle cache...
if exist android\.gradle rmdir /s /q android\.gradle

echo Cleaning node_modules...
if exist node_modules rmdir /s /q node_modules

echo Reinstalling dependencies...
call npm install

echo Building Android app...
call npm run android

pause
