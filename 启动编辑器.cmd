@echo off
chcp 65001 >nul
title 一键编辑器
cd /d "%~dp0"

set "NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto RUN
if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe" & goto RUN
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE=C:\Program Files (x86)\nodejs\node.exe" & goto RUN
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe" & goto RUN
goto NONODE

:RUN
echo 正在启动编辑器...
echo.
"%NODE%" editor.js
echo.
echo 编辑器已停止。
pause
exit /b 0

:NONODE
echo.
echo   没有找到 Node.js。
echo.
echo   请先安装（免费，约 30MB）： https://nodejs.org/zh-cn
echo   安装时一路点“下一步”，保持默认选项，装完重新双击本文件。
echo.
start "" "https://nodejs.org/zh-cn"
pause
exit /b 1
