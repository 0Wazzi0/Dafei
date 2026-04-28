@echo off
chcp 65001 >nul
title 单实例功能测试
cd /d "%~dp0"

echo ========================================
echo   Dafei 单实例功能测试
echo ========================================
echo.

echo 正在启动第一个实例...
echo 请稍等应用完全启动后再进行下一步测试
echo.

rem 启动第一个实例
start "" ".\release\dafei0228-win32-x64\dafei0228.exe"

timeout /t 3 /nobreak >nul

echo.
echo 第一个实例已启动
echo.
echo 现在将尝试启动第二个实例...
echo 如果单实例功能正常，第二个实例应该不会创建新窗口，
echo 而是激活第一个实例的窗口。
echo.

rem 尝试启动第二个实例
".\release\dafei0228-win32-x64\dafei0228.exe"

echo.
echo 测试完成！
echo 如果看到只有一个窗口，并且第二个启动命令激活了第一个窗口，则单实例功能正常。
echo.
pause