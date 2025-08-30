@echo off
echo Setting up Real-time Sync...

echo Installing Vercel CLI...
npm install -g vercel

echo Installing concurrently for parallel processes...
npm install --save-dev concurrently

echo Logging into Vercel...
vercel login

echo Linking project to Vercel...
vercel link

echo Setup complete!
echo.
echo To start development with real-time sync:
echo npm run dev:sync
echo.
echo To manually deploy:
echo vercel --prod
echo.
pause