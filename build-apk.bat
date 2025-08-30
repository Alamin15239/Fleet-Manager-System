@echo off
echo 📱 Building Fleet Manager APK...
echo.

echo 🔧 Step 1: Building Next.js app...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed!
    pause
    exit /b 1
)

echo ✅ Next.js build complete!
echo.

echo 🔄 Step 2: Syncing with Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ❌ Sync failed!
    pause
    exit /b 1
)

echo ✅ Android sync complete!
echo.

echo 📱 Step 3: Building APK...
cd android
call gradlew assembleDebug
if %errorlevel% neq 0 (
    echo ❌ APK build failed!
    pause
    exit /b 1
)

echo.
echo ✅ APK built successfully!
echo 📍 Location: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo 🚀 You can now install this APK on Android devices!
pause