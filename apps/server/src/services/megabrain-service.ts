/**
 * MEGABRAIN 8 Integration Service
 *
 * Handles connection to MEGABRAIN 8 server for:
 * - RAG (Retrieval Augmented Generation)
 * - Skills Execution
 * - Advocatus Diaboli Workflow
 */

import { createLogger } from '@automaker/utils';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

const logger = createLogger('MegabrainService');

// MEGABRAIN paths and URLs (Ports 8081/8082 to avoid conflicts with other services)
const MEGABRAIN_PATH = '/Users/chriscrossmedia/Megabrain 8.0';
// MEGABRAIN API läuft auf dem Host-Mac, nicht auf 192.168.10.1
// Im Container: host.docker.internal, sonst: localhost
const isContainerized = process.env.IS_CONTAINERIZED === 'true';
const MEGABRAIN_HOST = isContainerized ? 'host.docker.internal' : 'localhost';
const MEGABRAIN_API_URL = `http://${MEGABRAIN_HOST}:8081`;
const MEGABRAIN_WS_URL = `ws://${MEGABRAIN_HOST}:8082`;
// Qdrant VDB läuft auf dem NAS/Server (192.168.10.1)
const QDRANT_URL = 'http://192.168.10.1:6333';

interface MegabrainSettings {
  enabled: boolean;
  apiUrl: string;
  wsUrl: string;
  ragEnabled: boolean;
  skillsEnabled: boolean;
  advocatusEnabled: boolean;
}

interface MegabrainStatus {
  isRunning: boolean;
  apiAvailable: boolean;
  wsAvailable: boolean;
  vdbAvailable: boolean;
  lastCheck: Date;
}

class MegabrainServiceClass {
  private process: ChildProcess | null = null;
  private status: MegabrainStatus = {
    isRunning: false,
    apiAvailable: false,
    wsAvailable: false,
    vdbAvailable: false,
    lastCheck: new Date(),
  };
  private settings: MegabrainSettings = {
    enabled: false,
    apiUrl: MEGABRAIN_API_URL,
    wsUrl: MEGABRAIN_WS_URL,
    ragEnabled: true,
    skillsEnabled: true,
    advocatusEnabled: true,
  };

  /**
   * Initialize MEGABRAIN service
   */
  async initialize(settings?: Partial<MegabrainSettings>): Promise<boolean> {
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }

    // IMPORTANT: In containerized mode, always use host.docker.internal
    // regardless of what URLs are passed in from settings
    const isContainerized = process.env.IS_CONTAINERIZED === 'true';
    if (isContainerized) {
      this.settings.apiUrl = MEGABRAIN_API_URL; // Uses host.docker.internal
      this.settings.wsUrl = MEGABRAIN_WS_URL;
      logger.info('Container mode: Using host.docker.internal for MEGABRAIN');
    }

    logger.info('Initializing MEGABRAIN 8 service...');
    logger.info(`MEGABRAIN Path: ${MEGABRAIN_PATH}`);
    logger.info(`API URL: ${this.settings.apiUrl}`);
    logger.info(`WebSocket URL: ${this.settings.wsUrl}`);

    // Check if MEGABRAIN is already running
    const isRunning = await this.healthCheck();

    if (isRunning) {
      logger.info('✓ MEGABRAIN 8 is already running');
      this.status.isRunning = true;
      return true;
    }

    // Try to start MEGABRAIN if enabled
    if (this.settings.enabled) {
      return await this.start();
    }

