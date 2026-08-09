#!/bin/bash
# SessionStart: gjør containeren klar til arbeid.
#
# Containeren er efemer — den gjenvinnes etter en tid, og alt utenfor git er
# borte ved neste økt. Denne hooken gjenoppretter derfor to ting:
#
#   1. npm-avhengighetene testene trenger (vitest + PGlite).
#   2. Agent-skillene, låst i `skills-lock.json`. Lockfila er committet, mens
#      de installerte filene ikke er — oppskriften hører i repoet, artefaktene
#      ikke.
#
# Kjører bare i skyen: lokalt har du dine egne globale skills, og hooken skal
# ikke overskrive dem.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# --- 1. Testavhengigheter. npm install (ikke ci): container-tilstanden caches
# etter at hooken er ferdig, og install utnytter cachen ved neste kjøring.
if [ -f package.json ]; then
  echo "[hook] npm install"
  npm install --no-audit --no-fund || echo "[hook] ADVARSEL: npm install feilet"
fi

# --- 2. Agent-skills fra lockfila. `experimental_install` er ikke-interaktiv og
# idempotent: den legger bare til det som mangler.
if [ -f skills-lock.json ]; then
  echo "[hook] gjenoppretter skills fra skills-lock.json"
  npx -y skills experimental_install || echo "[hook] ADVARSEL: skills-install feilet"
fi

# --- 3. claude-mem (minne på tvers av økter). Best effort: en feil her skal
# aldri blokkere økten, og pluginen laster først i NESTE økt om den var borte.
if command -v claude >/dev/null 2>&1; then
  if ! claude plugin list 2>/dev/null | grep -q "claude-mem"; then
    echo "[hook] installerer claude-mem"
    claude plugin marketplace add thedotmack/claude-mem >/dev/null 2>&1 || true
    claude plugin install claude-mem@thedotmack >/dev/null 2>&1 \
      || echo "[hook] ADVARSEL: claude-mem ble ikke installert"
  fi
fi

echo "[hook] ferdig"
