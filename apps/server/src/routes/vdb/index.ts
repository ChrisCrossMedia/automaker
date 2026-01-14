/**
 * VDB Routes - Vector Database API
 *
 * Endpunkte für MEGABRAIN VDB Integration auf 192.168.10.1:6333
 */

import { Router } from 'express';
import { VDBService } from '../../services/vdb-service.js';
import { VDBRagService } from '../../services/vdb-rag-service.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('VDBRoutes');

export function createVDBRoutes(): Router {
  const router = Router();

  /**
   * GET /api/vdb/collections
   * Liste alle VDB Collections
   */
  router.get('/collections', async (_req, res) => {
    try {
      const collections = await VDBRagService.getCollections();
      res.json({
        success: true,
        count: collections.length,
        collections,
      });
    } catch (error) {
      logger.error('Fehler beim Abrufen der Collections:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen der Collections',
      });
    }
  });

  /**
   * POST /api/vdb/rag/enhance
   * Erweitert einen Prompt mit VDB-Kontext
   */
  router.post('/rag/enhance', async (req, res) => {
    try {
      const { prompt, keywords } = req.body;

      if (!prompt || !keywords || !Array.isArray(keywords)) {
        res.status(400).json({
          success: false,
          error: 'prompt und keywords (Array) sind erforderlich',
        });
        return;
      }

      VDBRagService.configure({ enabled: true });
      const enhancedPrompt = await VDBRagService.enhancePrompt(prompt, keywords);

      res.json({
        success: true,
        originalLength: prompt.length,
        enhancedLength: enhancedPrompt.length,
        enhanced: enhancedPrompt !== prompt,
        prompt: enhancedPrompt,
      });
    } catch (error) {
      logger.error('Fehler bei der Prompt-Erweiterung:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler bei der Prompt-Erweiterung',
      });
    }
  });

  /**
   * GET /api/vdb/status
   * Gibt den aktuellen Status der VDB zurück
   */
  router.get('/status', async (_req, res) => {
    try {
      const status = await VDBService.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Fehler beim Abrufen des VDB Status:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen des Status',
      });
    }
  });

  /**
   * GET /api/vdb/health
   * Führt einen Health-Check durch
   */
  router.get('/health', async (_req, res) => {
    try {
      const healthy = await VDBService.healthCheck();
      res.json({
        success: true,
        healthy,
        message: healthy ? 'VDB funktioniert korrekt' : 'VDB Selbsttest fehlgeschlagen',
      });
    } catch (error) {
      logger.error('VDB Health-Check fehlgeschlagen:', error);
      res.status(500).json({
        success: false,
        healthy: false,
        error: 'Health-Check fehlgeschlagen',
      });
    }
  });

  /**
   * POST /api/vdb/store
   * Speichert ein Dokument in der VDB
   */
  router.post('/store', async (req, res) => {
    try {
      const { content, type, projectPath, featureId, tags } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: 'content ist erforderlich',
        });
        return;
      }

      if (
        !type ||
        !['feature', 'error', 'solution', 'learning', 'code', 'documentation'].includes(type)
      ) {
        res.status(400).json({
          success: false,
          error:
            'Gültiger type ist erforderlich (feature, error, solution, learning, code, documentation)',
        });
        return;
      }

      const stored = await VDBService.storeDocument({
        id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        metadata: {
          type,
          projectPath,
          featureId,
          timestamp: Date.now(),
          tags,
          source: 'automaker-api',
        },
      });

      res.json({
        success: stored,
        message: stored ? 'Dokument gespeichert' : 'Fehler beim Speichern',
      });
    } catch (error) {
      logger.error('Fehler beim Speichern des Dokuments:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Speichern',
      });
    }
  });

  /**
   * POST /api/vdb/search
   * Sucht in der VDB
   */
  router.post('/search', async (req, res) => {
    try {
      const { query, limit = 10, type, projectPath } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'query ist erforderlich',
        });
        return;
      }

      const results = await VDBService.searchDocuments(query, Math.min(limit, 50), {
        type,
        projectPath,
      });

      res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (error) {
      logger.error('Fehler bei der Suche:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler bei der Suche',
      });
    }
  });

  /**
   * POST /api/vdb/learning
   * Speichert ein Lernergebnis
   */
  router.post('/learning', async (req, res) => {
    try {
      const { content, projectPath, featureId, tags } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({
          success: false,
          error: 'content ist erforderlich',
        });
        return;
      }

      const stored = await VDBService.storeLearning(content, projectPath, featureId, tags);

      res.json({
        success: stored,
        message: stored ? 'Lernergebnis gespeichert' : 'Fehler beim Speichern',
      });
    } catch (error) {
      logger.error('Fehler beim Speichern des Lernergebnisses:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Speichern',
      });
    }
  });

  /**
   * POST /api/vdb/error-solution
   * Speichert eine Fehlerlösung
   */
  router.post('/error-solution', async (req, res) => {
    try {
      const { errorDescription, solution, projectPath, featureId } = req.body;

      if (!errorDescription || !solution) {
        res.status(400).json({
          success: false,
          error: 'errorDescription und solution sind erforderlich',
        });
        return;
      }

      const stored = await VDBService.storeErrorSolution(
        errorDescription,
        solution,
        projectPath,
        featureId
      );

      res.json({
        success: stored,
        message: stored ? 'Fehlerlösung gespeichert' : 'Fehler beim Speichern',
      });
    } catch (error) {
      logger.error('Fehler beim Speichern der Fehlerlösung:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Speichern',
      });
    }
  });

  /**
   * POST /api/vdb/find-similar-errors
   * Findet ähnliche Fehler und deren Lösungen
   */
  router.post('/find-similar-errors', async (req, res) => {
    try {
      const { errorDescription, limit = 5 } = req.body;

      if (!errorDescription || typeof errorDescription !== 'string') {
        res.status(400).json({
          success: false,
          error: 'errorDescription ist erforderlich',
        });
        return;
      }

      const results = await VDBService.findSimilarErrors(errorDescription, Math.min(limit, 20));

      res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (error) {
      logger.error('Fehler beim Suchen ähnlicher Fehler:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler bei der Suche',
      });
    }
  });

  /**
   * DELETE /api/vdb/document/:id
   * Löscht ein Dokument
   */
  router.delete('/document/:id', async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'id ist erforderlich',
        });
        return;
      }

      const deleted = await VDBService.deleteDocument(id);

      res.json({
        success: deleted,
        message: deleted ? 'Dokument gelöscht' : 'Fehler beim Löschen',
      });
    } catch (error) {
      logger.error('Fehler beim Löschen des Dokuments:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Löschen',
      });
    }
  });

  return router;
}