    logger.info('MEGABRAIN 8 not enabled - skipping auto-start');
    return false;
  }

  /**
   * Start MEGABRAIN server
   */
  async start(): Promise<boolean> {
    try {
      // In containerized mode, don't try to start local scripts
      // MEGABRAIN must be started externally on the host
      const isContainerized = process.env.IS_CONTAINERIZED === 'true';

      if (isContainerized) {
        logger.info('Container mode - checking if MEGABRAIN is externally available...');
        const isAvailable = await this.healthCheck();
        if (isAvailable) {
          logger.info('✓ MEGABRAIN 8 is available externally');
          this.status.isRunning = true;
          return true;
        } else {
          logger.warn('MEGABRAIN 8 not available - start it on the host machine');
          return false;
        }
      }

      logger.info('Starting MEGABRAIN 8...');

      // Check if start script exists
      const startScript = path.join(MEGABRAIN_PATH, 'start_megabrain.py');

      // Start MEGABRAIN as background process
      this.process = spawn('python3', [startScript], {
        cwd: MEGABRAIN_PATH,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MEGABRAIN_API_HOST: '192.168.10.1',
          MEGABRAIN_API_PORT: '8081',
          MEGABRAIN_WS_PORT: '8082',
          QDRANT_HOST: '192.168.10.1',
          QDRANT_PORT: '6333',
        },
      });

      this.process.unref();

      // Wait for MEGABRAIN to become available
      const startupTimeout = 30000; // 30 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < startupTimeout) {
        const isRunning = await this.healthCheck();
        if (isRunning) {
          logger.info('✓ MEGABRAIN 8 started successfully');
          this.status.isRunning = true;
          return true;
        }
        await this.sleep(1000);
      }

      logger.warn('⚠️ MEGABRAIN 8 did not become available within timeout');
      return false;
    } catch (error) {
      logger.error('❌ Failed to start MEGABRAIN 8:', error);
      return false;
    }
  }

  /**
   * Stop MEGABRAIN server
   */
  async stop(): Promise<void> {
    if (this.process) {
      logger.info('Stopping MEGABRAIN 8...');
      this.process.kill('SIGTERM');
      this.process = null;
      this.status.isRunning = false;
    }
  }

  /**
   * Health check for MEGABRAIN services
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check API availability - use /health endpoint (no API key required)
      const apiCheck = await this.checkEndpoint(`${this.settings.apiUrl}/health`);
      this.status.apiAvailable = apiCheck;

      // Check VDB availability
      const vdbCheck = await this.checkEndpoint(`${QDRANT_URL}/collections`);
      this.status.vdbAvailable = vdbCheck;

      this.status.lastCheck = new Date();
      this.status.isRunning = apiCheck;

      return apiCheck;
    } catch (error) {
      logger.error('MEGABRAIN health check failed:', error);
      return false;
    }
  }

  /**
   * Check if an endpoint is available
   */
  private async checkEndpoint(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Query MEGABRAIN RAG for context
   */
  async queryRAG(query: string, collection?: string): Promise<string[]> {
    if (!this.settings.enabled || !this.settings.ragEnabled) {
      return [];
    }

    try {
      const response = await fetch(`${this.settings.apiUrl}/api/v1/memory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          collection: collection || 'automaker_knowledge',
          limit: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`RAG query failed: ${response.status}`);
      }

      const data = (await response.json()) as { results?: string[] };
      return data.results || [];
    } catch (error) {
      logger.error('RAG query failed:', error);
      return [];
    }
  }

  /**
   * Execute a MEGABRAIN skill
   */
  async executeSkill(skillName: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.settings.enabled || !this.settings.skillsEnabled) {
      throw new Error('Skills execution is disabled');
    }

    try {
      const response = await fetch(`${this.settings.apiUrl}/api/v1/skills/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: skillName,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`Skill execution failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`Skill execution failed (${skillName}):`, error);
      throw error;
    }
  }

  /**
   * Run Advocatus Diaboli review
   */
  async runAdvocatusReview(
    code: string,
    context?: string
  ): Promise<{
    score: number;
    feedback: string[];
    approved: boolean;
  }> {
    if (!this.settings.enabled || !this.settings.advocatusEnabled) {
      return { score: 100, feedback: [], approved: true };
    }

    try {
      const response = await fetch(`${this.settings.apiUrl}/api/v1/advocatus/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          context,
          require_score: 100,
        }),
      });

      if (!response.ok) {
        throw new Error(`Advocatus review failed: ${response.status}`);
      }

      const result = (await response.json()) as { score?: number; feedback?: string[] };
      return {
        score: result.score || 0,
        feedback: result.feedback || [],
        approved: (result.score || 0) >= 100,
      };
    } catch (error) {
      logger.error('Advocatus review failed:', error);
      return { score: 0, feedback: ['Review failed'], approved: false };
    }
  }

  /**
   * Get current status
   */
  getStatus(): MegabrainStatus {
    return { ...this.status };
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<MegabrainSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): MegabrainSettings {
    return { ...this.settings };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const MegabrainService = new MegabrainServiceClass();
