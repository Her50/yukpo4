Running 'gradlew :app:assembleRelease' in /home/expo/workingdir/build/mobile/android
Downloading https://services.gradle.org/distributions/gradle-8.10.2-all.zip
10%
20%.
30%.
40%.
50%.
60%.
70%.
80%.
90%.
100%
Welcome to Gradle 8.10.2!
Here are the highlights of this release:
 - Support for Java 23
 - Faster configuration cache
- Better configuration cache reports
For more details see https://docs.gradle.org/8.10.2/release-notes.html
Starting a Gradle Daemon (subsequent builds will be faster)
> Task :gradle-plugin:settings-plugin:checkKotlinGradlePluginConfigurationErrors
> Task :gradle-plugin:shared:checkKotlinGradlePluginConfigurationErrors
> Task :gradle-plugin:settings-plugin:pluginDescriptors
> Task :gradle-plugin:settings-plugin:processResources
> Task :gradle-plugin:shared:processResources NO-SOURCE
> Task :gradle-plugin:shared:compileKotlin
> Task :gradle-plugin:shared:compileJava NO-SOURCE
> Task :gradle-plugin:shared:classes UP-TO-DATE
> Task :gradle-plugin:shared:jar
> Task :gradle-plugin:settings-plugin:compileKotlin
> Task :gradle-plugin:settings-plugin:compileJava NO-SOURCE
> Task :gradle-plugin:settings-plugin:classes
> Task :gradle-plugin:settings-plugin:jar
FAILURE: Build failed with an exception.
* What went wrong:
A problem occurred configuring project ':android'.
> compileSdkVersion is not specified. Please add it to build.gradle
* Try:
> Run with --stacktrace option to get the stack trace.
> Run with --info or --debug option to get more log output.
> Run with --scan to get full insights.
> Get more help at https://help.gradle.org.
BUILD FAILED in 56s
8 actionable tasks: 8 executed
Error: Gradle build failed with unknown error. See logs for the "Run gradlew" phase for more information.
