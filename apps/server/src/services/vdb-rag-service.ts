/**
 * VDB RAG Service - Direct Qdrant Integration for Context Enhancement
 *
 * Provides semantic search against MEGABRAIN's VDB to enhance
 * agent prompts with relevant knowledge.
 *
 * Features:
 * - Ollama-basierte Embeddings für bessere semantische Suche
 * - Fallback auf Hash-basierte Embeddings wenn Ollama nicht verfügbar
 * - Automatisches Self-Learning aus erfolgreichen Tasks
 */

import { createLogger } from '@automaker/utils';

const logger = createLogger('VDBRagService');

const QDRANT_URL = 'http://192.168.10.1:6333';
const DEFAULT_COLLECTION = 'megabrain_knowledge';
const VECTOR_DIM = 384;

// Ollama für Embeddings - läuft lokal auf dem Mac
const isContainerized = process.env.IS_CONTAINERIZED === 'true';
const OLLAMA_HOST = isContainerized ? 'host.docker.internal' : 'localhost';
const OLLAMA_URL = `http://${OLLAMA_HOST}:11434`;
const EMBEDDING_MODEL = 'nomic-embed-text'; // Schnelles Embedding-Modell

interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

interface RagContext {
  query: string;
  results: SearchResult[];
  contextText: string;
}

class VDBRagServiceClass {
  private enabled = false;
  private url = QDRANT_URL;
  private collection = DEFAULT_COLLECTION;
  private ollamaAvailable: boolean | null = null;

  /**
   * Initialize service with settings
   */
  configure(settings: { enabled?: boolean; url?: string; collection?: string }) {
    this.enabled = settings.enabled ?? false;
    this.url = settings.url ?? QDRANT_URL;
    this.collection = settings.collection ?? DEFAULT_COLLECTION;
    logger.info(`VDB RAG configured: enabled=${this.enabled}, url=${this.url}`);
    // Prüfe Ollama-Verfügbarkeit beim Konfigurieren
    this.checkOllamaAvailability();
  }

