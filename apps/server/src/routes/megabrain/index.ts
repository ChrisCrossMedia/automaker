/**
 * MEGABRAIN Proxy Routes
 *
 * Diese Routes agieren als Proxy für MEGABRAIN-Anfragen,
 * um CORS-Probleme in der Electron-App zu umgehen.
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { createLogger } from '@automaker/utils';

const router = Router();
const logger = createLogger('MegabrainProxy');

// MEGABRAIN läuft auf dem Host-Mac
const isContainerized = process.env.IS_CONTAINERIZED === 'true';
const MEGABRAIN_HOST = isContainerized ? 'host.docker.internal' : 'localhost';
const MEGABRAIN_BASE_URL = `http://${MEGABRAIN_HOST}:8081`;
const MEGABRAIN_PATH = '/Users/chriscrossmedia/Megabrain 8.0';
const QDRANT_HOST = '192.168.10.1';
const QDRANT_PORT = 6333;

/**
 * Hilfsfunktion: Prüft ob VDB erreichbar ist
 */
async function checkVdbHealth(): Promise<boolean> {
  try {
    const response = await fetch(`http://${QDRANT_HOST}:${QDRANT_PORT}/collections`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Hilfsfunktion: Prüft ob MEGABRAIN API erreichbar ist
 */
async function checkMegabrainHealth(): Promise<{ running: boolean; details?: unknown }> {
  try {
    const response = await fetch(`${MEGABRAIN_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      return { running: true, details: data };
    }
    return { running: false };
  } catch {
    return { running: false };
  }
}

/**
 * GET /api/megabrain/health - Prüft MEGABRAIN-Verfügbarkeit
 */
router.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${MEGABRAIN_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        status: 'online',
        details: data,
      });
    } else {
      res.json({
        success: false,
        status: 'offline',
        error: `HTTP ${response.status}`,
      });
    }
  } catch (error) {
    logger.error('MEGABRAIN health check failed:', error);
    res.json({
      success: false,
      status: 'offline',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/megabrain/start - Startet MEGABRAIN 8
 */
router.post('/start', async (_req, res) => {
  try {
    // Prüfe ob bereits läuft
    const currentHealth = await checkMegabrainHealth();
    if (currentHealth.running) {
      return res.json({
        success: true,
        status: 'already_running',
        message: 'MEGABRAIN 8 läuft bereits',
        details: currentHealth.details,
      });
    }

    // In Container-Modus können wir MEGABRAIN nicht direkt starten
    if (isContainerized) {
      return res.status(400).json({
        success: false,
        status: 'container_mode',
        message: 'MEGABRAIN muss auf dem Host-System gestartet werden (Container-Modus)',
      });
    }

    // Prüfe ob Pfad existiert
    if (!existsSync(MEGABRAIN_PATH)) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        message: `MEGABRAIN-Pfad nicht gefunden: ${MEGABRAIN_PATH}`,
      });
    }

    // Prüfe ob Startup-Script existiert
    const startupScript = path.join(MEGABRAIN_PATH, 'megabrain8_startup.py');
    if (!existsSync(startupScript)) {
      return res.status(404).json({
        success: false,
        status: 'script_not_found',
        message: `Startup-Script nicht gefunden: ${startupScript}`,
      });
    }

    // Prüfe VDB-Verfügbarkeit
    const vdbAvailable = await checkVdbHealth();

    logger.info('Starting MEGABRAIN 8...');

    // Starte MEGABRAIN im Hintergrund
    const megabrainProcess = spawn('python3', [startupScript], {
      cwd: MEGABRAIN_PATH,
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        MEGABRAIN_INSTANCE_ID: 'automaker',
        MEGABRAIN_INSTANCE_TYPE: 'api',
        PYTHONUNBUFFERED: '1',
      },
    });

    megabrainProcess.unref();

    // Warte auf Start (max 30 Sekunden)
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const health = await checkMegabrainHealth();
      if (health.running) {
        logger.info('MEGABRAIN 8 started successfully');
        return res.json({
          success: true,
          status: 'started',
          message: 'MEGABRAIN 8 erfolgreich gestartet',
          vdb_available: vdbAvailable,
          details: health.details,
        });
      }
    }

    // Timeout
    return res.status(504).json({
      success: false,
      status: 'timeout',
      message: 'MEGABRAIN 8 Start-Timeout nach 30 Sekunden',
      vdb_available: vdbAvailable,
    });
  } catch (error) {
    logger.error('MEGABRAIN start failed:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/megabrain/query - Führt RAG-Suche aus
 */
router.post('/query', async (req, res) => {
  try {
    const { query, collection, limit } = req.body;

    const response = await fetch(`${MEGABRAIN_BASE_URL}/api/v1/memory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, collection, limit }),
      signal: AbortSignal.timeout(30000),
    });

    const data: unknown = await response.json();
    const responseData: Record<string, unknown> =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    res.json({
      success: response.ok,
      ...responseData,
    });
  } catch (error) {
    logger.error('MEGABRAIN query failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/megabrain/skill - Führt MEGABRAIN-Skill aus
 */
router.post('/skill', async (req, res) => {
  try {
    const { skill, params } = req.body;

    const response = await fetch(`${MEGABRAIN_BASE_URL}/api/v1/skills/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill, params }),
      signal: AbortSignal.timeout(60000),
    });

    const data: unknown = await response.json();
    const responseData: Record<string, unknown> =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    res.json({
      success: response.ok,
      ...responseData,
    });
  } catch (error) {
    logger.error('MEGABRAIN skill execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/megabrain/advocatus - Führt Advocatus-Review aus
 */
router.post('/advocatus', async (req, res) => {
  try {
    const { code, context, require_score } = req.body;

    const response = await fetch(`${MEGABRAIN_BASE_URL}/api/v1/advocatus/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, context, require_score }),
      signal: AbortSignal.timeout(120000),
    });

    const data: unknown = await response.json();
    const responseData: Record<string, unknown> =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    res.json({
      success: response.ok,
      ...responseData,
    });
  } catch (error) {
    logger.error('MEGABRAIN advocatus review failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
