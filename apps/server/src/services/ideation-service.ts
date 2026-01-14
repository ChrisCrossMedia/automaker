/**
 * Ideation Service - Manages brainstorming sessions and ideas
 * Provides AI-powered ideation, project analysis, and idea-to-feature conversion
 */

import path from 'path';
import * as secureFs from '../lib/secure-fs.js';
import type { EventEmitter } from '../lib/events.js';
import type { Feature, ExecuteOptions } from '@automaker/types';
import type {
  Idea,
  IdeaCategory,
  IdeaStatus,
  IdeationSession,
  IdeationSessionWithMessages,
  IdeationMessage,
  ProjectAnalysisResult,
  AnalysisSuggestion,
  AnalysisFileInfo,
  CreateIdeaInput,
  UpdateIdeaInput,
  StartSessionOptions,
  SendMessageOptions,
  PromptCategory,
  IdeationPrompt,
} from '@automaker/types';
import {
  getIdeationDir,
  getIdeasDir,
  getIdeaDir,
  getIdeaPath,
  getIdeationSessionsDir,
  getIdeationSessionPath,
  getIdeationAnalysisPath,
  ensureIdeationDir,
} from '@automaker/platform';
import { createLogger, loadContextFiles, isAbortError } from '@automaker/utils';
import { ProviderFactory } from '../providers/provider-factory.js';
import type { SettingsService } from './settings-service.js';
import type { FeatureLoader } from './feature-loader.js';
import { createChatOptions, validateWorkingDirectory } from '../lib/sdk-options.js';
import { resolveModelString } from '@automaker/model-resolver';
import { stripProviderPrefix } from '@automaker/types';

const logger = createLogger('IdeationService');

interface ActiveSession {
  session: IdeationSession;
  messages: IdeationMessage[];
  isRunning: boolean;
  abortController: AbortController | null;
}

export class IdeationService {
  private activeSessions = new Map<string, ActiveSession>();
  private events: EventEmitter;
  private settingsService: SettingsService | null = null;
  private featureLoader: FeatureLoader | null = null;

