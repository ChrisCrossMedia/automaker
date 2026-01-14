/**
 * Self-Learning Service - Automatisches Lernen aus Agent-Aktivitäten
 *
 * Extrahiert Wissen aus jeder Agent-Sitzung und speichert es in der VDB.
 * Ermöglicht kontinuierliche Selbstverbesserung durch:
 * - Fehlermuster-Erkennung
 * - Erfolgsstrategien-Speicherung
 * - Code-Qualitäts-Lernen
 * - Kontext-basiertes Wissen
 */

import { createLogger } from '@automaker/utils';
import { VDBService } from './vdb-service.js';

const logger = createLogger('SelfLearning');

// Typen
export interface LearningContext {
  projectPath: string;
  featureId?: string;
  featureName?: string;
  sessionId: string;
}

export interface AgentStep {
  type: 'tool_use' | 'tool_result' | 'message' | 'error';
  tool?: string;
  content: string;
  success?: boolean;
  timestamp: number;
}

export interface LearningResult {
  stored: boolean;
  learningType: string;
  confidence: number;
  summary: string;
}

// Konfiguration
const MIN_CONTENT_LENGTH = 50;
const MAX_LEARNING_SIZE = 5000;
const LEARNING_ENABLED = process.env.SELF_LEARNING_ENABLED !== 'false';

/**
 * Extrahiert Schlüsselwörter aus Text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'der',
    'die',
    'das',
    'und',
    'oder',
    'aber',
    'wenn',
    'dann',
    'ist',
    'sind',
    'war',
    'were',
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'if',
    'then',
    'is',
    'are',
    'was',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Häufigkeit zählen und Top-Keywords zurückgeben
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Analysiert einen Fehlermeldung und extrahiert das Muster
 */
function analyzeError(errorContent: string): { pattern: string; category: string } {
  // Bekannte Fehlerkategorien
  const categories = [
    { regex: /TypeScript|type.*error|Type/i, category: 'typescript' },
    { regex: /import.*from|module.*not.*found|cannot.*find.*module/i, category: 'import' },
    { regex: /undefined|null|NaN|reference.*error/i, category: 'runtime' },
    { regex: /permission|EACCES|EPERM/i, category: 'permission' },
    { regex: /timeout|ETIMEDOUT|ECONNREFUSED/i, category: 'network' },
    { regex: /syntax.*error|unexpected.*token/i, category: 'syntax' },
    { regex: /memory|heap|stack.*overflow/i, category: 'memory' },
    { regex: /test.*fail|assertion|expect/i, category: 'test' },
    { regex: /lint|eslint|prettier/i, category: 'lint' },
    { regex: /build|compile|webpack|vite/i, category: 'build' },
  ];

  let category = 'unknown';
  for (const { regex, category: cat } of categories) {
    if (regex.test(errorContent)) {
      category = cat;
      break;
    }
  }

  // Extrahiere das Fehlermuster (erste Zeile oder relevanter Teil)
  const lines = errorContent.split('\n').filter((l) => l.trim());
  const pattern = lines[0]?.substring(0, 200) || errorContent.substring(0, 200);

  return { pattern, category };
}

/**
 * Analysiert ob ein Schritt erfolgreich war
 */
function analyzeStepSuccess(step: AgentStep): boolean {
  if (step.success !== undefined) return step.success;

  const failureIndicators = [
    /error/i,
    /fail/i,
    /exception/i,
    /cannot/i,
    /unable/i,
    /denied/i,
    /rejected/i,
    /invalid/i,
    /missing/i,
  ];

  for (const indicator of failureIndicators) {
    if (indicator.test(step.content)) {
      return false;
    }
  }

  return true;
}

/**
 * Speichert einen Fehler und seine Lösung
 */
