/**
 * MEGABRAIN MCP Tools - Expose MEGABRAIN Skills as MCP-compatible tools
 *
 * This module provides a bridge between Automaker's MCP system and
 * MEGABRAIN's Skills execution system.
 */

import { createLogger } from '@automaker/utils';
import { MegabrainService } from '../services/megabrain-service.js';
import { VDBRagService } from '../services/vdb-rag-service.js';

const logger = createLogger('MegabrainMCP');

/**
 * Tool definition for MCP compatibility
 */
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

/**
 * Tool execution result
 */
interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Available MEGABRAIN Skills as MCP Tools
 */
export const MEGABRAIN_TOOLS: MCPToolDefinition[] = [
  {
    name: 'megabrain_vdb_search',
    description: 'Search the MEGABRAIN knowledge base (VDB) for relevant information',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        collection: { type: 'string', description: 'VDB collection name (optional)' },
        limit: { type: 'number', description: 'Maximum results (default: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'megabrain_advocatus_review',
    description: 'Run Advocatus Diaboli code review with 100/100 scoring',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to review' },
        context: { type: 'string', description: 'Additional context for review' },
      },
      required: ['code'],
    },
  },
  {
    name: 'megabrain_skill_execute',
    description: 'Execute a MEGABRAIN skill by name',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: 'Skill name (e.g., code_analyzer, test_generator)' },
        params: { type: 'object', description: 'Skill parameters as JSON object' },
      },
      required: ['skill'],
    },
  },
  {
    name: 'megabrain_store_learning',
    description: 'Store a learning/insight in the MEGABRAIN knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Learning content' },
        category: { type: 'string', description: 'Category (code, pattern, error, solution)' },
        tags: { type: 'array', description: 'Tags for categorization' },
      },
      required: ['content'],
    },
  },
  {
    name: 'megabrain_find_similar_errors',
    description: 'Find similar errors and their solutions from the knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        error: { type: 'string', description: 'Error description or message' },
        limit: { type: 'number', description: 'Maximum results (default: 5)' },
      },
      required: ['error'],
    },
  },
];

/**
 * Execute a MEGABRAIN MCP tool
 */
export async function executeMegabrainTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<MCPToolResult> {
  const settings = MegabrainService.getSettings();

  if (!settings.enabled) {
    return {
      success: false,
      error: 'MEGABRAIN is not enabled. Enable it in Settings > MEGABRAIN 8.',
    };
  }

  try {
    switch (toolName) {
      case 'megabrain_vdb_search': {
        if (!settings.ragEnabled) {
          return { success: false, error: 'RAG is disabled in MEGABRAIN settings' };
        }

        const query = params.query as string;
        const collection = params.collection as string | undefined;
        const limit = (params.limit as number) || 5;

        VDBRagService.configure({ enabled: true });
        const results = await VDBRagService.searchByKeyword(query, collection, limit);

        return {
          success: true,
          result: {
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              score: r.score,
              content: r.payload['content'] || r.payload,
            })),
          },
        };
      }

      case 'megabrain_advocatus_review': {
        if (!settings.advocatusEnabled) {
          return { success: false, error: 'Advocatus Diaboli is disabled in MEGABRAIN settings' };
        }

        const code = params.code as string;
        const context = params.context as string | undefined;

        const result = await MegabrainService.runAdvocatusReview(code, context);

        return {
          success: true,
          result: {
            score: result.score,
            approved: result.approved,
            feedback: result.feedback,
          },
        };
      }

      case 'megabrain_skill_execute': {
        if (!settings.skillsEnabled) {
          return { success: false, error: 'Skills execution is disabled in MEGABRAIN settings' };
        }

        const skill = params.skill as string;
        const skillParams = (params.params as Record<string, unknown>) || {};

        const result = await MegabrainService.executeSkill(skill, skillParams);

        return {
          success: true,
          result,
        };
      }

      case 'megabrain_store_learning': {
        const content = params.content as string;
        const category = (params.category as string) || 'learning';
        const tags = (params.tags as string[]) || [];

        const stored = await VDBRagService.storeLearning(content, { category, tags });

        return {
          success: stored,
          result: stored ? 'Learning stored successfully' : 'Failed to store learning',
        };
      }

      case 'megabrain_find_similar_errors': {
        const error = params.error as string;
        const limit = (params.limit as number) || 5;

        VDBRagService.configure({ enabled: true });
        const results = await VDBRagService.searchByKeyword(error, 'error_solutions', limit);

        return {
          success: true,
          result: {
            count: results.length,
            errors: results.map((r) => ({
              id: r.id,
              error: r.payload['error'],
              solution: r.payload['solution'],
              score: r.score,
            })),
          },
        };
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    logger.error(`Tool execution failed (${toolName}):`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all available MEGABRAIN tools
 */
export function getMegabrainTools(): MCPToolDefinition[] {
  return MEGABRAIN_TOOLS;
}

/**
 * Check if MEGABRAIN MCP is available
 */
export function isMegabrainMCPAvailable(): boolean {
  const settings = MegabrainService.getSettings();
  return settings.enabled;
}
