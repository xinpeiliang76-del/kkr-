@echo off
chcp 65001 >nul
title 生成网站
cd /d "%~dp0"

set "NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto RUN
if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe" & goto RUN
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE=C:\Program Files (x86)\nodejs\node.exe" & goto RUN
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe" & goto RUN
goto NONODE

:RUN
"%NODE%" build.js
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
