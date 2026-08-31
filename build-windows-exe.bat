@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Сборка портативного .EXE для Windows (ООО «АЛЕКС»)

echo ======================================================================
echo    ООО «АЛЕКС» — Автоматическая сборка портативного EXE для Windows
echo ======================================================================
echo.

:: 1. Проверка наличия Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] На вашем компьютере не установлен Node.js!
    echo.
    echo Чтобы собрать .exe файл:
    echo 1. Скачайте и установите Node.js (версия LTS) с официального сайта:
    echo    https://nodejs.org/
    echo 2. После установки перезапустите этот файл (build-windows-exe.bat).
    echo.
    echo ----------------------------------------------------------------------
    echo СОВЕТ: Вы можете использовать приложение БЕЗ установки Node.js:
    echo Откройте ссылку приложения в браузере (Chrome / Edge) и нажмите
    echo кнопку «Установить на рабочий стол» (значок монитора в адресной строке).
    echo ----------------------------------------------------------------------
    echo.
    pause
    exit /b 1
)

echo [1/4] Проверка окружения Node.js... OK
node -v
npm -v
echo.

:: 2. Проверка и установка зависимостей
if not exist node_modules (
    echo [2/4] Папка node_modules не найдена. Установка зависимостей (npm install)...
    echo Пожалуйста, подождите 1-2 минуты...
    call npm install
    if %errorlevel% neq 0 (
        echo [ОШИБКА] Сбой при установке npm пакетов. Проверьте интернет-соединение.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Зависимости node_modules уже установлены.
)
echo.

:: 3. Сборка React/Vite интерфейса
echo [3/4] Компиляция интерфейса пульта (Vite build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ОШИБКА] Ошибка при сборке Vite.
    pause
    exit /b 1
)
echo.

:: 4. Упаковка в единый портативный .EXE через Electron
echo [4/4] Создание единого переносимого файла .EXE (Electron Builder)...
echo Это займет около 1-3 минут при первом запуске...
call npx electron-builder --win portable
if %errorlevel% neq 0 (
    echo.
    echo [Предупреждение] Повторная попытка сборки...
    call npx electron-builder --win portable --dir
)

echo.
echo ======================================================================
echo   [УСПЕХ] Сборка завершена!
echo.
echo   Файл готов в папке:
echo   dist-electron\ALEX_Dosing_Control_Portable.exe
echo.
echo   Вы можете скопировать этот .exe на флешку и запускать
echo   на любом компьютере с Windows 10/11 без установки!
echo ======================================================================
echo.

if exist dist-electron (
    explorer dist-electron
)

pause
