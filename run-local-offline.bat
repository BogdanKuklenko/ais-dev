@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Пульт дозирования ООО «АЛЕКС» (Офлайн)

echo ======================================================================
echo    ООО «АЛЕКС» — Запуск пульта дозирования в офлайн-режиме
echo ======================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ВНИМАНИЕ] Node.js не обнаружен.
    if exist dist\index.html (
        echo Запуск готовой версии интерфейса...
        start "" "dist\index.html"
        exit /b 0
    ) else (
        echo [ОШИБКА] Интерфейс еще не был собран.
        echo Пожалуйста, установите Node.js с https://nodejs.org/ и запустите сборку,
        echo либо установите приложение через браузер в 1 клик (PWA).
        pause
        exit /b 1
    )
)

if not exist node_modules (
    echo [1/2] Установка пакетов (npm install)...
    call npm install
)

if not exist dist\index.html (
    echo [2/2] Сборка интерфейса (npm run build)...
    call npm run build
)

echo Запуск локального сервера пульта...
call npx vite preview --port 3000 --open
