@echo off
echo 📱 Fleet Manager - Java Setup for Android Build
echo ================================================

echo 🔍 Checking Java installation...

where java >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Java not found in PATH
    echo 📥 Please install Java JDK 11 or higher from:
    echo    https://adoptium.net/temurin/releases/
    pause
    exit /b 1
)

echo ✅ Java found in PATH

echo.
echo 🔧 Current Java version:
java -version

echo.
echo 📋 To build APK manually:
echo 1. Install Java JDK 11+ from https://adoptium.net/temurin/releases/
echo 2. Set JAVA_HOME environment variable
echo 3. Run: cd android && gradlew.bat assembleDebug

echo.
echo 💡 Alternative: Use Android Studio
echo 1. Download Android Studio from https://developer.android.com/studio
echo 2. Open the android folder as a project
echo 3. Build APK from Build menu

echo.
echo 📱 Your app is ready for mobile deployment!
pause