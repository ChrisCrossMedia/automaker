/**
 * MEGABRAIN 8 MCP Server Configuration
 *
 * Alle MCP Server aus MEGABRAIN 8 werden hier definiert und beim Start aktiviert.
 * KRITISCH: Alle Server verwenden 192.168.10.1 - NIEMALS localhost!
 */

import type { MCPServerConfig } from '@automaker/types';

const MEGABRAIN_PATH = '/Users/chriscrossmedia/Megabrain 8.0';
const MCP_SERVERS_PATH = `${MEGABRAIN_PATH}/mcp_servers`;

/**
 * Standard-Umgebungsvariablen für alle MEGABRAIN MCP Server
 */
const MEGABRAIN_ENV: Record<string, string> = {
  QDRANT_HOST: '192.168.10.1',
  QDRANT_PORT: '6333',
  REDIS_HOST: '192.168.10.1',
  REDIS_PORT: '6379',
  MEGABRAIN_API_HOST: '192.168.10.1',
  MEGABRAIN_API_PORT: '8081',
  PYTHONPATH: MEGABRAIN_PATH,
};

/**
 * Alle MEGABRAIN 8 MCP Server Konfigurationen
 */
export const MEGABRAIN_MCP_SERVERS: MCPServerConfig[] = [
  {
    id: 'megabrain-vdb-manager',
    name: 'VDB Manager',
    description: 'Qdrant VDB Management - Collections, Dokumente, Suche',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/vdb_manager_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-backup-manager',
    name: 'Backup Manager',
    description: 'Backup & Restore für VDB, Configs, Daten',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/backup_manager_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-cache-manager',
    name: 'Cache Manager',
    description: 'Redis Cache Management für Performance',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/cache_manager_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-config-manager',
    name: 'Config Manager',
    description: 'Zentrale Konfigurationsverwaltung',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/config_manager_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-crawl4ai',
    name: 'Crawl4AI',
    description: 'Web Crawling und Scraping mit AI',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/crawl4ai_mcp_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-expert-registry',
    name: 'Expert Registry',
    description: 'Verwaltung von Experten-Profilen und -Wissen',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/expert_registry_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-health-monitor',
    name: 'Health Monitor',
    description: 'System-Gesundheitsüberwachung und Alerts',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/health_monitor_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-learning-engine',
    name: 'Learning Engine',
    description: 'Kontinuierliches Lernen aus Interaktionen',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/learning_engine_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-legal-analyzer',
    name: 'Legal Analyzer',
    description: 'Rechtsanalyse und Vertragsauswertung',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/legal_analyzer_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-agents',
    name: 'MEGABRAIN Agents',
    description: 'Orchestrierung der 130+ MEGABRAIN Agents',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/megabrain_agents_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-metrics-collector',
    name: 'Metrics Collector',
    description: 'Sammlung und Analyse von System-Metriken',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/metrics_collector_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-miso-pool',
    name: 'MISO Pool',
    description: 'Parallele Task-Ausführung mit 10 Workern',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/miso_pool_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-observability',
    name: 'Observability',
    description: 'Logging, Tracing, Debugging',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/observability_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-skill-executor',
    name: 'Skill Executor',
    description: 'Ausführung von MEGABRAIN Skills',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/skill_executor_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-task-manager',
    name: 'Task Manager',
    description: 'Task Management und Priorisierung',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/task_manager_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-whisper',
    name: 'Whisper Transcription',
    description: 'Audio-Transkription mit OpenAI Whisper',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/whisper_mcp_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
  {
    id: 'megabrain-workflow-automation',
    name: 'Workflow Automation',
    description: 'Automatisierung von Workflows und Pipelines',
    type: 'stdio',
    command: 'python3',
    args: [`${MCP_SERVERS_PATH}/workflow_automation_server.py`],
    env: MEGABRAIN_ENV,
    enabled: true,
  },
];

/**
 * Gibt alle MEGABRAIN MCP Server zurück
 */
export function getMegabrainMCPServers(): MCPServerConfig[] {
  return MEGABRAIN_MCP_SERVERS;
}

/**
 * Prüft ob ein MCP Server ein MEGABRAIN Server ist
 */
export function isMegabrainMCPServer(serverId: string): boolean {
  return serverId.startsWith('megabrain-');
}

/**
 * Gibt die Anzahl der MEGABRAIN MCP Server zurück
 */
export function getMegabrainMCPServerCount(): number {
  return MEGABRAIN_MCP_SERVERS.length;
}
