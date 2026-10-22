@echo off
chcp 65001 >nul
title 生成网站
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NONODE

node build.js
echo.
echo 完成。生成结果在 docs 文件夹里，整个文件夹就是你的网站。
pause
exit /b 0

:NONODE
echo.
echo   没有找到 Node.js，请先安装： https://nodejs.org/zh-cn
echo.
start "" "https://nodejs.org/zh-cn"
pause
exit /b 1