export async function learnFromError(
  context: LearningContext,
  errorStep: AgentStep,
  solutionSteps: AgentStep[]
): Promise<LearningResult> {
  if (!LEARNING_ENABLED) {
    return {
      stored: false,
      learningType: 'disabled',
      confidence: 0,
      summary: 'Lernen deaktiviert',
    };
  }

  try {
    const { pattern, category } = analyzeError(errorStep.content);

    // Extrahiere Lösungsschritte
    const solutionContent = solutionSteps
      .map((s) => `[${s.type}${s.tool ? `:${s.tool}` : ''}] ${s.content}`)
      .join('\n')
      .substring(0, MAX_LEARNING_SIZE);

    const keywords = extractKeywords(errorStep.content + ' ' + solutionContent);

    const content = `FEHLERMUSTER (${category}):
${pattern}

LÖSUNG:
${solutionContent}

KONTEXT:
- Projekt: ${context.projectPath}
- Feature: ${context.featureName || context.featureId || 'Unbekannt'}

SCHLÜSSELWÖRTER: ${keywords.join(', ')}`;

    const stored = await VDBService.storeErrorSolution(
      pattern,
      solutionContent,
      context.projectPath,
      context.featureId
    );

    logger.info(`Lernergebnis gespeichert: Fehler-${category} (${stored ? 'OK' : 'FEHLER'})`);

    return {
      stored,
      learningType: `error-${category}`,
      confidence: 0.8,
      summary: `Fehlerlösung für ${category} gespeichert`,
    };
  } catch (error) {
    logger.error('Fehler beim Lernen aus Fehler:', error);
    return { stored: false, learningType: 'error', confidence: 0, summary: 'Speicherfehler' };
  }
}

/**
 * Speichert erfolgreiche Strategien
 */
export async function learnFromSuccess(
  context: LearningContext,
  steps: AgentStep[],
  outcome: string
): Promise<LearningResult> {
  if (!LEARNING_ENABLED) {
    return {
      stored: false,
      learningType: 'disabled',
      confidence: 0,
      summary: 'Lernen deaktiviert',
    };
  }

  try {
    // Filtere nur relevante Schritte
    const relevantSteps = steps.filter(
      (s) =>
        s.type === 'tool_use' || (s.type === 'message' && s.content.length > MIN_CONTENT_LENGTH)
    );

    if (relevantSteps.length < 2) {
      return {
        stored: false,
        learningType: 'success',
        confidence: 0,
        summary: 'Zu wenige Schritte',
      };
    }

    const keywords = extractKeywords(relevantSteps.map((s) => s.content).join(' ') + ' ' + outcome);

    const strategyContent = relevantSteps
      .map((s) => `[${s.type}${s.tool ? `:${s.tool}` : ''}] ${s.content.substring(0, 500)}`)
      .join('\n---\n')
      .substring(0, MAX_LEARNING_SIZE);

    const content = `ERFOLGREICHE STRATEGIE:

ERGEBNIS:
${outcome}

SCHRITTE:
${strategyContent}

KONTEXT:
- Projekt: ${context.projectPath}
- Feature: ${context.featureName || context.featureId || 'Unbekannt'}
- Anzahl Schritte: ${steps.length}

SCHLÜSSELWÖRTER: ${keywords.join(', ')}`;

    const stored = await VDBService.storeLearning(content, context.projectPath, context.featureId, [
      'success',
      'strategy',
      ...keywords,
    ]);

    logger.info(`Erfolgsstrategie gespeichert (${stored ? 'OK' : 'FEHLER'})`);

    return {
      stored,
      learningType: 'success-strategy',
      confidence: 0.7,
      summary: 'Erfolgsstrategie gespeichert',
    };
  } catch (error) {
    logger.error('Fehler beim Lernen aus Erfolg:', error);
    return { stored: false, learningType: 'success', confidence: 0, summary: 'Speicherfehler' };
  }
}

/**
 * Speichert Code-Qualitäts-Lernen
 */
export async function learnFromCodeQuality(
  context: LearningContext,
  codeSnippet: string,
  qualityIssues: string[],
  improvements: string[]
): Promise<LearningResult> {
  if (!LEARNING_ENABLED) {
    return {
      stored: false,
      learningType: 'disabled',
      confidence: 0,
      summary: 'Lernen deaktiviert',
    };
  }

  try {
    const keywords = extractKeywords(codeSnippet);

    const content = `CODE-QUALITÄT LERNEN:

ORIGINAL-CODE:
\`\`\`
${codeSnippet.substring(0, 1000)}
\`\`\`

PROBLEME:
${qualityIssues.map((i) => `- ${i}`).join('\n')}

VERBESSERUNGEN:
${improvements.map((i) => `- ${i}`).join('\n')}

KONTEXT:
- Projekt: ${context.projectPath}
- Feature: ${context.featureName || context.featureId || 'Unbekannt'}

SCHLÜSSELWÖRTER: ${keywords.join(', ')}`;

    const stored = await VDBService.storeLearning(content, context.projectPath, context.featureId, [
      'code-quality',
      ...keywords,
    ]);

    return {
      stored,
      learningType: 'code-quality',
      confidence: 0.75,
      summary: `${qualityIssues.length} Probleme, ${improvements.length} Verbesserungen`,
    };
  } catch (error) {
    logger.error('Fehler beim Lernen aus Code-Qualität:', error);
    return {
      stored: false,
      learningType: 'code-quality',
      confidence: 0,
      summary: 'Speicherfehler',
    };
  }
}

