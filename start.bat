@echo off
chcp 65001 > nul
title 启动服务器

echo 🚀 正在启动服务器...
echo 📝 执行命令: node server.js
echo.

:: 在新窗口中运行 node server.js
start cmd /k "node server.js"

:: 等待 2 秒让服务器启动
timeout /t 2 > nul

:: 打开浏览器
echo 🌐 正在打开浏览器...
start http://localhost:9696

echo ✅ 服务器已启动，浏览器已打开
echo.
echo 💡 关闭命令行窗口即可停止服务器