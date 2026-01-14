#!/bin/bash
# Auto-Refresh Claude OAuth Token beim Start
# Prüft ob Token abgelaufen ist und erneuert ihn automatisch
# Wird vor Docker-Start aufgerufen

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
CREDENTIALS_FILE="$HOME/.claude/.credentials.json"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Aktuelle Zeit in Millisekunden
current_time_ms() {
    python3 -c "import time; print(int(time.time() * 1000))"
}

# Token aus Keychain holen
get_keychain_token() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_error "Nur auf macOS verfügbar"
        return 1
    fi

    USERNAME=$(whoami)
    security find-generic-password -s "Claude Code-credentials" -a "$USERNAME" -w 2>/dev/null || echo ""
}

# Token-Ablaufzeit prüfen
check_token_expiry() {
    local creds="$1"
    if [ -z "$creds" ]; then
        return 1
    fi

    local expires_at=$(echo "$creds" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('claudeAiOauth',{}).get('expiresAt',0))" 2>/dev/null || echo "0")
    local current=$(current_time_ms)
    local buffer=300000  # 5 Minuten Puffer

    if [ "$expires_at" -gt "$((current + buffer))" ]; then
        return 0  # Token noch gültig
    else
        return 1  # Token abgelaufen oder bald ablaufend
    fi
}

# OAuth Token mit refreshToken erneuern
refresh_oauth_token() {
    local creds="$1"

    log_info "Versuche Token zu erneuern..."

    # Extrahiere refreshToken
    local refresh_token=$(echo "$creds" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('claudeAiOauth',{}).get('refreshToken',''))" 2>/dev/null)

    if [ -z "$refresh_token" ]; then
        log_error "Kein refreshToken gefunden"
        return 1
    fi

    # Anthropic OAuth Token Refresh Endpoint
    local response=$(curl -s -X POST "https://console.anthropic.com/v1/oauth/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=refresh_token" \
        -d "refresh_token=$refresh_token" \
        -d "client_id=ce95f11c-78a1-421c-b9b5-eb f30a2f6ca2" 2>/dev/null)

    # Prüfe ob Response gültig ist
    if echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'access_token' in d else 1)" 2>/dev/null; then
        # Extrahiere neue Tokens
        local new_access=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['access_token'])")
        local new_refresh=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('refresh_token', ''))")
        local expires_in=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('expires_in', 86400))")

        # Falls kein neuer refresh_token, behalte den alten
        if [ -z "$new_refresh" ]; then
            new_refresh="$refresh_token"
        fi

        # Berechne neues expiresAt
        local new_expires_at=$(($(current_time_ms) + (expires_in * 1000)))

        # Erstelle neues Credentials JSON
        local new_creds=$(python3 -c "
import json
old = json.loads('''$creds''')
oauth = old.get('claudeAiOauth', {})
oauth['accessToken'] = '$new_access'
oauth['refreshToken'] = '$new_refresh'
oauth['expiresAt'] = $new_expires_at
old['claudeAiOauth'] = oauth
print(json.dumps(old))
")

        echo "$new_creds"
        return 0
    else
        log_error "Token-Refresh fehlgeschlagen: $response"
        return 1
    fi
}

# Keychain aktualisieren
update_keychain() {
    local creds="$1"
    local USERNAME=$(whoami)

    # Lösche alten Eintrag
    security delete-generic-password -s "Claude Code-credentials" -a "$USERNAME" 2>/dev/null || true

    # Füge neuen Eintrag hinzu
    security add-generic-password -s "Claude Code-credentials" -a "$USERNAME" -w "$creds"

    log_info "Keychain aktualisiert"
}

# .env Datei aktualisieren
update_env_file() {
    local creds="$1"

    if [ ! -f "$ENV_FILE" ]; then
        log_warn ".env Datei nicht gefunden, erstelle neue"
        touch "$ENV_FILE"
    fi

    # Escape für sed
    local escaped_creds=$(echo "$creds" | sed 's/[&/\]/\\&/g' | tr -d '\n')

    # Entferne alte CLAUDE_OAUTH_CREDENTIALS Zeile falls vorhanden
    if grep -q "^CLAUDE_OAUTH_CREDENTIALS=" "$ENV_FILE" 2>/dev/null; then
        # macOS sed benötigt -i ''
        sed -i '' '/^CLAUDE_OAUTH_CREDENTIALS=/d' "$ENV_FILE"
    fi

    # Füge neue Zeile hinzu
    echo "CLAUDE_OAUTH_CREDENTIALS=$creds" >> "$ENV_FILE"

    log_info ".env aktualisiert"
}

# Hauptlogik
main() {
    log_info "=== Claude OAuth Token Auto-Refresh ==="

    # 1. Hole aktuelle Credentials aus Keychain
    local creds=$(get_keychain_token)

    if [ -z "$creds" ]; then
        log_error "Keine Credentials in Keychain gefunden!"
        log_warn "Bitte führe 'claude /login' aus"
        exit 1
    fi

    # 2. Prüfe ob Token noch gültig
    if check_token_expiry "$creds"; then
        log_info "✅ Token noch gültig"
        # Trotzdem .env aktualisieren für den Container
        update_env_file "$creds"
        exit 0
    fi

    log_warn "⚠️  Token abgelaufen oder bald ablaufend"

    # 3. Versuche Token zu erneuern
    local new_creds=$(refresh_oauth_token "$creds")

    if [ $? -eq 0 ] && [ -n "$new_creds" ]; then
        log_info "✅ Token erfolgreich erneuert!"

        # 4. Keychain aktualisieren
        update_keychain "$new_creds"

        # 5. .env aktualisieren
        update_env_file "$new_creds"

        # 6. Auch credentials.json aktualisieren
        echo "$new_creds" > "$CREDENTIALS_FILE"
        log_info "credentials.json aktualisiert"

        log_info "=== Token-Refresh abgeschlossen ==="
        exit 0
    else
        log_error "Token-Refresh fehlgeschlagen!"
        log_warn "Bitte führe manuell 'claude /login' aus"
        exit 1
    fi
}

main "$@"
