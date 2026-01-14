#!/usr/bin/env node
/**
 * MEGABRAIN MCP Server
 *
 * Ein MCP-Server, der MEGABRAIN-Funktionen für Automaker bereitstellt:
 * - VDB-Suche und Wissensmanagement
 * - Selbstlern-Funktionen
 * - Fehler-Lösungen finden
 *
 * WICHTIG: VDB ist IMMER auf 192.168.10.1:6333, NIEMALS localhost!
 *
 * Verwendung:
 *   npx tsx apps/server/src/mcp-servers/megabrain-mcp-server.ts
 *
 * In MCP-Config:
 *   {
 *     "name": "megabrain",
 *     "type": "stdio",
 *     "command": "npx",
 *     "args": ["tsx", "apps/server/src/mcp-servers/megabrain-mcp-server.ts"]
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// VDB Konfiguration - NUR 192.168.10.1!
const QDRANT_URL = process.env.QDRANT_URL || 'http://192.168.10.1:6333';
const COLLECTION_NAME = 'automaker_knowledge';
const EMBEDDING_SIZE = 1536;

// Einfaches Embedding generieren
function generateEmbedding(text: string): number[] {
  const embedding = new Array(EMBEDDING_SIZE).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const index = (charCode * (i + 1)) % EMBEDDING_SIZE;
    embedding[index] += 1 / (normalized.length || 1);
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map((val) => val / magnitude);
}

// VDB Funktionen
async function searchVDB(
  query: string,
  limit = 10,
  type?: string
): Promise<Array<{ id: string; content: string; score: number; type: string }>> {
  try {
    const embedding = generateEmbedding(query);

    const filter: Record<string, unknown> = {};
    if (type) {
      filter.must = [{ key: 'type', match: { value: type } }];
    }

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: embedding,
        limit,
        with_payload: true,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      }),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      result: Array<{
        id: string | number;
        score: number;
        payload: { content: string; type: string };
      }>;
    };

    return data.result.map((item) => ({
      id: String(item.id),
      content: item.payload.content,
      score: item.score,
      type: item.payload.type,
    }));
  } catch {
    return [];
  }
}

// UUID generieren
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function storeVDB(content: string, type: string, tags?: string[]): Promise<boolean> {
  try {
    const originalId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pointId = generateUUID(); // Qdrant benötigt UUID
    const embedding = generateEmbedding(content);

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: pointId,
            vector: embedding,
            payload: {
              originalId,
              content,
              type,
              timestamp: Date.now(),
              tags,
              source: 'megabrain-mcp',
            },
          },
        ],
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function checkVDBHealth(): Promise<{
  connected: boolean;
  url: string;
  documentCount: number;
}> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'GET',
    });

    if (!response.ok) {
      return { connected: false, url: QDRANT_URL, documentCount: 0 };
    }

    const data = (await response.json()) as { result: { points_count: number } };
    return {
      connected: true,
      url: QDRANT_URL,
      documentCount: data.result.points_count || 0,
    };
  } catch {
    return { connected: false, url: QDRANT_URL, documentCount: 0 };
  }
}

// MCP Server erstellen
const server = new Server(
  {
    name: 'megabrain',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tools auflisten
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'vdb_search',
        description:
          'Sucht in der MEGABRAIN VDB nach relevantem Wissen. Nutze dies um vorhandenes Wissen, Fehlerlösungen und Strategien zu finden.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Suchanfrage - beschreibe was du suchst',
            },
            limit: {
              type: 'number',
              description: 'Maximale Anzahl Ergebnisse (Standard: 10)',
            },
            type: {
              type: 'string',
              enum: ['feature', 'error', 'solution', 'learning', 'code', 'documentation'],
              description: 'Optional: Filtere nach Dokumenttyp',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'vdb_store',
        description:
          'Speichert neues Wissen in der MEGABRAIN VDB. Nutze dies um Lernergebnisse, Fehlerlösungen und nützliche Informationen zu speichern.',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Der zu speichernde Inhalt',
            },
            type: {
              type: 'string',
              enum: ['feature', 'error', 'solution', 'learning', 'code', 'documentation'],
              description: 'Dokumenttyp',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Tags für bessere Auffindbarkeit',
            },
          },
          required: ['content', 'type'],
        },
      },
      {
        name: 'vdb_find_error_solutions',
        description:
          'Findet Lösungen für ähnliche Fehler in der VDB. Nutze dies wenn du auf einen Fehler stößt um von früheren Lösungen zu lernen.',
        inputSchema: {
          type: 'object',
          properties: {
            errorDescription: {
              type: 'string',
              description: 'Beschreibung des Fehlers oder die Fehlermeldung',
            },
            limit: {
              type: 'number',
              description: 'Maximale Anzahl Lösungen (Standard: 5)',
            },
          },
          required: ['errorDescription'],
        },
      },
      {
        name: 'vdb_store_error_solution',
        description:
          'Speichert eine Fehlerlösung für zukünftige Referenz. Nutze dies nachdem du einen Fehler erfolgreich gelöst hast.',
        inputSchema: {
          type: 'object',
          properties: {
            errorDescription: {
              type: 'string',
              description: 'Beschreibung des Fehlers',
            },
            solution: {
              type: 'string',
              description: 'Die Lösung die funktioniert hat',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: Tags (z.B. Programmiersprache, Framework)',
            },
          },
          required: ['errorDescription', 'solution'],
        },
      },
      {
        name: 'vdb_health',
        description: 'Prüft den Status der MEGABRAIN VDB-Verbindung.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool-Aufrufe behandeln
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'vdb_search': {
        const {
          query,
          limit = 10,
          type,
        } = args as {
          query: string;
          limit?: number;
          type?: string;
        };
        const results = await searchVDB(query, limit, type);
        return {
          content: [
            {
              type: 'text',
              text:
                results.length > 0
                  ? `Gefunden: ${results.length} Ergebnisse\n\n${results
                      .map(
                        (r, i) =>
                          `--- Ergebnis ${i + 1} (Score: ${r.score.toFixed(3)}, Typ: ${r.type}) ---\n${r.content.substring(0, 500)}${r.content.length > 500 ? '...' : ''}`
                      )
                      .join('\n\n')}`
                  : 'Keine Ergebnisse gefunden.',
            },
          ],
        };
      }

      case 'vdb_store': {
        const { content, type, tags } = args as {
          content: string;
          type: string;
          tags?: string[];
        };
        const success = await storeVDB(content, type, tags);
        return {
          content: [
            {
              type: 'text',
              text: success
                ? `✅ Wissen gespeichert (Typ: ${type})`
                : '❌ Fehler beim Speichern - VDB möglicherweise nicht erreichbar',
            },
          ],
        };
      }

      case 'vdb_find_error_solutions': {
        const { errorDescription, limit = 5 } = args as {
          errorDescription: string;
          limit?: number;
        };
        const results = await searchVDB(errorDescription, limit, 'solution');
        return {
          content: [
            {
              type: 'text',
              text:
                results.length > 0
                  ? `Gefunden: ${results.length} ähnliche Fehlerlösungen\n\n${results
                      .map(
                        (r, i) =>
                          `--- Lösung ${i + 1} (Ähnlichkeit: ${(r.score * 100).toFixed(1)}%) ---\n${r.content}`
                      )
                      .join('\n\n')}`
                  : 'Keine ähnlichen Fehler in der VDB gefunden. Dies könnte ein neuer Fehlertyp sein.',
            },
          ],
        };
      }

      case 'vdb_store_error_solution': {
        const {
          errorDescription,
          solution,
          tags = [],
        } = args as {
          errorDescription: string;
          solution: string;
          tags?: string[];
        };
        const content = `FEHLER: ${errorDescription}\n\nLÖSUNG: ${solution}`;
        const success = await storeVDB(content, 'solution', ['error', 'solution', ...tags]);
        return {
          content: [
            {
              type: 'text',
              text: success
                ? '✅ Fehlerlösung gespeichert - wird bei ähnlichen Fehlern in Zukunft vorgeschlagen'
                : '❌ Fehler beim Speichern der Lösung',
            },
          ],
        };
      }

      case 'vdb_health': {
        const status = await checkVDBHealth();
        return {
          content: [
            {
              type: 'text',
              text: status.connected
                ? `✅ VDB verbunden\n- URL: ${status.url}\n- Dokumente: ${status.documentCount}`
                : `❌ VDB nicht erreichbar\n- URL: ${status.url}\n\n🚨 KRITISCH: Ohne VDB kein Wissensmanagement möglich!`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unbekanntes Tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Fehler bei ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Server starten
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MEGABRAIN MCP Server gestartet (VDB: 192.168.10.1:6333)');
}

main().catch((error) => {
  console.error('Server-Fehler:', error);
  process.exit(1);
});
