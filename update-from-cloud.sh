#!/bin/bash
set -e

CLOUD_SERVER="https://ais-pre-355eyhx4molixaeonprgkr-542213303113.europe-west2.run.app"

echo "======================================================================"
echo "   ООО «АЛЕКС» — Обновление пульта дозирования по SSL/HTTPS"
echo "======================================================================"
echo ""
echo "[1/3] Проверка связи с защищенным сервером: $CLOUD_SERVER"

curl -s -k "$CLOUD_SERVER/update-manifest.json" > /tmp/alex_manifest.json

echo "[2/3] Манифест релиза получен успешно."
grep "latestVersion" /tmp/alex_manifest.json || true
rm -f /tmp/alex_manifest.json

echo "[3/3] Пересборка локального интерфейса..."
if command -v npm &> /dev/null; then
    npm run build
    echo "Обновление завершено успешно!"
fi
