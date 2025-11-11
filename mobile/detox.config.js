/** @type {Detox.DetoxConfig} */
module.exports = {
    testRunner: 'jest',
    runnerConfig: 'e2e/jest.config.js',
    apps: {
        'android.debug': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
            testBinaryPath:
                'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
            build:
                'expo prebuild -p android && cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
        },
        'ios.debug': {
            type: 'ios.app',
            binaryPath:
                'ios/build/Build/Products/Debug-iphonesimulator/Yukpomnang.app',
            build:
                'expo prebuild -p ios && cd ios && xcodebuild -workspace Yukpomnang.xcworkspace -scheme Yukpomnang -configuration Debug -sdk iphonesimulator -derivedDataPath ../ios/build && cd ..',
        },
    },
    devices: {
        'android.emu': {
            type: 'android.emulator',
            device: {
                avdName: 'Pixel_6_Pro_API_34',
            },
        },
        'ios.sim': {
            type: 'ios.simulator',
            device: {
                type: 'iPhone 14',
            },
        },
    },
    configurations: {
        'android.emu.debug': {
            device: 'android.emu',
            app: 'android.debug',
            artifacts: {
                rootDir: 'artifacts/android',
            },
        },
        'ios.sim.debug': {
            device: 'ios.sim',
            app: 'ios.debug',
            artifacts: {
                rootDir: 'artifacts/ios',
            },
        },
    },
};

