/**
 * Privacy Guard Routes
 *
 * Endpunkte für den Privacy Guard Status und Verwaltung.
 */

import { Router } from 'express';
import { PrivacyGuard } from '../../services/privacy-guard-service.js';
import { createLogger } from '@automaker/utils';

const logger = createLogger('PrivacyGuardRoutes');

export function createPrivacyGuardRoutes(): Router {
  const router = Router();

  /**
   * GET /api/privacy-guard/status
   * Gibt den aktuellen Status des Privacy Guard zurück
   */
  router.get('/status', async (_req, res) => {
    try {
      const status = await PrivacyGuard.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Fehler beim Abrufen des Privacy Guard Status:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Abrufen des Status',
      });
    }
  });

  /**
   * GET /api/privacy-guard/health
   * Führt einen Health-Check durch
   */
  router.get('/health', async (_req, res) => {
    try {
      const healthy = await PrivacyGuard.healthCheck();
      res.json({
        success: true,
        healthy,
        message: healthy
          ? 'Privacy Guard funktioniert korrekt'
          : 'Privacy Guard Selbsttest fehlgeschlagen',
      });
    } catch (error) {
      logger.error('Privacy Guard Health-Check fehlgeschlagen:', error);
      res.status(500).json({
        success: false,
        healthy: false,
        error: 'Health-Check fehlgeschlagen',
      });
    }
  });

  /**
   * POST /api/privacy-guard/clear-session
   * Löscht das Mapping einer spezifischen Session
   */
  router.post('/clear-session', (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'sessionId ist erforderlich',
        });
        return;
      }

      PrivacyGuard.clearSession(sessionId);
      res.json({
        success: true,
        message: `Session ${sessionId.substring(0, 8)}... wurde gelöscht`,
      });
    } catch (error) {
      logger.error('Fehler beim Löschen der Session:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Löschen der Session',
      });
    }
  });

  return router;
}
