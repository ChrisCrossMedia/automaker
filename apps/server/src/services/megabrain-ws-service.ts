/**
 * MEGABRAIN WebSocket Service - Real-time status updates
 *
 * Provides live updates for:
 * - MEGABRAIN connection status
 * - VDB status and operations
 * - Advocatus review results
 * - Skill execution progress
 */

import { createLogger } from '@automaker/utils';
import type { EventEmitter } from '../lib/events.js';
import { MegabrainService } from './megabrain-service.js';
import { VDBRagService } from './vdb-rag-service.js';

const logger = createLogger('MegabrainWS');

// Check interval in milliseconds
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

interface MegabrainStatusEvent {
  type: 'megabrain_status';
  data: {
    megabrainEnabled: boolean;
    megabrainOnline: boolean;
    vdbOnline: boolean;
    ragEnabled: boolean;
    skillsEnabled: boolean;
    advocatusEnabled: boolean;
    lastCheck: string;
  };
}

interface MegabrainRagEvent {
  type: 'megabrain_rag';
  data: {
    action: 'search' | 'enhance' | 'store';
    query?: string;
    resultsCount?: number;
    enhanced?: boolean;
    success: boolean;
  };
}

interface MegabrainAdvocatusEvent {
  type: 'megabrain_advocatus';
  data: {
    featureId?: string;
    score: number;
    approved: boolean;
    feedback: string[];
  };
}

interface MegabrainSkillEvent {
  type: 'megabrain_skill';
  data: {
    skill: string;
    status: 'started' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
  };
}

type MegabrainEvent =
  | MegabrainStatusEvent
  | MegabrainRagEvent
  | MegabrainAdvocatusEvent
  | MegabrainSkillEvent;

class MegabrainWSServiceClass {
  private events: EventEmitter | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastStatus: MegabrainStatusEvent['data'] | null = null;

  /**
   * Initialize the WebSocket service with event emitter
   */
  initialize(events: EventEmitter): void {
    this.events = events;
    this.startHealthChecks();
    logger.info('MEGABRAIN WebSocket service initialized');
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    logger.info('MEGABRAIN WebSocket service stopped');
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Initial check
    this.checkAndEmitStatus();

    // Periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkAndEmitStatus();
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Check status and emit if changed
   */
  private async checkAndEmitStatus(): Promise<void> {
    const settings = MegabrainService.getSettings();
    const megabrainOnline = await MegabrainService.healthCheck();
    const vdbOnline = await VDBRagService.healthCheck();

    const status: MegabrainStatusEvent['data'] = {
      megabrainEnabled: settings.enabled,
      megabrainOnline,
      vdbOnline,
      ragEnabled: settings.ragEnabled,
      skillsEnabled: settings.skillsEnabled,
      advocatusEnabled: settings.advocatusEnabled,
      lastCheck: new Date().toISOString(),
    };

    // Only emit if status changed
    if (this.hasStatusChanged(status)) {
      this.lastStatus = status;
      this.emit({
        type: 'megabrain_status',
        data: status,
      });
    }
  }

  /**
   * Check if status has changed
   */
  private hasStatusChanged(newStatus: MegabrainStatusEvent['data']): boolean {
    if (!this.lastStatus) return true;

    return (
      this.lastStatus.megabrainEnabled !== newStatus.megabrainEnabled ||
      this.lastStatus.megabrainOnline !== newStatus.megabrainOnline ||
      this.lastStatus.vdbOnline !== newStatus.vdbOnline ||
      this.lastStatus.ragEnabled !== newStatus.ragEnabled ||
      this.lastStatus.skillsEnabled !== newStatus.skillsEnabled ||
      this.lastStatus.advocatusEnabled !== newStatus.advocatusEnabled
    );
  }

  /**
   * Emit RAG event
   */
  emitRagEvent(data: MegabrainRagEvent['data']): void {
    this.emit({
      type: 'megabrain_rag',
      data,
    });
  }

  /**
   * Emit Advocatus review event
   */
  emitAdvocatusEvent(data: MegabrainAdvocatusEvent['data']): void {
    this.emit({
      type: 'megabrain_advocatus',
      data,
    });
  }

  /**
   * Emit skill execution event
   */
  emitSkillEvent(data: MegabrainSkillEvent['data']): void {
    this.emit({
      type: 'megabrain_skill',
      data,
    });
  }

  /**
   * Force status update (e.g., after settings change)
   */
  async forceStatusUpdate(): Promise<void> {
    this.lastStatus = null; // Reset to force emit
    await this.checkAndEmitStatus();
  }

  /**
   * Get current status without emitting
   */
  async getStatus(): Promise<MegabrainStatusEvent['data']> {
    const settings = MegabrainService.getSettings();
    const megabrainOnline = await MegabrainService.healthCheck();
    const vdbOnline = await VDBRagService.healthCheck();

    return {
      megabrainEnabled: settings.enabled,
      megabrainOnline,
      vdbOnline,
      ragEnabled: settings.ragEnabled,
      skillsEnabled: settings.skillsEnabled,
      advocatusEnabled: settings.advocatusEnabled,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Emit event to WebSocket clients
   */
  private emit(event: MegabrainEvent): void {
    if (!this.events) {
      logger.warn('Events not initialized, cannot emit');
      return;
    }

    this.events.emit(event.type, event.data);
    logger.debug(`Emitted ${event.type} event`);
  }
}

// Singleton instance
export const MegabrainWSService = new MegabrainWSServiceClass();
