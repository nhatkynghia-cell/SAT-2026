@echo off
title Next.js Development Server
echo ==============================================
echo KHOI DONG GIAO DIEN WEB (NEXT.JS)
echo ==============================================
echo.

echo [INFO] Di chuyen vao thu muc sat-prep-web...
cd sat-prep-web

echo [INFO] Cai dat cac thu vien (neu chua co)...
call npm install

echo.
echo [INFO] Khoi dong may chu phat trien (Localhost)...
echo [INFO] Sau khi hien thong bao "Ready", hay mo trinh duyet vao: http://localhost:3000
echo.
call npm run dev

pause
