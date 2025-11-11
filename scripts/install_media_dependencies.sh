#!/usr/bin/env bash
set -euo pipefail

# Yukpomnang video generation prerequisites installer
# Supports Debian/Ubuntu, macOS (brew), and Windows (via choco in PowerShell).

log() {
  printf "\033[1;34m[media-setup]\033[0m %s\n" "$1"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_ffmpeg() {
  if command_exists ffmpeg; then
    log "ffmpeg déjà installé ($(ffmpeg -version | head -n1))"
    return
  fi

  if command_exists apt-get; then
    log "Installation de ffmpeg via apt-get"
    sudo apt-get update
    sudo apt-get install -y ffmpeg
  elif command_exists brew; then
    log "Installation de ffmpeg via Homebrew"
    brew install ffmpeg
  else
    log "⚠️  ffmpeg doit être installé manuellement (voir README)."
  fi
}

ensure_espeak() {
  if command_exists espeak; then
    log "espeak déjà installé"
    return
  fi

  if command_exists apt-get; then
    log "Installation de espeak via apt-get"
    sudo apt-get install -y espeak
  elif command_exists brew; then
    log "Installation de espeak via Homebrew"
    brew install espeak
  else
    log "⚠️  espeak doit être installé manuellement (voix de secours)."
  fi
}

ensure_fonts() {
  local fonts_dir="/usr/share/fonts/truetype/dejavu"
  if [[ -f "${fonts_dir}/DejaVuSans-Bold.ttf" ]]; then
    log "Polices DejaVu déjà présentes (${fonts_dir})"
    return
  fi

  if command_exists apt-get; then
    log "Installation des polices DejaVu via apt-get"
    sudo apt-get install -y fonts-dejavu-core
  elif command_exists brew; then
    log "Installation des polices DejaVu via Homebrew"
    brew tap homebrew/cask-fonts
    brew install --cask font-dejavu-sans
  else
    log "⚠️  Installer manuellement une police TrueType (ex. Arial) et mettre à jour la variable UPLOAD_FONT_PATH."
  fi
}

log "Début de l'installation des dépendances médias"
ensure_ffmpeg
ensure_espeak
ensure_fonts
log "Installation terminée"

