/**
 * MEGABRAIN Proxy Routes
 *
 * Diese Routes agieren als Proxy für MEGABRAIN-Anfragen,
 * um CORS-Probleme in der Electron-App zu umgehen.
 */

import { Router } from 'express';
import { createLogger } from '@automaker/utils';

const router = Router();
const logger = createLogger('MegabrainProxy');

// MEGABRAIN läuft auf dem Host-Mac
const isContainerized = process.env.IS_CONTAINERIZED === 'true';
const MEGABRAIN_HOST = isContainerized ? 'host.docker.internal' : 'localhost';
const MEGABRAIN_BASE_URL = `http://${MEGABRAIN_HOST}:8081`;

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
