@echo off
echo ======================================
echo      Starting MyPoems service...
echo ======================================
echo.

REM 切换到当前脚本所在的目录
cd /d "%~dp0"

echo Starting Node.js server...
echo.
REM 在后台启动 Node.js 服务。/B 参数使其不会打开新的黑窗口。
start /B node server.js

echo Opening browser...
REM 使用默认浏览器打开诗词集网址
start http://localhost:3000

echo.
echo MyPoems service started successfully!
echo.
echo (When finish service, close this window!)
echo.