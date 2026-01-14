# MEGABRAIN MCP Server

MCP-Server Plugin für die Integration von MEGABRAIN in Automaker.

## Features

- **vdb_search**: Sucht in der MEGABRAIN VDB nach relevantem Wissen
- **vdb_store**: Speichert neues Wissen in der VDB
- **vdb_find_error_solutions**: Findet Lösungen für ähnliche Fehler
- **vdb_store_error_solution**: Speichert Fehlerlösungen für zukünftige Referenz
- **vdb_health**: Prüft den VDB-Verbindungsstatus

## Konfiguration in Automaker

In den Einstellungen unter "MCP-Server" folgenden Server hinzufügen:

```json
{
  "name": "megabrain",
  "type": "stdio",
  "command": "npx",
  "args": ["tsx", "apps/server/src/mcp-servers/megabrain-mcp-server.ts"],
  "enabled": true
}
```

## VDB-Verbindung

**WICHTIG**: Die VDB läuft auf `192.168.10.1:6333` - NIEMALS localhost!

Die Collection `automaker_knowledge` wird automatisch erstellt.

## Selbstlernen

Der MCP-Server ermöglicht automatisches Lernen:

1. Bei Fehlern wird `vdb_find_error_solutions` aufgerufen
2. Nach erfolgreicher Lösung wird `vdb_store_error_solution` verwendet
3. Allgemeines Wissen wird mit `vdb_store` gespeichert

## Entwicklung

```bash
# MCP-Server direkt testen
npx tsx apps/server/src/mcp-servers/megabrain-mcp-server.ts

# VDB-Status prüfen
curl http://192.168.10.1:6333/collections/automaker_knowledge
```
