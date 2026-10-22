@echo off
chcp 65001 >nul
title 本地预览
cd /d "%~dp0"

set "NODE=node"
where node >nul 2>nul
if not errorlevel 1 goto RUN
if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe" & goto RUN
if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE=C:\Program Files (x86)\nodejs\node.exe" & goto RUN
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe" & goto RUN
goto NONODE

:RUN
echo 正在生成网站...
"%NODE%" build.js
if errorlevel 1 (
  echo.
  echo 生成失败，请把上面的报错内容发给懂的人看。
  pause
  exit /b 1
)
echo.
echo 启动本地预览，浏览器会自动打开 http://localhost:4000
echo 关闭这个窗口即可停止。
echo.
"%NODE%" serve.js
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