/**
 * Analysiert eine komplette Agent-Session und extrahiert Lernpunkte
 */
export async function analyzeSession(
  context: LearningContext,
  steps: AgentStep[]
): Promise<LearningResult[]> {
  if (!LEARNING_ENABLED || steps.length < 3) {
    return [];
  }

  const results: LearningResult[] = [];
  let errorStep: AgentStep | null = null;
  let solutionSteps: AgentStep[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isSuccess = analyzeStepSuccess(step);

    if (!isSuccess && step.type === 'tool_result') {
      // Fehler gefunden - sammle nächste Schritte als potenzielle Lösung
      errorStep = step;
      solutionSteps = [];
    } else if (errorStep && isSuccess) {
      // Nach einem Fehler kommt ein Erfolg - möglicherweise eine Lösung
      solutionSteps.push(step);

      // Nach 3 erfolgreichen Schritten, speichere die Lösung
      if (solutionSteps.length >= 3) {
        const result = await learnFromError(context, errorStep, solutionSteps);
        results.push(result);
        errorStep = null;
        solutionSteps = [];
      }
    }
  }

  // Wenn die Session insgesamt erfolgreich war, speichere als Erfolgsstrategie
  const lastSteps = steps.slice(-5);
  const lastStepsSuccessful = lastSteps.every((s) => analyzeStepSuccess(s));

  if (lastStepsSuccessful && steps.length >= 5) {
    const outcome = lastSteps
      .filter((s) => s.type === 'message')
      .map((s) => s.content)
      .join('\n')
      .substring(0, 500);

    if (outcome.length > MIN_CONTENT_LENGTH) {
      const result = await learnFromSuccess(context, steps, outcome);
      results.push(result);
    }
  }

  logger.info(`Session-Analyse abgeschlossen: ${results.length} Lernpunkte extrahiert`);
  return results;
}

/**
 * Sucht nach relevantem Wissen für einen aktuellen Kontext
 */
export async function findRelevantKnowledge(
  query: string,
  context?: LearningContext,
  limit = 5
): Promise<Array<{ content: string; score: number; type: string }>> {
  try {
    const results = await VDBService.searchDocuments(
      query,
      limit,
      context?.projectPath ? { projectPath: context.projectPath } : undefined
    );

    return results.map((r) => ({
      content: r.content,
      score: r.score,
      type: r.metadata.type,
    }));
  } catch (error) {
    logger.error('Fehler beim Suchen nach relevantem Wissen:', error);
    return [];
  }
}

/**
 * Sucht nach ähnlichen Fehlern und deren Lösungen
 */
export async function findSimilarErrorSolutions(
  errorDescription: string,
  limit = 3
): Promise<Array<{ error: string; solution: string; score: number }>> {
  try {
    const results = await VDBService.findSimilarErrors(errorDescription, limit);

    return results.map((r) => {
      const parts = r.content.split('\n\nLÖSUNG:');
      return {
        error: parts[0]?.replace('FEHLER: ', '') || r.content,
        solution: parts[1] || 'Keine Lösung gefunden',
        score: r.score,
      };
    });
  } catch (error) {
    logger.error('Fehler beim Suchen nach Fehlerlösungen:', error);
    return [];
  }
}

/**
 * Status des Self-Learning-Services
 */
export async function getStatus(): Promise<{
  enabled: boolean;
  vdbConnected: boolean;
  totalLearnings: number;
}> {
  const vdbStatus = await VDBService.getStatus();

  return {
    enabled: LEARNING_ENABLED,
    vdbConnected: vdbStatus.connected,
    totalLearnings: vdbStatus.documentCount,
  };
}

// Export als Modul
export const SelfLearningService = {
  learnFromError,
  learnFromSuccess,
  learnFromCodeQuality,
  analyzeSession,
  findRelevantKnowledge,
  findSimilarErrorSolutions,
  getStatus,
};

export default SelfLearningService;
