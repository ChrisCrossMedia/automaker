/**
 * Self-Learning Routes - API für das Selbstlern-System
 *
 * Endpunkte für automatisches Lernen und Wissensabfrage.
 */

import { Router } from 'express';
import { SelfLearningService } from '../../services/self-learning-service.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('SelfLearningRoutes');

export function createSelfLearningRoutes(): Router {
  const router = Router();

  /**
   * GET /api/self-learning/status
   * Gibt den Status des Selbstlern-Systems zurück
   */
  router.get('/status', async (_req, res) => {
    try {
      const status = await SelfLearningService.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Fehler beim Abrufen des Self-Learning Status:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen des Status',
      });
    }
  });

  /**
   * POST /api/self-learning/find-knowledge
   * Sucht nach relevantem Wissen
   */
  router.post('/find-knowledge', async (req, res) => {
    try {
      const { query, projectPath, limit = 5 } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'query ist erforderlich',
        });
        return;
      }

      const results = await SelfLearningService.findRelevantKnowledge(
        query,
        projectPath ? { projectPath, sessionId: '' } : undefined,
        Math.min(limit, 20)
      );

      res.json({
        success: true,
        count: results.length,
        results,
      });
    } catch (error) {
      logger.error('Fehler bei der Wissenssuche:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler bei der Suche',
      });
    }
  });

  /**
   * POST /api/self-learning/find-error-solutions
   * Sucht nach ähnlichen Fehlern und deren Lösungen
   */
  router.post('/find-error-solutions', async (req, res) => {
    try {
      const { errorDescription, limit = 3 } = req.body;

      if (!errorDescription || typeof errorDescription !== 'string') {
        res.status(400).json({
          success: false,
          error: 'errorDescription ist erforderlich',
        });
        return;
      }

      const solutions = await SelfLearningService.findSimilarErrorSolutions(
        errorDescription,
        Math.min(limit, 10)
      );

      res.json({
        success: true,
        count: solutions.length,
        solutions,
      });
    } catch (error) {
      logger.error('Fehler bei der Fehlerlösungssuche:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler bei der Suche',
      });
    }
  });

  /**
   * POST /api/self-learning/learn-error
   * Manuelles Speichern einer Fehlerlösung
   */
  router.post('/learn-error', async (req, res) => {
    try {
      const { error, solution, projectPath, featureId } = req.body;

      if (!error || !solution) {
        res.status(400).json({
          success: false,
          error: 'error und solution sind erforderlich',
        });
        return;
      }

      const result = await SelfLearningService.learnFromError(
        {
          projectPath: projectPath || 'manual',
          featureId,
          sessionId: `manual_${Date.now()}`,
        },
        {
          type: 'error',
          content: error,
          success: false,
          timestamp: Date.now(),
        },
        [
          {
            type: 'message',
            content: solution,
            success: true,
            timestamp: Date.now(),
          },
        ]
      );

      res.json({
        success: result.stored,
        result,
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
   * POST /api/self-learning/learn-success
   * Manuelles Speichern einer Erfolgsstrategie
   */
  router.post('/learn-success', async (req, res) => {
    try {
      const { strategy, outcome, projectPath, featureId } = req.body;

      if (!strategy || !outcome) {
        res.status(400).json({
          success: false,
          error: 'strategy und outcome sind erforderlich',
        });
        return;
      }

      const steps = Array.isArray(strategy)
        ? strategy.map((s: string) => ({
            type: 'message' as const,
            content: s,
            success: true,
            timestamp: Date.now(),
          }))
        : [
            {
              type: 'message' as const,
              content: strategy,
              success: true,
              timestamp: Date.now(),
            },
          ];

      const result = await SelfLearningService.learnFromSuccess(
        {
          projectPath: projectPath || 'manual',
          featureId,
          sessionId: `manual_${Date.now()}`,
        },
        steps,
        outcome
      );

      res.json({
        success: result.stored,
        result,
      });
    } catch (error) {
      logger.error('Fehler beim Speichern der Erfolgsstrategie:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Speichern',
      });
    }
  });

  return router;
}
