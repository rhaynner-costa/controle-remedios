#!/usr/bin/env bash
# Uso: ./build-local.sh [dev|release|emulator|clean]
#   dev       (padrão) typecheck + build debug, instala e abre no emulador/dispositivo
#   release   typecheck + gera APK de release e instala no emulador/dispositivo
#   emulator  apenas inicia o emulador
#   clean     limpa o build do Gradle
set -euo pipefail

cd "$(dirname "$0")"

AVD_NAME="${AVD_NAME:-pixel}"
ANDROID_SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
EMULATOR_BIN="$ANDROID_SDK/emulator/emulator"
APK_RELEASE="android/app/build/outputs/apk/release/app-release.apk"

start_emulator() {
  if adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
    echo "==> Dispositivo/emulador já conectado."
    return
  fi

  echo "==> Iniciando emulador '$AVD_NAME'..."
  nohup "$EMULATOR_BIN" -avd "$AVD_NAME" >/tmp/emulator-"$AVD_NAME".log 2>&1 &
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
  done
  echo "==> Emulador pronto."
}

ensure_deps() {
  if [ ! -d node_modules ]; then
    echo "==> Instalando dependências..."
    npm install
  fi
}

case "${1:-dev}" in
  dev)
    ensure_deps
    npm run typecheck
    start_emulator
    npm run android
    ;;
  release)
    ensure_deps
    npm run typecheck
    start_emulator
    (cd android && ./gradlew assembleRelease)
    adb install -r "$APK_RELEASE"
    echo "==> APK instalado: $APK_RELEASE"
    ;;
  emulator)
    start_emulator
    ;;
  clean)
    (cd android && ./gradlew clean)
    ;;
  *)
    echo "Uso: $0 [dev|release|emulator|clean]" >&2
    exit 1
    ;;
esac
