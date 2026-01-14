/**
 * VDB Service - Vector Database Integration für MEGABRAIN
 *
 * Verbindet Automaker mit der Qdrant VDB auf 192.168.10.1:6333
 * für persistentes Wissen, Selbstlernen und KI-gestützte Suche.
 *
 * WICHTIG: VDB ist IMMER auf 192.168.10.1:6333, NIEMALS localhost!
 */

import { createLogger } from '@automaker/utils';

const logger = createLogger('VDBService');

// Konfiguration - NUR 192.168.10.1, NIEMALS localhost!
const QDRANT_URL = process.env.QDRANT_URL || 'http://192.168.10.1:6333';
const COLLECTION_NAME = 'automaker_knowledge';
const EMBEDDING_SIZE = 1536; // OpenAI-kompatibel

// Typen
export interface VDBDocument {
  id: string;
  content: string;
  metadata: {
    type: 'feature' | 'error' | 'solution' | 'learning' | 'code' | 'documentation';
    projectPath?: string;
    featureId?: string;
    timestamp: number;
    tags?: string[];
    source?: string;
  };
  embedding?: number[];
}

export interface VDBSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: VDBDocument['metadata'];
}

export interface VDBStatus {
  connected: boolean;
  url: string;
  collectionExists: boolean;
  documentCount: number;
  lastCheck: Date;
}

/**
 * Prüft ob Qdrant erreichbar ist
 */
async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    logger.error('VDB nicht erreichbar auf', QDRANT_URL);
    return false;
  }
}

/**
 * Erstellt die Automaker-Collection falls nicht vorhanden
 */
async function ensureCollection(): Promise<boolean> {
  try {
    // Prüfe ob Collection existiert
    const checkResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (checkResponse.ok) {
      logger.debug(`Collection ${COLLECTION_NAME} existiert bereits`);
      return true;
    }

    // Erstelle Collection
    const createResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: EMBEDDING_SIZE,
          distance: 'Cosine',
        },
        optimizers_config: {
          indexing_threshold: 10000,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (createResponse.ok) {
      logger.info(`Collection ${COLLECTION_NAME} erstellt`);
      return true;
    }

    logger.error('Collection konnte nicht erstellt werden');
    return false;
  } catch (error) {
    logger.error('Fehler beim Erstellen der Collection:', error);
    return false;
  }
}

/**
 * Generiert ein einfaches Embedding (Fallback ohne ML-Modell)
 * In Produktion sollte dies durch ein echtes Embedding-Modell ersetzt werden
 */
function generateSimpleEmbedding(text: string): number[] {
  // Einfaches Hash-basiertes Embedding als Fallback
  const embedding = new Array(EMBEDDING_SIZE).fill(0);
  const normalized = text.toLowerCase();

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const index = (charCode * (i + 1)) % EMBEDDING_SIZE;
    embedding[index] += 1 / (normalized.length || 1);
  }

  // Normalisieren
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map((val) => val / magnitude);
}

/**
 * Generiert eine UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Speichert ein Dokument in der VDB
 */