  /**
   * Check if Ollama is available for embeddings
   */
  private async checkOllamaAvailability(): Promise<boolean> {
    if (this.ollamaAvailable !== null) {
      return this.ollamaAvailable;
    }

    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      this.ollamaAvailable = response.ok;
      if (this.ollamaAvailable) {
        logger.info(`✓ Ollama verfügbar auf ${OLLAMA_URL}`);
      }
      return this.ollamaAvailable;
    } catch {
      this.ollamaAvailable = false;
      logger.warn(`⚠️ Ollama nicht verfügbar auf ${OLLAMA_URL} - verwende Fallback-Embeddings`);
      return false;
    }
  }

  /**
   * Generate embedding using Ollama (preferred) or fallback
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const useOllama = await this.checkOllamaAvailability();

    if (useOllama) {
      try {
        const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            prompt: text.slice(0, 8000), // Limit text length
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const data = (await response.json()) as { embedding?: number[] };
          if (data.embedding && data.embedding.length > 0) {
            // Pad or truncate to expected dimension
            const embedding = data.embedding.slice(0, VECTOR_DIM);
            while (embedding.length < VECTOR_DIM) {
              embedding.push(0);
            }
            return embedding;
          }
        }
      } catch (error) {
        logger.warn('Ollama embedding fehlgeschlagen, verwende Fallback:', error);
      }
    }

    // Fallback to simple hash-based embedding
    return this.generateSimpleEmbedding(text);
  }

  /**
   * Check if VDB is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/collections`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available collections
   */
  async getCollections(): Promise<string[]> {
    try {
      const response = await fetch(`${this.url}/collections`);
      if (!response.ok) return [];

      const data = (await response.json()) as {
        result?: { collections?: Array<{ name: string }> };
      };
      return data.result?.collections?.map((c) => c.name) ?? [];
    } catch (error) {
      logger.error('Failed to get collections:', error);
      return [];
    }
  }

  /**
   * Search VDB for relevant context
   * Note: This requires embedding the query first. For now, we use keyword search.
   */
  async searchByKeyword(query: string, collection?: string, limit = 5): Promise<SearchResult[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      // Use scroll with filter for keyword-based search
      const response = await fetch(
        `${this.url}/collections/${collection || this.collection}/points/scroll`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            limit,
            with_payload: true,
            filter: {
              should: [
                {
                  key: 'content',
                  match: { text: query },
                },
                {
                  key: 'title',
                  match: { text: query },
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        logger.warn(`VDB search failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as {
        result?: { points?: Array<{ id: string; payload?: Record<string, unknown> }> };
      };

      return (
        data.result?.points?.map((p) => ({
          id: String(p.id),
          score: 1.0,
          payload: p.payload || {},
        })) ?? []
      );
    } catch (error) {
      logger.error('VDB keyword search failed:', error);
      return [];
    }
  }

  /**
   * Search VDB with vector (requires pre-computed embedding)
   */
  async searchByVector(vector: number[], collection?: string, limit = 5): Promise<SearchResult[]> {
    if (!this.enabled) {
      return [];
    }

    if (vector.length !== VECTOR_DIM) {
      logger.warn(`Invalid vector dimension: ${vector.length}, expected ${VECTOR_DIM}`);
      return [];
    }

    try {
      const response = await fetch(
        `${this.url}/collections/${collection || this.collection}/points/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vector,
            limit,
            with_payload: true,
          }),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as {
        result?: Array<{ id: string; score: number; payload?: Record<string, unknown> }>;
      };

      return (
        data.result?.map((r) => ({
          id: String(r.id),
          score: r.score,
          payload: r.payload || {},
        })) ?? []
      );
    } catch (error) {
      logger.error('VDB vector search failed:', error);
      return [];
    }
  }

  /**
   * Build RAG context from search results
   */
  buildContext(query: string, results: SearchResult[]): RagContext {
    const contextParts: string[] = [];

    for (const result of results) {
      const content = result.payload['content'] as string | undefined;
      const title = result.payload['title'] as string | undefined;

      if (content) {
        if (title) {
          contextParts.push(`### ${title}\n${content}`);
        } else {
          contextParts.push(content);
        }
      }
    }

    return {
      query,
      results,
      contextText:
        contextParts.length > 0
          ? `## Relevanter Kontext aus der Wissensbasis:\n\n${contextParts.join('\n\n---\n\n')}`
          : '',
    };
  }

  /**
   * Enhance a prompt with VDB context
   */
  async enhancePrompt(prompt: string, keywords: string[]): Promise<string> {
    if (!this.enabled) {
      return prompt;
    }

    try {
      // Search for each keyword and combine results
      const allResults: SearchResult[] = [];

      for (const keyword of keywords.slice(0, 3)) {
        const results = await this.searchByKeyword(keyword, undefined, 2);
        allResults.push(...results);
      }

      // Deduplicate by ID
      const uniqueResults = allResults.filter(
        (r, i, arr) => arr.findIndex((x) => x.id === r.id) === i
      );

      if (uniqueResults.length === 0) {
        return prompt;
      }

      const context = this.buildContext(keywords.join(', '), uniqueResults.slice(0, 5));

      if (context.contextText) {
        return `${context.contextText}\n\n---\n\n${prompt}`;
      }

      return prompt;
    } catch (error) {
      logger.error('Failed to enhance prompt:', error);
      return prompt;
    }
  }

  /**
   * Store learning in VDB
   */
  async storeLearning(
    content: string,
    metadata: Record<string, unknown>,
    collection?: string
  ): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      // Einfaches Hash-basiertes Embedding generieren
      const embedding = this.generateSimpleEmbedding(content);
      const pointId = this.generateUUID();
      const targetCollection = collection || this.collection;

      const response = await fetch(`${this.url}/collections/${targetCollection}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [
            {
              id: pointId,
              vector: embedding,
              payload: {
                content,
                type: 'learning',
                timestamp: Date.now(),
                source: 'automaker',
                ...metadata,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        logger.info(`Lernergebnis gespeichert: ${pointId}`);
        return true;
      }

      logger.warn(`Speichern fehlgeschlagen: ${response.status}`);
      return false;
    } catch (error) {
      logger.error('Failed to store learning:', error);
      return false;
    }
  }

  /**
   * Search for expert opinions relevant to the query
   * Experts are stored in collections like 'experts' or 'megabrain_experts'
   */
  async searchExperts(
    query: string,
    limit = 3
  ): Promise<{ expertName: string; expertise: string; opinion: string }[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      // Search in expert-related collections (actual VDB collection names)
      const expertCollections = [
        'megabrain_8_expert_profiles_migrated',
        'megabrain_8_expert_teams',
        'megabrain_5_0_experts_migrated',
        'expert_profiles_compact_5_0_migrated',
      ];
      const results: { expertName: string; expertise: string; opinion: string }[] = [];

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(query);

      for (const collection of expertCollections) {
        try {
          const searchResults = await this.searchByVector(embedding, collection, limit);

          for (const result of searchResults) {
            const expertName = (result.payload['name'] ||
              result.payload['expert_name'] ||
              'Experte') as string;
            const expertise = (result.payload['domain'] ||
              result.payload['expertise'] ||
              'Allgemein') as string;

            // Build opinion from expertise_areas and specializations (actual VDB structure)
            const expertiseAreas = result.payload['expertise_areas'] as string[] | undefined;
            const specializations = result.payload['specializations'] as string[] | undefined;
            const knowledgeLevel = result.payload['knowledge_level'] as number | undefined;
            const content =
              result.payload['content'] || result.payload['knowledge'] || result.payload['opinion'];

            let opinion = '';
            if (content) {
              opinion = String(content);
            } else if (expertiseAreas || specializations) {
              const parts: string[] = [];
              if (expertiseAreas?.length) {
                parts.push(`Expertise: ${expertiseAreas.join(', ')}`);
              }
              if (specializations?.length) {
                parts.push(`Spezialisierungen: ${specializations.join(', ')}`);
              }
              if (knowledgeLevel) {
                parts.push(`Wissenslevel: ${knowledgeLevel}/10`);
              }
              opinion = parts.join('. ');
            }

            if (opinion) {
              results.push({
                expertName,
                expertise,
                opinion: opinion.slice(0, 500), // Limit length
              });
            }
          }
        } catch {
          // Collection might not exist, skip silently
        }
      }

      // Also do keyword search in default collection for expert-type entries
      const keywordResults = await this.searchByKeyword(query, this.collection, limit);
      for (const result of keywordResults) {
        if (result.payload['type'] === 'expert' || result.payload['type'] === 'expert_opinion') {
          const expertName = (result.payload['name'] ||
            result.payload['author'] ||
            'Experte') as string;
          const expertise = (result.payload['expertise'] ||
            result.payload['domain'] ||
            'Allgemein') as string;
          const opinion = (result.payload['content'] || '') as string;

          if (opinion && !results.some((r) => r.opinion === opinion)) {
            results.push({
              expertName,
              expertise,
              opinion: opinion.slice(0, 500),
            });
          }
        }
      }

      return results.slice(0, limit);
    } catch (error) {
      logger.error('Expert search failed:', error);
      return [];
    }
  }

  /**
   * Build expert context for prompt enhancement
   */
  buildExpertContext(
    experts: { expertName: string; expertise: string; opinion: string }[]
  ): string {
    if (experts.length === 0) {
      return '';
    }

    const expertSections = experts.map((expert, index) => {
      return `### Experte ${index + 1}: ${expert.expertName} (${expert.expertise})\n${expert.opinion}`;
    });

    return `## Expertenmeinungen aus der Wissensbasis:\n\n${expertSections.join('\n\n---\n\n')}\n\n---\n\nBerücksichtige diese Expertenmeinungen in deiner Antwort.`;
  }

  /**
   * Store error pattern for future reference
   */
  async storeErrorPattern(
    errorDescription: string,
    solution: string,
    projectPath?: string
  ): Promise<boolean> {
    const content = `FEHLER: ${errorDescription}\n\nLÖSUNG: ${solution}`;
    return this.storeLearning(content, {
      type: 'error_solution',
      errorDescription,
      projectPath,
      tags: ['error', 'solution', 'automaker-learning'],
    });
  }

  /**
   * Generate simple embedding (fallback without ML model)
   */
  private generateSimpleEmbedding(text: string): number[] {
    const embedding = new Array(VECTOR_DIM).fill(0);
    const normalized = text.toLowerCase();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const index = (charCode * (i + 1)) % VECTOR_DIM;
      embedding[index] += 1 / (normalized.length || 1);
    }

    // Normalisieren
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    return embedding.map((val) => val / magnitude);
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Singleton instance
export const VDBRagService = new VDBRagServiceClass();
