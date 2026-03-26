@echo off
echo ====================================================
echo   Medical Report System - Server Initialization
echo ====================================================
echo.
echo Sila buka browser Google Chrome atau Edge, dan 
echo taip alamat ini di atas (Address Bar):
echo.
echo        http://localhost:8000/frontend/index.html
echo.
echo AMARAN: JANGAN tutup paparan hitam ini selagi anda
echo sedang buat kerja. Kalau tutup, server akan mati.
echo.
echo ====================================================
php -S 0.0.0.0:8000 -t "%~dp0"
pause
