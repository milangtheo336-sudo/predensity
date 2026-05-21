@echo off
REM Initialize missing user stats for existing users
REM Run this from the root directory

cd frontend
echo.
echo Initializing missing user stats...
echo.

npx convex run leaderboard:initializeAllMissingUserStats

echo.
echo Done! Users should now appear on the leaderboard.
echo.
pause