  constructor(
    events: EventEmitter,
    settingsService?: SettingsService,
    featureLoader?: FeatureLoader
  ) {
    this.events = events;
    this.settingsService = settingsService ?? null;
    this.featureLoader = featureLoader ?? null;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Start a new ideation session
   */
  async startSession(projectPath: string, options?: StartSessionOptions): Promise<IdeationSession> {
    validateWorkingDirectory(projectPath);
    await ensureIdeationDir(projectPath);

    const sessionId = this.generateId('session');
    const now = new Date().toISOString();

    const session: IdeationSession = {
      id: sessionId,
      projectPath,
      promptCategory: options?.promptCategory,
      promptId: options?.promptId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const activeSession: ActiveSession = {
      session,
      messages: [],
      isRunning: false,
      abortController: null,
    };

    this.activeSessions.set(sessionId, activeSession);
    await this.saveSessionToDisk(projectPath, session, []);

    this.events.emit('ideation:session-started', { sessionId, projectPath });

    // If there's an initial message from a prompt, send it
    if (options?.initialMessage) {
      await this.sendMessage(sessionId, options.initialMessage);
    }

    return session;
  }

  /**
   * Get an existing session
   */
  async getSession(
    projectPath: string,
    sessionId: string
  ): Promise<IdeationSessionWithMessages | null> {
    // Check if session is already active in memory
    let activeSession = this.activeSessions.get(sessionId);

    if (!activeSession) {
      // Try to load from disk
      const loaded = await this.loadSessionFromDisk(projectPath, sessionId);
      if (!loaded) return null;

      activeSession = {
        session: loaded.session,
        messages: loaded.messages,
        isRunning: false,
        abortController: null,
      };
      this.activeSessions.set(sessionId, activeSession);
    }

    return {
      ...activeSession.session,
      messages: activeSession.messages,
    };
  }

  /**
   * Send a message in an ideation session
   */
  async sendMessage(
    sessionId: string,
    message: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (activeSession.isRunning) {
      throw new Error('Session is already processing a message');
    }

    activeSession.isRunning = true;
    activeSession.abortController = new AbortController();

    // Add user message
    const userMessage: IdeationMessage = {
      id: this.generateId('msg'),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    activeSession.messages.push(userMessage);

    // Emit user message
    this.events.emit('ideation:stream', {
      sessionId,
      type: 'message',
      message: userMessage,
    });

    try {
      const projectPath = activeSession.session.projectPath;

      // Build conversation history
      const conversationHistory = activeSession.messages.slice(0, -1).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Load context files
      const contextResult = await loadContextFiles({
        projectPath,
        fsModule: secureFs as Parameters<typeof loadContextFiles>[0]['fsModule'],
      });

      // Gather existing features and ideas to prevent duplicate suggestions
      const existingWorkContext = await this.gatherExistingWorkContext(projectPath);

      // Build system prompt for ideation
      const systemPrompt = this.buildIdeationSystemPrompt(
        contextResult.formattedPrompt,
        activeSession.session.promptCategory,
        existingWorkContext
      );

      // Resolve model alias to canonical identifier (with prefix)
      const modelId = resolveModelString(options?.model ?? 'sonnet');

      // Create SDK options
      const sdkOptions = createChatOptions({
        cwd: projectPath,
        model: modelId,
        systemPrompt,
        abortController: activeSession.abortController!,
      });

      const provider = ProviderFactory.getProviderForModel(modelId);

      // Strip provider prefix - providers need bare model IDs
      const bareModel = stripProviderPrefix(modelId);

      const executeOptions: ExecuteOptions = {
        prompt: message,
        model: bareModel,
        originalModel: modelId,
        cwd: projectPath,
        systemPrompt: sdkOptions.systemPrompt,
        maxTurns: 1, // Single turn for ideation
        abortController: activeSession.abortController!,
        conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
      };

      const stream = provider.executeQuery(executeOptions);

      let responseText = '';
      const assistantMessage: IdeationMessage = {
        id: this.generateId('msg'),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };

      for await (const msg of stream) {
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
              assistantMessage.content = responseText;

              this.events.emit('ideation:stream', {
                sessionId,
                type: 'stream',
                content: responseText,
                done: false,
              });
            }
          }
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success' && msg.result) {
            assistantMessage.content = msg.result;
            responseText = msg.result;
          }
        }
      }

      activeSession.messages.push(assistantMessage);

      this.events.emit('ideation:stream', {
        sessionId,
        type: 'message-complete',
        message: assistantMessage,
        content: responseText,
        done: true,
      });

      // Save session
      await this.saveSessionToDisk(projectPath, activeSession.session, activeSession.messages);
    } catch (error) {
      if (isAbortError(error)) {
        this.events.emit('ideation:stream', {
          sessionId,
          type: 'aborted',
        });
      } else {
        logger.error('Error in ideation message:', error);
        this.events.emit('ideation:stream', {
          sessionId,
          type: 'error',
          error: (error as Error).message,
        });
      }
    } finally {
      activeSession.isRunning = false;
      activeSession.abortController = null;
    }
  }

  /**
   * Stop an active session
   */
  async stopSession(sessionId: string): Promise<void> {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) return;

    if (activeSession.abortController) {
      activeSession.abortController.abort();
    }

    activeSession.isRunning = false;
    activeSession.abortController = null;
    activeSession.session.status = 'completed';

    await this.saveSessionToDisk(
      activeSession.session.projectPath,
      activeSession.session,
      activeSession.messages
    );

    this.events.emit('ideation:session-ended', { sessionId });
  }

  // ============================================================================
  // Ideas CRUD
  // ============================================================================

  /**
   * Create a new idea
   */
  async createIdea(projectPath: string, input: CreateIdeaInput): Promise<Idea> {
    validateWorkingDirectory(projectPath);
    await ensureIdeationDir(projectPath);

    const ideaId = this.generateId('idea');
    const now = new Date().toISOString();

    const idea: Idea = {
      id: ideaId,
      title: input.title,
      description: input.description,
      category: input.category,
      status: input.status || 'raw',
      impact: input.impact || 'medium',
      effort: input.effort || 'medium',
      conversationId: input.conversationId,
      sourcePromptId: input.sourcePromptId,
      userStories: input.userStories,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    // Save to disk
    const ideaDir = getIdeaDir(projectPath, ideaId);
    await secureFs.mkdir(ideaDir, { recursive: true });
    await secureFs.writeFile(
      getIdeaPath(projectPath, ideaId),
      JSON.stringify(idea, null, 2),
      'utf-8'
    );

    return idea;
  }

  /**
   * Get all ideas for a project
   */
  async getIdeas(projectPath: string): Promise<Idea[]> {
    try {
      const ideasDir = getIdeasDir(projectPath);

      try {
        await secureFs.access(ideasDir);
      } catch {
        return [];
      }

      const entries = (await secureFs.readdir(ideasDir, { withFileTypes: true })) as any[];
      const ideaDirs = entries.filter((entry) => entry.isDirectory());

      const ideas: Idea[] = [];
      for (const dir of ideaDirs) {
        try {
          const ideaPath = getIdeaPath(projectPath, dir.name);
          const content = (await secureFs.readFile(ideaPath, 'utf-8')) as string;
          ideas.push(JSON.parse(content));
        } catch (error) {
          logger.warn(`Failed to load idea ${dir.name}:`, error);
        }
      }

      // Sort by updatedAt descending
      return ideas.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      logger.error('Failed to get ideas:', error);
      return [];
    }
  }

  /**
   * Get a single idea
   */
  async getIdea(projectPath: string, ideaId: string): Promise<Idea | null> {
    try {
      const ideaPath = getIdeaPath(projectPath, ideaId);
      const content = (await secureFs.readFile(ideaPath, 'utf-8')) as string;
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Update an idea
   */
  async updateIdea(
    projectPath: string,
    ideaId: string,
    updates: UpdateIdeaInput
  ): Promise<Idea | null> {
    const idea = await this.getIdea(projectPath, ideaId);
    if (!idea) return null;

    const updatedIdea: Idea = {
      ...idea,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await secureFs.writeFile(
      getIdeaPath(projectPath, ideaId),
      JSON.stringify(updatedIdea, null, 2),
      'utf-8'
    );

    return updatedIdea;
  }

  /**
   * Delete an idea
   */
  async deleteIdea(projectPath: string, ideaId: string): Promise<void> {
    const ideaDir = getIdeaDir(projectPath, ideaId);
    try {
      await secureFs.rm(ideaDir, { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }
  }

  /**
   * Archive an idea
   */
  async archiveIdea(projectPath: string, ideaId: string): Promise<Idea | null> {
    return this.updateIdea(projectPath, ideaId, {
      status: 'archived' as IdeaStatus,
    });
  }

  // ============================================================================
  // Project Analysis
  // ============================================================================

  /**
   * Analyze project structure and generate suggestions
   */
  async analyzeProject(projectPath: string): Promise<ProjectAnalysisResult> {
    validateWorkingDirectory(projectPath);
    await ensureIdeationDir(projectPath);

    this.emitAnalysisEvent('ideation:analysis-started', {
      projectPath,
      message: 'Starting project analysis...',
    });

    try {
      // Gather project structure
      const structure = await this.gatherProjectStructure(projectPath);

      this.emitAnalysisEvent('ideation:analysis-progress', {
        projectPath,
        progress: 30,
        message: 'Analyzing codebase structure...',
      });

      // Use AI to generate suggestions
      const suggestions = await this.generateAnalysisSuggestions(projectPath, structure);

      this.emitAnalysisEvent('ideation:analysis-progress', {
        projectPath,
        progress: 80,
        message: 'Generating improvement suggestions...',
      });

      const result: ProjectAnalysisResult = {
        projectPath,
        analyzedAt: new Date().toISOString(),
        totalFiles: structure.totalFiles,
        routes: structure.routes,
        components: structure.components,
        services: structure.services,
        framework: structure.framework,
        language: structure.language,
        dependencies: structure.dependencies,
        suggestions,
        summary: this.generateAnalysisSummary(structure, suggestions),
      };

      // Cache the result
      await secureFs.writeFile(
        getIdeationAnalysisPath(projectPath),
        JSON.stringify(result, null, 2),
        'utf-8'
      );

      this.emitAnalysisEvent('ideation:analysis-complete', {
        projectPath,
        result,
      });

      return result;
    } catch (error) {
      logger.error('Project analysis failed:', error);
      this.emitAnalysisEvent('ideation:analysis-error', {
        projectPath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Emit analysis event wrapped in ideation:analysis format
   */
  private emitAnalysisEvent(eventType: string, data: Record<string, unknown>): void {
    this.events.emit('ideation:analysis', {
      type: eventType,
      ...data,
    });
  }

  /**
   * Check if a session is currently running (processing a message)
   */
  isSessionRunning(sessionId: string): boolean {
    const activeSession = this.activeSessions.get(sessionId);
    return activeSession?.isRunning ?? false;
  }

  /**
   * Get cached analysis result
   */
  async getCachedAnalysis(projectPath: string): Promise<ProjectAnalysisResult | null> {
    try {
      const content = (await secureFs.readFile(
        getIdeationAnalysisPath(projectPath),
        'utf-8'
      )) as string;
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Convert to Feature
  // ============================================================================

  /**
   * Convert an idea to a feature
   */
  async convertToFeature(projectPath: string, ideaId: string): Promise<Feature> {
    const idea = await this.getIdea(projectPath, ideaId);
    if (!idea) {
      throw new Error(`Idea ${ideaId} not found`);
    }

    // Build feature description from idea
    let description = idea.description;
    if (idea.userStories && idea.userStories.length > 0) {
      description += '\n\n## User Stories\n' + idea.userStories.map((s) => `- ${s}`).join('\n');
    }
    if (idea.notes) {
      description += '\n\n## Notes\n' + idea.notes;
    }

    const feature: Feature = {
      id: this.generateId('feature'),
      title: idea.title,
      category: this.mapIdeaCategoryToFeatureCategory(idea.category),
      description,
      status: 'backlog',
    };

    return feature;
  }

  // ============================================================================
  // Generate Suggestions
  // ============================================================================

  /**
   * Generate structured suggestions for a prompt
   * Returns parsed suggestions that can be directly added to the board
   */
  async generateSuggestions(
    projectPath: string,
    promptId: string,
    category: IdeaCategory,
    count: number = 10
  ): Promise<AnalysisSuggestion[]> {
    validateWorkingDirectory(projectPath);

    // Get the prompt
    const prompt = this.getAllPrompts().find((p) => p.id === promptId);
    if (!prompt) {
      throw new Error(`Prompt ${promptId} not found`);
    }

    // Emit start event
    this.events.emit('ideation:suggestions', {
      type: 'started',
      promptId,
      category,
    });

    try {
      // Load context files
      const contextResult = await loadContextFiles({
        projectPath,
        fsModule: secureFs as Parameters<typeof loadContextFiles>[0]['fsModule'],
      });

      // Build context from multiple sources
      let contextPrompt = contextResult.formattedPrompt;

      // If no context files, try to gather basic project info
      if (!contextPrompt) {
        const projectInfo = await this.gatherBasicProjectInfo(projectPath);
        if (projectInfo) {
          contextPrompt = projectInfo;
        }
      }

      // Gather existing features and ideas to prevent duplicates
      const existingWorkContext = await this.gatherExistingWorkContext(projectPath);

      // Build system prompt for structured suggestions
      const systemPrompt = this.buildSuggestionsSystemPrompt(
        contextPrompt,
        category,
        count,
        existingWorkContext
      );

      // Resolve model alias to canonical identifier (with prefix)
      const modelId = resolveModelString('sonnet');

      // Create SDK options
      const sdkOptions = createChatOptions({
        cwd: projectPath,
        model: modelId,
        systemPrompt,
        abortController: new AbortController(),
      });

      const provider = ProviderFactory.getProviderForModel(modelId);

      // Strip provider prefix - providers need bare model IDs
      const bareModel = stripProviderPrefix(modelId);

      const executeOptions: ExecuteOptions = {
        prompt: prompt.prompt,
        model: bareModel,
        originalModel: modelId,
        cwd: projectPath,
        systemPrompt: sdkOptions.systemPrompt,
        maxTurns: 1,
        // Disable all tools - we just want text generation, not codebase analysis
        allowedTools: [],
        abortController: new AbortController(),
      };

      const stream = provider.executeQuery(executeOptions);

      let responseText = '';
      for await (const msg of stream) {
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        } else if (msg.type === 'result' && msg.subtype === 'success' && msg.result) {
          responseText = msg.result;
        }
      }

      // Parse the response into structured suggestions
      const suggestions = this.parseSuggestionsFromResponse(responseText, category);

      // Emit complete event
      this.events.emit('ideation:suggestions', {
        type: 'complete',
        promptId,
        category,
        suggestions,
      });

      return suggestions;
    } catch (error) {
      logger.error('Failed to generate suggestions:', error);
      this.events.emit('ideation:suggestions', {
        type: 'error',
        promptId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Build system prompt for structured suggestion generation
   */
  private buildSuggestionsSystemPrompt(
    contextFilesPrompt: string | undefined,
    category: IdeaCategory,
    count: number = 10,
    existingWorkContext?: string
  ): string {
    const contextSection = contextFilesPrompt
      ? `## Projektkontext\n${contextFilesPrompt}`
      : `## Kein Projektkontext verfügbar\nKeine Kontextdateien wurden gefunden. Generiere Vorschläge basierend auf dem Prompt des Nutzers und allgemeinen Best Practices für die beschriebene Art von Anwendung.`;

    const existingWorkSection = existingWorkContext ? `\n\n${existingWorkContext}` : '';

    return `Du bist ein KI-Produktstratege, der beim Brainstorming von Feature-Ideen für ein Softwareprojekt hilft.

WICHTIG: Du hast KEINEN Zugriff auf Tools. Du KANNST NICHT Dateien lesen, Code durchsuchen oder Befehle ausführen.
Du musst Vorschläge NUR basierend auf dem unten bereitgestellten Projektkontext generieren.
Sage NICHT "Ich werde analysieren" oder "Lass mich erkunden" - das kannst du nicht.

Basierend auf dem Projektkontext und dem Prompt des Nutzers, generiere genau ${count} kreative und umsetzbare Feature-Vorschläge.

DEINE ANTWORT MUSS AUF DEUTSCH SEIN und NUR ein JSON-Array enthalten - nichts anderes. Keine Erklärung, keine Einleitung, keine Markdown-Code-Blöcke.

Jeder Vorschlag muss diese Struktur haben:
{
  "title": "Kurzer, umsetzbarer Titel (max 60 Zeichen, auf Deutsch)",
  "description": "Klare Beschreibung dessen, was gebaut oder verbessert werden soll (2-3 Sätze, auf Deutsch)",
  "rationale": "Warum dies wertvoll ist - das Problem, das es löst, oder die Chance, die es schafft (auf Deutsch)",
  "priority": "high" | "medium" | "low"
}

Fokusbereich: ${this.getCategoryDescription(category)}

Richtlinien:
- Generiere genau ${count} Vorschläge
- Sei spezifisch und umsetzbar - vermeide vage Ideen
- Mische verschiedene Prioritätsstufen (einige high, einige medium, einige low)
- Jeder Vorschlag sollte unabhängig implementierbar sein
- Denke kreativ - füge sowohl offensichtliche Verbesserungen als auch innovative Ideen hinzu
- Berücksichtige die Domäne und Zielnutzer des Projekts
- WICHTIG: Schlage KEINE Features oder Ideen vor, die bereits in den Abschnitten "Bestehende Features" oder "Bestehende Ideen" unten existieren
- ALLE Texte (title, description, rationale) MÜSSEN auf Deutsch sein!

${contextSection}${existingWorkSection}`;
  }

  /**
   * Parse AI response into structured suggestions
   */
  private parseSuggestionsFromResponse(
    response: string,
    category: IdeaCategory
  ): AnalysisSuggestion[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No JSON array found in response, falling back to text parsing');
        return this.parseTextResponse(response, category);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return this.parseTextResponse(response, category);
      }

      return parsed.map((item: any, index: number) => ({
        id: this.generateId('sug'),
        category,
        title: item.title || `Suggestion ${index + 1}`,
        description: item.description || '',
        rationale: item.rationale || '',
        priority: item.priority || 'medium',
        relatedFiles: item.relatedFiles || [],
      }));
    } catch (error) {
      logger.warn('Failed to parse JSON response:', error);
      return this.parseTextResponse(response, category);
    }
  }

  /**
   * Fallback: parse text response into suggestions
   */
  private parseTextResponse(response: string, category: IdeaCategory): AnalysisSuggestion[] {
    const suggestions: AnalysisSuggestion[] = [];

    // Try to find numbered items or headers
    const lines = response.split('\n');
    let currentSuggestion: Partial<AnalysisSuggestion> | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Check for numbered items or markdown headers
      const titleMatch = line.match(/^(?:\d+[\.\)]\s*\*{0,2}|#{1,3}\s+)(.+)/);

      if (titleMatch) {
        // Save previous suggestion
        if (currentSuggestion && currentSuggestion.title) {
          suggestions.push({
            id: this.generateId('sug'),
            category,
            title: currentSuggestion.title,
            description: currentContent.join(' ').trim() || currentSuggestion.title,
            rationale: '',
            priority: 'medium',
            ...currentSuggestion,
          } as AnalysisSuggestion);
        }

        // Start new suggestion
        currentSuggestion = {
          title: titleMatch[1].replace(/\*{1,2}/g, '').trim(),
        };
        currentContent = [];
      } else if (currentSuggestion && line.trim()) {
        currentContent.push(line.trim());
      }
    }

    // Don't forget the last suggestion
    if (currentSuggestion && currentSuggestion.title) {
      suggestions.push({
        id: this.generateId('sug'),
        category,
        title: currentSuggestion.title,
        description: currentContent.join(' ').trim() || currentSuggestion.title,
        rationale: '',
        priority: 'medium',
      } as AnalysisSuggestion);
    }

    // If no suggestions found, create one from the whole response
    if (suggestions.length === 0 && response.trim()) {
      suggestions.push({
        id: this.generateId('sug'),
        category,
        title: 'AI Suggestion',
        description: response.slice(0, 500),
        rationale: '',
        priority: 'medium',
      });
    }

    return suggestions.slice(0, 5); // Max 5 suggestions
  }

  // ============================================================================
  // Guided Prompts
  // ============================================================================

  /**
   * Get all prompt categories
   */
  getPromptCategories(): PromptCategory[] {
    return [
      {
        id: 'feature',
        name: 'Features',
        icon: 'Zap',
        description: 'Neue Funktionen und Fähigkeiten',
      },
      {
        id: 'ux-ui',
        name: 'UX/UI',
        icon: 'Palette',
        description: 'Design- und Benutzererfahrungsverbesserungen',
      },
      {
        id: 'dx',
        name: 'Entwicklererfahrung',
        icon: 'Code',
        description: 'Entwickler-Tools und Workflows',
      },
      {
        id: 'growth',
        name: 'Wachstum',
        icon: 'TrendingUp',
        description: 'Nutzerengagement und -bindung',
      },
      {
        id: 'technical',
        name: 'Technik',
        icon: 'Cpu',
        description: 'Architektur und Infrastruktur',
      },
      {
        id: 'security',
        name: 'Sicherheit',
        icon: 'Shield',
        description: 'Sicherheitsverbesserungen und Schwachstellenbehebung',
      },
      {
        id: 'performance',
        name: 'Performance',
        icon: 'Gauge',
        description: 'Leistungsoptimierung und Geschwindigkeitsverbesserungen',
      },
      {
        id: 'accessibility',
        name: 'Barrierefreiheit',
        icon: 'Accessibility',
        description: 'Barrierefreiheit und inklusives Design',
      },
      {
        id: 'analytics',
        name: 'Analytik',
        icon: 'BarChart',
        description: 'Analytik, Monitoring und Insights',
      },
    ];
  }

  /**
   * Get prompts for a specific category
   */
  getPromptsByCategory(category: IdeaCategory): IdeationPrompt[] {
    const allPrompts = this.getAllPrompts();
    return allPrompts.filter((p) => p.category === category);
  }

  /**
   * Get all guided prompts
   * This is the single source of truth for guided prompts data.
   * Frontend fetches this data via /api/ideation/prompts endpoint.
   */
  getAllPrompts(): IdeationPrompt[] {
    return [
      // Feature-Prompts
      {
        id: 'feature-missing',
        category: 'feature',
        title: 'Fehlende Features',
        description: 'Entdecke Features, die Nutzer erwarten könnten',
        prompt:
          'Basierend auf dem Projektkontext, identifiziere Features, die Nutzer ähnlicher Anwendungen typischerweise erwarten, aber fehlen könnten. Berücksichtige die App-Domäne, Zielnutzer und gängige Muster in ähnlichen Produkten.',
      },
      {
        id: 'feature-automation',
        category: 'feature',
        title: 'Automatisierungsmöglichkeiten',
        description: 'Finde manuelle Prozesse, die automatisiert werden könnten',
        prompt:
          'Basierend auf dem Projektkontext, identifiziere manuelle Prozesse oder repetitive Aufgaben, die automatisiert werden könnten. Suche nach Mustern, wo Nutzer Dinge wiederholt tun, die Software übernehmen könnte.',
      },
      {
        id: 'feature-integrations',
        category: 'feature',
        title: 'Integrations-Ideen',
        description: 'Identifiziere wertvolle Drittanbieter-Integrationen',
        prompt:
          'Basierend auf dem Projektkontext, welche Drittanbieter-Services oder APIs würden Mehrwert bieten, wenn sie integriert wären? Berücksichtige die App-Domäne und welche ergänzenden Services Nutzer benötigen könnten.',
      },
      {
        id: 'feature-workflow',
        category: 'feature',
        title: 'Workflow-Verbesserungen',
        description: 'Optimiere Nutzer-Workflows',
        prompt:
          'Basierend auf dem Projektkontext, analysiere die Nutzer-Workflows. Welche Schritte könnten kombiniert, eliminiert oder automatisiert werden? Wo verbringen Nutzer wahrscheinlich zu viel Zeit mit repetitiven Aufgaben?',
      },

      // UX/UI-Prompts
      {
        id: 'ux-friction',
        category: 'ux-ui',
        title: 'Reibungspunkte',
        description: 'Identifiziere, wo Nutzer hängen bleiben könnten',
        prompt:
          'Basierend auf dem Projektkontext, identifiziere potenzielle Nutzer-Reibungspunkte. Wo könnten Nutzer verwirrt, blockiert oder frustriert werden? Berücksichtige Formular-Übermittlungen, Navigation, Fehlerzustände und komplexe Interaktionen.',
      },
      {
        id: 'ux-empty-states',
        category: 'ux-ui',
        title: 'Leere Zustände',
        description: 'Verbessere die Erfahrung bei leeren Zuständen',
        prompt:
          'Basierend auf dem Projektkontext, identifiziere leere Zustände, die verbessert werden könnten. Wie können wir Nutzer führen, wenn es keinen Inhalt gibt? Berücksichtige Onboarding, hilfreiche Hinweise und Beispieldaten.',
      },
      {
        id: 'ux-accessibility',
        category: 'ux-ui',
        title: 'Barrierefreiheits-Verbesserungen',
        description: 'Verbessere Barrierefreiheit und Inklusivität',
        prompt:
          'Basierend auf dem Projektkontext, schlage Barrierefreiheits-Verbesserungen vor. Berücksichtige Tastatur-Navigation, Screenreader-Unterstützung, Farbkontrast, Fokus-Zustände und ARIA-Labels. Welche spezifischen Verbesserungen würden dies barrierefreier machen?',
      },
      {
        id: 'ux-mobile',
        category: 'ux-ui',
        title: 'Mobile Erfahrung',
        description: 'Optimiere für mobile Nutzer',
        prompt:
          'Basierend auf dem Projektkontext, schlage Verbesserungen für die mobile Nutzererfahrung vor. Berücksichtige Touch-Ziele, responsive Layouts und mobilspezifische Interaktionen.',
      },
      {
        id: 'ux-feedback',
        category: 'ux-ui',
        title: 'Nutzer-Feedback',
        description: 'Verbessere Feedback und Status-Anzeigen',
        prompt:
          'Basierend auf dem Projektkontext, analysiere wie die Anwendung mit Nutzern kommuniziert. Wo fehlen Ladezustände, Erfolgsmeldungen oder Fehlerbehandlung oder sind unklar? Welches Feedback würde Nutzern helfen zu verstehen, was passiert?',
      },

      // DX-Prompts (Entwicklererfahrung)
      {
        id: 'dx-documentation',
        category: 'dx',
        title: 'Dokumentationslücken',
        description: 'Identifiziere fehlende Dokumentation',
        prompt:
          'Basierend auf dem Projektkontext, identifiziere Bereiche, die von besserer Dokumentation profitieren würden. Was würde neuen Entwicklern helfen, die Architektur, APIs und Konventionen zu verstehen? Berücksichtige Inline-Kommentare, READMEs und API-Dokumentation.',
      },
      {
        id: 'dx-testing',
        category: 'dx',
        title: 'Test-Verbesserungen',
        description: 'Verbessere Testabdeckung und -qualität',
        prompt:
          'Basierend auf dem Projektkontext, schlage Bereiche vor, die bessere Testabdeckung benötigen. Welche Arten von Tests fehlen möglicherweise? Berücksichtige Unit-Tests, Integrationstests und End-to-End-Tests.',
      },
      {
        id: 'dx-tooling',
        category: 'dx',
        title: 'Entwickler-Werkzeuge',
        description: 'Verbessere Entwicklungs-Workflows',
        prompt:
          'Basierend auf dem Projektkontext, schlage Verbesserungen für Entwicklungs-Workflows vor. Welche Verbesserungen würden die Entwicklung beschleunigen? Berücksichtige Build-Zeiten, Hot-Reload, Debugging-Tools und Entwickler-Skripte.',
      },
      {
        id: 'dx-error-handling',
        category: 'dx',
        title: 'Fehlerbehandlung',
        description: 'Verbessere Fehlermeldungen und Debugging',
        prompt:
          'Basierend auf dem Projektkontext, analysiere die Fehlerbehandlung. Wo sind Fehlermeldungen unklar oder fehlen? Was würde Entwicklern helfen, Probleme schneller zu debuggen? Berücksichtige Logging, Error Boundaries und Stack Traces.',
      },

      // Growth-Prompts (Wachstum)
      {
        id: 'growth-onboarding',
        category: 'growth',
        title: 'Onboarding-Flow',
        description: 'Verbessere die Erfahrung neuer Nutzer',
        prompt:
          'Basierend auf dem Projektkontext, schlage Verbesserungen für die Onboarding-Erfahrung vor. Wie können wir neuen Nutzern helfen, den Wert zu verstehen und schnell loszulegen? Berücksichtige Tutorials, schrittweise Einführung und schnelle Erfolge.',
      },
      {
        id: 'growth-engagement',
        category: 'growth',
        title: 'Nutzer-Engagement',
        description: 'Erhöhe Nutzerbindung und -aktivität',
        prompt:
          'Basierend auf dem Projektkontext, schlage Features vor, die das Nutzer-Engagement und die Bindung erhöhen würden. Was würde Nutzer täglich zurückbringen? Berücksichtige Benachrichtigungen, Serien, soziale Features und Personalisierung.',
      },
      {
        id: 'growth-sharing',
        category: 'growth',
        title: 'Teilbarkeit',
        description: 'Mache die App teilbarer',
        prompt:
          'Basierend auf dem Projektkontext, schlage Wege vor, die Anwendung teilbarer zu machen. Welche Features würden Nutzer ermutigen, andere einzuladen oder ihre Arbeit zu teilen? Berücksichtige Zusammenarbeit, öffentliche Profile und Export-Features.',
      },
      {
        id: 'growth-monetization',
        category: 'growth',
        title: 'Monetarisierungs-Ideen',
        description: 'Identifiziere potenzielle Einnahmequellen',
        prompt:
          'Basierend auf dem Projektkontext, welche Features oder Stufen könnten Monetarisierung unterstützen? Berücksichtige Premium-Features, Nutzungslimits, Team-Features und Integrationen, für die Nutzer zahlen würden.',
      },

      // Technical-Prompts (Technik)
      {
        id: 'tech-performance',
        category: 'technical',
        title: 'Performance-Optimierung',
        description: 'Identifiziere Performance-Engpässe',
        prompt:
          'Basierend auf dem Projektkontext, schlage Performance-Optimierungsmöglichkeiten vor. Wo könnten Engpässe existieren? Berücksichtige Datenbankabfragen, API-Aufrufe, Bundle-Größe, Rendering und Caching-Strategien.',
      },
      {
        id: 'tech-architecture',
        category: 'technical',
        title: 'Architektur-Review',
        description: 'Evaluiere und verbessere die Architektur',
        prompt:
          'Basierend auf dem Projektkontext, schlage architektonische Verbesserungen vor. Was würde die Codebase wartbarer, skalierbarer oder testbarer machen? Berücksichtige Trennung der Verantwortlichkeiten, Abhängigkeitsmanagement und Muster.',
      },
      {
        id: 'tech-debt',
        category: 'technical',
        title: 'Technische Schulden',
        description: 'Identifiziere Bereiche, die Refactoring benötigen',
        prompt:
          'Basierend auf dem Projektkontext, identifiziere potenzielle technische Schulden. Welche Bereiche werden möglicherweise schwer zu warten oder verstehen? Welches Refactoring hätte die größte Wirkung? Berücksichtige duplizierten Code, Komplexität und veraltete Muster.',
      },
      {
        id: 'tech-security',
        category: 'technical',
        title: 'Sicherheits-Review',
        description: 'Identifiziere Sicherheitsverbesserungen',
        prompt:
          'Basierend auf dem Projektkontext, prüfe auf Sicherheitsverbesserungen. Welche Best Practices fehlen? Berücksichtige Authentifizierung, Autorisierung, Eingabevalidierung und Datenschutz. Hinweis: Dies ist für Verbesserungsvorschläge, kein Sicherheitsaudit.',
      },

      // Security-Prompts (Sicherheit)
      {
        id: 'security-auth',
        category: 'security',
        title: 'Authentifizierungs-Sicherheit',
        description: 'Überprüfe Authentifizierungsmechanismen',
        prompt:
          'Basierend auf dem Projektkontext, analysiere das Authentifizierungssystem. Welche Sicherheitsverbesserungen würden die Nutzerauthentifizierung stärken? Berücksichtige Passwortrichtlinien, Session-Management, MFA und Token-Handling.',
      },
      {
        id: 'security-data',
        category: 'security',
        title: 'Datenschutz',
        description: 'Schütze sensible Nutzerdaten',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe wie sensible Daten behandelt werden. Welche Verbesserungen würden die Privatsphäre der Nutzer besser schützen? Berücksichtige Verschlüsselung, Datenminimierung, sichere Speicherung und Datenaufbewahrungsrichtlinien.',
      },
      {
        id: 'security-input',
        category: 'security',
        title: 'Eingabevalidierung',
        description: 'Verhindere Injection-Angriffe',
        prompt:
          'Basierend auf dem Projektkontext, analysiere die Eingabeverarbeitung. Wo könnte die Eingabevalidierung verstärkt werden? Berücksichtige SQL-Injection, XSS, Command-Injection und Datei-Upload-Schwachstellen.',
      },
      {
        id: 'security-api',
        category: 'security',
        title: 'API-Sicherheit',
        description: 'Sichere API-Endpunkte ab',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe die API-Sicherheit. Welche Verbesserungen würden die API sicherer machen? Berücksichtige Rate-Limiting, Autorisierung, CORS und Request-Validierung.',
      },

      // Performance-Prompts
      {
        id: 'perf-frontend',
        category: 'performance',
        title: 'Frontend-Performance',
        description: 'Optimiere UI-Rendering und Laden',
        prompt:
          'Basierend auf dem Projektkontext, analysiere die Frontend-Performance. Welche Optimierungen würden Ladezeiten und Reaktionsfähigkeit verbessern? Berücksichtige Bundle-Splitting, Lazy Loading, Memoization und Render-Optimierung.',
      },
      {
        id: 'perf-backend',
        category: 'performance',
        title: 'Backend-Performance',
        description: 'Optimiere serverseitige Operationen',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe die Backend-Performance. Welche Optimierungen würden Antwortzeiten verbessern? Berücksichtige Datenbankabfragen, Caching-Strategien, asynchrone Operationen und Resource-Pooling.',
      },
      {
        id: 'perf-database',
        category: 'performance',
        title: 'Datenbank-Optimierung',
        description: 'Verbessere Abfrage-Performance',
        prompt:
          'Basierend auf dem Projektkontext, analysiere Datenbankinteraktionen. Welche Optimierungen würden die Datenzugriffs-Performance verbessern? Berücksichtige Indizierung, Abfrageoptimierung, Denormalisierung und Connection-Pooling.',
      },
      {
        id: 'perf-caching',
        category: 'performance',
        title: 'Caching-Strategien',
        description: 'Implementiere effektives Caching',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe Caching-Möglichkeiten. Wo würde Caching den größten Nutzen bringen? Berücksichtige API-Antworten, berechnete Werte, statische Assets und Session-Daten.',
      },

      // Accessibility-Prompts (Barrierefreiheit)
      {
        id: 'a11y-keyboard',
        category: 'accessibility',
        title: 'Tastatur-Navigation',
        description: 'Ermögliche vollständigen Tastaturzugang',
        prompt:
          'Basierend auf dem Projektkontext, analysiere die Tastatur-Barrierefreiheit. Welche Verbesserungen würden es Nutzern ermöglichen, vollständig mit der Tastatur zu navigieren? Berücksichtige Fokus-Management, Tab-Reihenfolge und Tastaturkürzel.',
      },
      {
        id: 'a11y-screen-reader',
        category: 'accessibility',
        title: 'Screenreader-Unterstützung',
        description: 'Verbessere die Screenreader-Erfahrung',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe die Screenreader-Kompatibilität. Welche Verbesserungen würden Nutzern mit Sehbehinderungen helfen? Berücksichtige ARIA-Labels, semantisches HTML, Live-Regionen und Alt-Text.',
      },
      {
        id: 'a11y-visual',
        category: 'accessibility',
        title: 'Visuelle Barrierefreiheit',
        description: 'Verbessere das visuelle Design für alle Nutzer',
        prompt:
          'Basierend auf dem Projektkontext, analysiere die visuelle Barrierefreiheit. Welche Verbesserungen würden Nutzern mit Sehbehinderungen helfen? Berücksichtige Farbkontrast, Textgröße, Fokusindikatoren und reduzierte Bewegung.',
      },
      {
        id: 'a11y-forms',
        category: 'accessibility',
        title: 'Barrierefreie Formulare',
        description: 'Mache Formulare für alle nutzbar',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe die Formular-Barrierefreiheit. Welche Verbesserungen würden Formulare barrierefreier machen? Berücksichtige Labels, Fehlermeldungen, Pflichtfeld-Indikatoren und Eingabehilfen.',
      },

      // Analytics-Prompts (Analytik)
      {
        id: 'analytics-tracking',
        category: 'analytics',
        title: 'Nutzer-Tracking',
        description: 'Verfolge wichtige Nutzerverhaltensweisen',
        prompt:
          'Basierend auf dem Projektkontext, analysiere Analytik-Möglichkeiten. Welche Nutzerverhaltensweisen sollten verfolgt werden, um Engagement zu verstehen? Berücksichtige Seitenaufrufe, Feature-Nutzung, Conversion-Funnels und Session-Dauer.',
      },
      {
        id: 'analytics-metrics',
        category: 'analytics',
        title: 'Schlüsselmetriken',
        description: 'Definiere Erfolgsmetriken',
        prompt:
          'Basierend auf dem Projektkontext, welche Schlüsselmetriken sollten verfolgt werden? Berücksichtige Nutzerakquise, Bindung, Engagement und Feature-Adoption. Welche Dashboards wären am wertvollsten?',
      },
      {
        id: 'analytics-errors',
        category: 'analytics',
        title: 'Fehler-Monitoring',
        description: 'Verfolge und analysiere Fehler',
        prompt:
          'Basierend auf dem Projektkontext, überprüfe die Fehlerbehandlung auf Monitoring-Möglichkeiten. Welches Fehler-Tracking würde helfen, Probleme schneller zu identifizieren und zu beheben? Berücksichtige Fehleraggregation, Alerting und Stack Traces.',
      },
      {
        id: 'analytics-performance',
        category: 'analytics',
        title: 'Performance-Monitoring',
        description: 'Verfolge Anwendungs-Performance',
        prompt:
          'Basierend auf dem Projektkontext, analysiere Performance-Monitoring-Möglichkeiten. Welche Metriken würden helfen, Engpässe zu identifizieren? Berücksichtige Ladezeiten, API-Antwortzeiten und Ressourcennutzung.',
      },
    ];
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildIdeationSystemPrompt(
    contextFilesPrompt: string | undefined,
    category?: IdeaCategory,
    existingWorkContext?: string
  ): string {
    const basePrompt = `Du bist ein KI-Produktstratege und UX-Experte, der beim Brainstorming von Ideen zur Verbesserung eines Softwareprojekts hilft.

Deine Rolle ist es:
- Die Codebase-Struktur und Muster zu analysieren
- Verbesserungsmöglichkeiten zu identifizieren
- Umsetzbare Ideen mit klarer Begründung vorzuschlagen
- Nutzererfahrung, technische Machbarkeit und Geschäftswert zu berücksichtigen
- Spezifisch zu sein und tatsächliche Dateien/Komponenten zu referenzieren wenn möglich

Beim Vorschlagen von Ideen:
1. Gib einen klaren, prägnanten Titel
2. Erkläre das Problem oder die Chance
3. Beschreibe die vorgeschlagene Lösung
4. Hebe den erwarteten Nutzen hervor
5. Notiere eventuelle Abhängigkeiten oder Überlegungen

WICHTIG: Schlage KEINE Features oder Ideen vor, die bereits im Projekt existieren. Prüfe die Abschnitte "Bestehende Features" und "Bestehende Ideen" unten, um Duplikate zu vermeiden.

ALLE deine Antworten MÜSSEN auf Deutsch sein!

Konzentriere dich auf praktische, implementierbare Vorschläge, die das Produkt wirklich verbessern würden.`;

    const categoryContext = category
      ? `\n\nFokusbereich: ${this.getCategoryDescription(category)}`
      : '';

    const contextSection = contextFilesPrompt ? `\n\n## Projektkontext\n${contextFilesPrompt}` : '';

    const existingWorkSection = existingWorkContext ? `\n\n${existingWorkContext}` : '';

    return basePrompt + categoryContext + contextSection + existingWorkSection;
  }

  private getCategoryDescription(category: IdeaCategory): string {
    const descriptions: Record<IdeaCategory, string> = {
      feature: 'Neue Features und Fähigkeiten, die Mehrwert für Nutzer schaffen',
      'ux-ui': 'Benutzeroberflächen- und Benutzererfahrungsverbesserungen',
      dx: 'Entwicklererfahrungs- und Tooling-Verbesserungen',
      growth: 'Nutzerakquise, Engagement und Bindung',
      technical: 'Architektur, Performance und Infrastruktur',
      security: 'Sicherheitsverbesserungen und Schwachstellenbehebung',
      performance: 'Performance-Optimierung und Geschwindigkeitsverbesserungen',
      accessibility: 'Barrierefreiheits-Features und inklusives Design',
      analytics: 'Analytik, Monitoring und Insights-Features',
    };
    return descriptions[category] || '';
  }

  /**
   * Gather basic project information for context when no context files exist
   */
  private async gatherBasicProjectInfo(projectPath: string): Promise<string | null> {
    const parts: string[] = [];

    // Try to read package.json
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const content = (await secureFs.readFile(packageJsonPath, 'utf-8')) as string;
      const pkg = JSON.parse(content);

      parts.push('## Project Information (from package.json)');
      if (pkg.name) parts.push(`**Name:** ${pkg.name}`);
      if (pkg.description) parts.push(`**Description:** ${pkg.description}`);
      if (pkg.version) parts.push(`**Version:** ${pkg.version}`);

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depNames = Object.keys(allDeps);

      // Detect framework and language
      let framework = 'Unknown';
      if (allDeps.react) framework = allDeps.next ? 'Next.js' : 'React';
      else if (allDeps.vue) framework = allDeps.nuxt ? 'Nuxt' : 'Vue';
      else if (allDeps['@angular/core']) framework = 'Angular';
      else if (allDeps.svelte) framework = 'Svelte';
      else if (allDeps.express) framework = 'Express';
      else if (allDeps.fastify) framework = 'Fastify';
      else if (allDeps.koa) framework = 'Koa';

      const language = allDeps.typescript ? 'TypeScript' : 'JavaScript';
      parts.push(`**Tech Stack:** ${framework} with ${language}`);

      // Key dependencies
      const keyDeps = depNames
        .filter(
          (d) => !d.startsWith('@types/') && !['typescript', 'eslint', 'prettier'].includes(d)
        )
        .slice(0, 15);
      if (keyDeps.length > 0) {
        parts.push(`**Key Dependencies:** ${keyDeps.join(', ')}`);
      }

      // Scripts
      if (pkg.scripts) {
        const scriptNames = Object.keys(pkg.scripts).slice(0, 10);
        parts.push(`**Available Scripts:** ${scriptNames.join(', ')}`);
      }
    } catch {
      // No package.json, try other files
    }

    // Try to read README.md (first 500 chars)
    try {
      const readmePath = path.join(projectPath, 'README.md');
      const content = (await secureFs.readFile(readmePath, 'utf-8')) as string;
      if (content) {
        parts.push('\n## README.md (excerpt)');
        parts.push(content.slice(0, 1000));
      }
    } catch {
      // No README
    }

    // Try to get cached analysis
    const cachedAnalysis = await this.getCachedAnalysis(projectPath);
    if (cachedAnalysis) {
      parts.push('\n## Project Structure Analysis');
      parts.push(cachedAnalysis.summary || '');
      if (cachedAnalysis.routes && cachedAnalysis.routes.length > 0) {
        parts.push(`**Routes:** ${cachedAnalysis.routes.map((r) => r.name).join(', ')}`);
      }
      if (cachedAnalysis.components && cachedAnalysis.components.length > 0) {
        parts.push(
          `**Components:** ${cachedAnalysis.components
            .slice(0, 10)
            .map((c) => c.name)
            .join(
              ', '
            )}${cachedAnalysis.components.length > 10 ? ` and ${cachedAnalysis.components.length - 10} more` : ''}`
        );
      }
    }

    if (parts.length === 0) {
      return null;
    }

    return parts.join('\n');
  }

  /**
   * Gather existing features and ideas to prevent duplicate suggestions
   * Returns a concise list of titles grouped by status to avoid polluting context
   */
  private async gatherExistingWorkContext(projectPath: string): Promise<string> {
    const parts: string[] = [];

    // Load existing features from the board
    if (this.featureLoader) {
      try {
        const features = await this.featureLoader.getAll(projectPath);
        if (features.length > 0) {
          parts.push('## Bestehende Features (Diese NICHT erneut generieren)');
          parts.push(
            'Die folgenden Features existieren bereits auf dem Board. Schlage KEINE ähnlichen Ideen vor:\n'
          );

          // Group features by status for clarity
          const byStatus: Record<string, string[]> = {
            done: [],
            'in-review': [],
            'in-progress': [],
            backlog: [],
          };

          for (const feature of features) {
            const status = feature.status || 'backlog';
            const title = feature.title || 'Ohne Titel';
            if (byStatus[status]) {
              byStatus[status].push(title);
            } else {
              byStatus['backlog'].push(title);
            }
          }

          // Output completed features first (most important to not duplicate)
          if (byStatus['done'].length > 0) {
            parts.push(`**Abgeschlossen:** ${byStatus['done'].join(', ')}`);
          }
          if (byStatus['in-review'].length > 0) {
            parts.push(`**In Überprüfung:** ${byStatus['in-review'].join(', ')}`);
          }
          if (byStatus['in-progress'].length > 0) {
            parts.push(`**In Bearbeitung:** ${byStatus['in-progress'].join(', ')}`);
          }
          if (byStatus['backlog'].length > 0) {
            parts.push(`**Backlog:** ${byStatus['backlog'].join(', ')}`);
          }
          parts.push('');
        }
      } catch (error) {
        logger.warn('Failed to load existing features:', error);
      }
    }

    // Load existing ideas
    try {
      const ideas = await this.getIdeas(projectPath);
      // Filter out archived ideas
      const activeIdeas = ideas.filter((idea) => idea.status !== 'archived');

      if (activeIdeas.length > 0) {
        parts.push('## Bestehende Ideen (Diese NICHT erneut generieren)');
        parts.push(
          'Die folgenden Ideen wurden bereits erfasst. Schlage KEINE ähnlichen Ideen vor:\n'
        );

        // Group by category for organization
        const byCategory: Record<string, string[]> = {};
        for (const idea of activeIdeas) {
          const cat = idea.category || 'feature';
          if (!byCategory[cat]) {
            byCategory[cat] = [];
          }
          byCategory[cat].push(idea.title);
        }

        for (const [category, titles] of Object.entries(byCategory)) {
          parts.push(`**${category}:** ${titles.join(', ')}`);
        }
        parts.push('');
      }
    } catch (error) {
      logger.warn('Failed to load existing ideas:', error);
    }

    return parts.join('\n');
  }

  private async gatherProjectStructure(projectPath: string): Promise<{
    totalFiles: number;
    routes: AnalysisFileInfo[];
    components: AnalysisFileInfo[];
    services: AnalysisFileInfo[];
    framework?: string;
    language?: string;
    dependencies?: string[];
  }> {
    const routes: AnalysisFileInfo[] = [];
    const components: AnalysisFileInfo[] = [];
    const services: AnalysisFileInfo[] = [];
    let totalFiles = 0;
    let framework: string | undefined;
    let language: string | undefined;
    const dependencies: string[] = [];

    // Check for package.json to detect framework and dependencies
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const content = (await secureFs.readFile(packageJsonPath, 'utf-8')) as string;
      const pkg = JSON.parse(content);

      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      dependencies.push(...Object.keys(allDeps).slice(0, 20)); // Top 20 deps

      if (allDeps.react) framework = 'React';
      else if (allDeps.vue) framework = 'Vue';
      else if (allDeps.angular) framework = 'Angular';
      else if (allDeps.next) framework = 'Next.js';
      else if (allDeps.express) framework = 'Express';

      language = allDeps.typescript ? 'TypeScript' : 'JavaScript';
    } catch {
      // No package.json
    }

    // Scan common directories
    const scanPatterns = [
      { dir: 'src/routes', type: 'route' as const },
      { dir: 'src/pages', type: 'route' as const },
      { dir: 'app', type: 'route' as const },
      { dir: 'src/components', type: 'component' as const },
      { dir: 'components', type: 'component' as const },
      { dir: 'src/services', type: 'service' as const },
      { dir: 'src/lib', type: 'service' as const },
      { dir: 'lib', type: 'service' as const },
    ];

    for (const pattern of scanPatterns) {
      const fullPath = path.join(projectPath, pattern.dir);
      try {
        const files = await this.scanDirectory(fullPath, pattern.type);
        totalFiles += files.length;

        if (pattern.type === 'route') routes.push(...files);
        else if (pattern.type === 'component') components.push(...files);
        else if (pattern.type === 'service') services.push(...files);
      } catch {
        // Directory doesn't exist
      }
    }

    return {
      totalFiles,
      routes: routes.slice(0, 20),
      components: components.slice(0, 30),
      services: services.slice(0, 20),
      framework,
      language,
      dependencies,
    };
  }

  private async scanDirectory(
    dirPath: string,
    type: 'route' | 'component' | 'service' | 'model' | 'config' | 'test' | 'other'
  ): Promise<AnalysisFileInfo[]> {
    const results: AnalysisFileInfo[] = [];

    try {
      const entries = (await secureFs.readdir(dirPath, { withFileTypes: true })) as any[];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subResults = await this.scanDirectory(path.join(dirPath, entry.name), type);
          results.push(...subResults);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          results.push({
            path: path.join(dirPath, entry.name),
            type,
            name: entry.name.replace(/\.(tsx?|jsx?|vue)$/, ''),
          });
        }
      }
    } catch {
      // Ignore errors
    }

    return results;
  }

  private isCodeFile(filename: string): boolean {
    return (
      /\.(tsx?|jsx?|vue|svelte)$/.test(filename) &&
      !filename.includes('.test.') &&
      !filename.includes('.spec.')
    );
  }

  private async generateAnalysisSuggestions(
    _projectPath: string,
    structure: Awaited<ReturnType<typeof this.gatherProjectStructure>>
  ): Promise<AnalysisSuggestion[]> {
    // Generate basic suggestions based on project structure analysis
    const suggestions: AnalysisSuggestion[] = [];

    if (structure.routes.length > 0 && structure.routes.length < 5) {
      suggestions.push({
        id: this.generateId('sug'),
        category: 'feature',
        title: 'Expand Core Functionality',
        description: 'The app has a small number of routes. Consider adding more features.',
        rationale: `Only ${structure.routes.length} routes detected. Most apps benefit from additional navigation options.`,
        priority: 'medium',
      });
    }

    if (
      !structure.dependencies?.includes('react-query') &&
      !structure.dependencies?.includes('@tanstack/react-query')
    ) {
      suggestions.push({
        id: this.generateId('sug'),
        category: 'technical',
        title: 'Add Data Fetching Library',
        description: 'Consider adding React Query or similar for better data management.',
        rationale:
          'Data fetching libraries provide caching, background updates, and better loading states.',
        priority: 'low',
      });
    }

    return suggestions;
  }

  private generateAnalysisSummary(
    structure: Awaited<ReturnType<typeof this.gatherProjectStructure>>,
    suggestions: AnalysisSuggestion[]
  ): string {
    const parts: string[] = [];

    if (structure.framework) {
      parts.push(`${structure.framework} ${structure.language || ''} application`);
    }

    parts.push(`with ${structure.totalFiles} code files`);
    parts.push(`${structure.routes.length} routes`);
    parts.push(`${structure.components.length} components`);
    parts.push(`${structure.services.length} services`);

    const summary = parts.join(', ');
    const highPriority = suggestions.filter((s) => s.priority === 'high').length;

    return `${summary}. Found ${suggestions.length} improvement opportunities${highPriority > 0 ? ` (${highPriority} high priority)` : ''}.`;
  }

  /**
   * Map idea category to feature category
   * Used internally for idea-to-feature conversion
   */
  private mapIdeaCategoryToFeatureCategory(category: IdeaCategory): string {
    return this.mapSuggestionCategoryToFeatureCategory(category);
  }

  /**
   * Map suggestion/idea category to feature category
   * This is the single source of truth for category mapping.
   * Used by both idea-to-feature conversion and suggestion-to-feature conversion.
   */
  mapSuggestionCategoryToFeatureCategory(category: IdeaCategory): string {
    const mapping: Record<IdeaCategory, string> = {
      feature: 'ui',
      'ux-ui': 'enhancement',
      dx: 'chore',
      growth: 'feature',
      technical: 'refactor',
      security: 'bug',
      performance: 'enhancement',
      accessibility: 'enhancement',
      analytics: 'feature',
    };
    return mapping[category] || 'feature';
  }

  private async saveSessionToDisk(
    projectPath: string,
    session: IdeationSession,
    messages: IdeationMessage[]
  ): Promise<void> {
    await secureFs.mkdir(getIdeationSessionsDir(projectPath), { recursive: true });
    const data = { session, messages };
    await secureFs.writeFile(
      getIdeationSessionPath(projectPath, session.id),
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }

  private async loadSessionFromDisk(
    projectPath: string,
    sessionId: string
  ): Promise<{ session: IdeationSession; messages: IdeationMessage[] } | null> {
    try {
      const content = (await secureFs.readFile(
        getIdeationSessionPath(projectPath, sessionId),
        'utf-8'
      )) as string;
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}