export async function storeDocument(doc: Omit<VDBDocument, 'embedding'>): Promise<boolean> {
  try {
    const isConnected = await checkConnection();
    if (!isConnected) {
      logger.error('VDB nicht erreichbar - Dokument kann nicht gespeichert werden');
      return false;
    }

    await ensureCollection();

    const embedding = generateSimpleEmbedding(doc.content);

    // Qdrant benötigt UUID oder Integer als ID
    const pointId = generateUUID();

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [
          {
            id: pointId,
            vector: embedding,
            payload: {
              originalId: doc.id,
              content: doc.content,
              ...doc.metadata,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      logger.info(`Dokument gespeichert: ${doc.id} (Typ: ${doc.metadata.type})`);
      return true;
    }

    logger.error('Fehler beim Speichern:', await response.text());
    return false;
  } catch (error) {
    logger.error('Fehler beim Speichern des Dokuments:', error);
    return false;
  }
}

/**
 * Sucht in der VDB nach ähnlichen Dokumenten
 */
export async function searchDocuments(
  query: string,
  limit = 10,
  filter?: { type?: VDBDocument['metadata']['type']; projectPath?: string }
): Promise<VDBSearchResult[]> {
  try {
    const isConnected = await checkConnection();
    if (!isConnected) {
      logger.warn('VDB nicht erreichbar - Suche nicht möglich');
      return [];
    }

    const embedding = generateSimpleEmbedding(query);

    // Filter erstellen
    const qdrantFilter: Record<string, unknown> = {};
    if (filter) {
      const must: Array<Record<string, unknown>> = [];
      if (filter.type) {
        must.push({ key: 'type', match: { value: filter.type } });
      }
      if (filter.projectPath) {
        must.push({ key: 'projectPath', match: { value: filter.projectPath } });
      }
      if (must.length > 0) {
        qdrantFilter.must = must;
      }
    }

    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: embedding,
        limit,
        with_payload: true,
        filter: Object.keys(qdrantFilter).length > 0 ? qdrantFilter : undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.error('Suchfehler:', await response.text());
      return [];
    }

    const data = (await response.json()) as {
      result: Array<{
        id: string | number;
        score: number;
        payload: {
          content: string;
          type: VDBDocument['metadata']['type'];
          projectPath?: string;
          featureId?: string;
          timestamp: number;
          tags?: string[];
          source?: string;
        };
      }>;
    };

    return data.result.map((item) => ({
      id: String(item.id),
      score: item.score,
      content: item.payload.content,
      metadata: {
        type: item.payload.type,
        projectPath: item.payload.projectPath,
        featureId: item.payload.featureId,
        timestamp: item.payload.timestamp,
        tags: item.payload.tags,
        source: item.payload.source,
      },
    }));
  } catch (error) {
    logger.error('Fehler bei der Suche:', error);
    return [];
  }
}

/**
 * Speichert ein Lernergebnis
 */
export async function storeLearning(
  content: string,
  projectPath?: string,
  featureId?: string,
  tags?: string[]
): Promise<boolean> {
  const doc: Omit<VDBDocument, 'embedding'> = {
    id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    metadata: {
      type: 'learning',
      projectPath,
      featureId,
      timestamp: Date.now(),
      tags,
      source: 'automaker',
    },
  };
  return storeDocument(doc);
}

/**
 * Speichert eine Fehlerlösung
 */
export async function storeErrorSolution(
  errorDescription: string,
  solution: string,
  projectPath?: string,
  featureId?: string
): Promise<boolean> {
  const content = `FEHLER: ${errorDescription}\n\nLÖSUNG: ${solution}`;
  const doc: Omit<VDBDocument, 'embedding'> = {
    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content,
    metadata: {
      type: 'solution',
      projectPath,
      featureId,
      timestamp: Date.now(),
      tags: ['error', 'solution'],
      source: 'automaker',
    },
  };
  return storeDocument(doc);
}

/**
 * Speichert Feature-Wissen
 */
export async function storeFeatureKnowledge(
  featureId: string,
  content: string,
  projectPath: string,
  tags?: string[]
): Promise<boolean> {
  const doc: Omit<VDBDocument, 'embedding'> = {
    id: `feature_${featureId}_${Date.now()}`,
    content,
    metadata: {
      type: 'feature',
      projectPath,
      featureId,
      timestamp: Date.now(),
      tags,
      source: 'automaker',
    },
  };
  return storeDocument(doc);
}

/**
 * Sucht nach ähnlichen Fehlern und deren Lösungen
 */
export async function findSimilarErrors(
  errorDescription: string,
  limit = 5
): Promise<VDBSearchResult[]> {
  return searchDocuments(errorDescription, limit, { type: 'solution' });
}

/**
 * Sucht nach relevantem Wissen für ein Feature
 */
export async function findRelevantKnowledge(
  query: string,
  projectPath?: string,
  limit = 10
): Promise<VDBSearchResult[]> {
  return searchDocuments(query, limit, projectPath ? { projectPath } : undefined);
}

/**
 * Löscht ein Dokument
 */
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: [id],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      logger.info(`Dokument gelöscht: ${id}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Fehler beim Löschen:', error);
    return false;
  }
}

/**
 * Gibt den Status der VDB zurück
 */
export async function getStatus(): Promise<VDBStatus> {
  const connected = await checkConnection();

  let collectionExists = false;
  let documentCount = 0;

  if (connected) {
    try {
      const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        collectionExists = true;
        const data = (await response.json()) as {
          result: { points_count: number };
        };
        documentCount = data.result.points_count || 0;
      }
    } catch {
      // Collection existiert nicht
    }
  }

  return {
    connected,
    url: QDRANT_URL,
    collectionExists,
    documentCount,
    lastCheck: new Date(),
  };
}

/**
 * Health-Check beim Start
 */
export async function healthCheck(): Promise<boolean> {
  logger.info('VDB Health-Check...');
  logger.info(`VDB URL: ${QDRANT_URL}`);

  const connected = await checkConnection();

  if (!connected) {
    logger.error('❌ VDB nicht erreichbar auf', QDRANT_URL);
    logger.error('🚨 KRITISCH: Ohne VDB kein Wissensmanagement möglich!');
    return false;
  }

  logger.info('✅ VDB erreichbar');

  const collectionOk = await ensureCollection();
  if (!collectionOk) {
    logger.warn('⚠️ Collection konnte nicht erstellt werden');
    return false;
  }

  logger.info(`✅ Collection ${COLLECTION_NAME} bereit`);

  // Teste Speichern und Suchen
  const testId = `health_check_${Date.now()}`;
  const testContent = 'VDB Health-Check Test-Dokument';

  const stored = await storeDocument({
    id: testId,
    content: testContent,
    metadata: {
      type: 'documentation',
      timestamp: Date.now(),
      tags: ['health-check', 'test'],
    },
  });

  if (stored) {
    // Aufräumen
    await deleteDocument(testId);
    logger.info('✅ VDB Selbsttest erfolgreich');
    return true;
  }

  logger.error('❌ VDB Selbsttest fehlgeschlagen');
  return false;
}

// Export als Modul
export const VDBService = {
  storeDocument,
  searchDocuments,
  storeLearning,
  storeErrorSolution,
  storeFeatureKnowledge,
  findSimilarErrors,
  findRelevantKnowledge,
  deleteDocument,
  getStatus,
  healthCheck,
  checkConnection,
  ensureCollection,
};

export default VDBService;
