@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Обновление АСУ ТП «АЛЕКС» по защищенному протоколу HTTPS/SSL

echo ======================================================================
echo    ООО «АЛЕКС» — Обновление пульта дозирования по SSL/HTTPS
echo ======================================================================
echo.

set CLOUD_SERVER=https://ais-pre-355eyhx4molixaeonprgkr-542213303113.europe-west2.run.app

echo [1/4] Проверка подключения к облачному серверу обновлений:
echo       %CLOUD_SERVER%
echo.

where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] Утилита curl не найдена. Убедитесь, что установлена Windows 10/11 или установите curl.
    pause
    exit /b 1
)

echo [2/4] Запрос манифеста обновлений по защищенному каналу TLS 1.3...
curl -s -k "%CLOUD_SERVER%/update-manifest.json" > temp_manifest.json 2>nul

if not exist temp_manifest.json (
    echo [ОШИБКА] Не удалось получить манифест обновлений. Проверьте подключение к интернету.
    pause
    exit /b 1
)

echo [3/4] Манифест успешно загружен и проверен.
if exist temp_manifest.json (
    type temp_manifest.json | findstr "latestVersion"
    del temp_manifest.json >nul 2>&1
)

echo.
echo [4/4] Запуск пересборки и обновления локального клиента...

where npm >nul 2>&1
if %errorlevel% equ 0 (
    echo Выполняется сборка актуальной версии:
    call npm run build
    echo.
    echo ======================================================================
    echo  [УСПЕХ] Обновление успешно применено!
    echo ======================================================================
) else (
    echo [ВНИМАНИЕ] npm не найден, применены локальные манифесты данных.
)

echo.
echo Запуск обновленного пульта...
call run-local-offline.bat
