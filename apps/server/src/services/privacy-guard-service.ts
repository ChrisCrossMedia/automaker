/**
 * Privacy Guard Service
 *
 * Anonymisiert sensible Daten vor dem Senden an Cloud-KI (Claude)
 * und deanonymisiert die Antworten.
 *
 * Verwendet Ollama (lokal) für intelligente Erkennung + Regex als Fallback.
 */

import { createLogger } from '@automaker/utils';

const logger = createLogger('PrivacyGuard');

// Konfiguration
// Ollama läuft lokal auf dem Mac, nicht in Docker
// Im Container: host.docker.internal, sonst: localhost
const isContainerized = process.env.IS_CONTAINERIZED === 'true';
const OLLAMA_HOST = isContainerized ? 'host.docker.internal' : 'localhost';
const OLLAMA_URL = process.env.OLLAMA_URL || `http://${OLLAMA_HOST}:11434`;
const OLLAMA_MODEL = process.env.OLLAMA_ANONYMIZER_MODEL || 'qwen2.5:7b';
const PRIVACY_GUARD_ENABLED = process.env.PRIVACY_GUARD_ENABLED !== 'false';

// Typen
interface SensitiveDataMapping {
  placeholder: string;
  original: string;
  type: string;
  timestamp: number;
}

interface PrivacyGuardStatus {
  enabled: boolean;
  ollamaAvailable: boolean;
  ollamaModel: string;
  lastCheck: Date | null;
  activeSessionMappings: number;
}

// Regex-Muster für sensible Daten
const SENSITIVE_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+49|0049|0)[\s]?[\d\s/-]{8,15}\b/g,
  ip_v4:
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  credit_card: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
  iban: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){4,7}\d{0,2}\b/g,
  api_key: /\b(?:sk-|pk-|api[_-]?key[_-]?)[a-zA-Z0-9]{20,}\b/gi,
  password_field: /(?:password|passwort|pwd|kennwort)[\s]*[=:]["']?[^\s"']{4,}["']?/gi,
  german_name: /\b(?:Herr|Frau|Dr\.|Prof\.)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/g,
  user_path: /\/Users\/[a-zA-Z0-9_-]+/g,
  home_path: /\/home\/[a-zA-Z0-9_-]+/g,
};

// Session-Mapping (in-memory, pro Session)
const sessionMappings = new Map<string, Map<string, SensitiveDataMapping>>();

// Counter für Platzhalter
let placeholderCounter = 0;

/**
 * Generiert einen eindeutigen Platzhalter
 */
function generatePlaceholder(type: string): string {
  placeholderCounter++;
  return `[[${type.toUpperCase()}_${placeholderCounter.toString().padStart(4, '0')}]]`;
}

/**
 * Prüft ob Ollama verfügbar ist
 */
async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const models = data.models || [];
    const hasModel = models.some((m) => m.name.includes(OLLAMA_MODEL.split(':')[0]));

    if (!hasModel) {
      logger.warn(`Ollama-Modell ${OLLAMA_MODEL} nicht gefunden. Nutze Regex-Fallback.`);
    }

    return true;
  } catch (error) {
    logger.warn('Ollama nicht erreichbar. Nutze Regex-Fallback für Anonymisierung.');
    return false;
  }
}

/**
 * Verwendet Ollama für intelligente Erkennung sensibler Daten
 */
async function detectWithOllama(text: string): Promise<{ entity: string; type: string }[]> {
  try {
    const prompt = `Analysiere den folgenden Text und extrahiere NUR sensible Daten.
Gib ein JSON-Array zurück mit: [{"entity": "gefundener_wert", "type": "typ"}]

Typen: name, email, phone, address, company, api_key, password, ip_address, path, other_pii

Text:
${text.substring(0, 2000)}

Antworte NUR mit dem JSON-Array, keine Erklärung:`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { response?: string };
    const responseText = data.response || '';

    // Extrahiere JSON aus Antwort
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]) as { entity: string; type: string }[];
  } catch (error) {
    logger.debug('Ollama-Erkennung fehlgeschlagen, nutze Regex-Fallback');
    return [];
  }
}

/**
 * Regex-basierte Erkennung (Fallback)
 */
function detectWithRegex(text: string): { entity: string; type: string }[] {
  const detected: { entity: string; type: string }[] = [];

  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      if (!detected.some((d) => d.entity === match)) {
        detected.push({ entity: match, type });
      }
    }
  }

  return detected;
}

/**
 * Anonymisiert Text für eine Session
 */
export async function anonymize(
  sessionId: string,
  text: string,
  useOllama = true
): Promise<string> {
  if (!PRIVACY_GUARD_ENABLED) return text;
  if (!text || text.length === 0) return text;

  // Initialisiere Session-Mapping falls nicht vorhanden
  if (!sessionMappings.has(sessionId)) {
    sessionMappings.set(sessionId, new Map());
  }
  const mapping = sessionMappings.get(sessionId)!;

  let anonymizedText = text;

  // 1. Versuche Ollama-Erkennung
  let detected: { entity: string; type: string }[] = [];

  if (useOllama && (await checkOllamaHealth())) {
    detected = await detectWithOllama(text);
  }

  // 2. Ergänze mit Regex-Erkennung
  const regexDetected = detectWithRegex(text);
  for (const item of regexDetected) {
    if (!detected.some((d) => d.entity === item.entity)) {
      detected.push(item);
    }
  }

  // 3. Ersetze gefundene sensible Daten
  for (const { entity, type } of detected) {
    // Prüfe ob bereits gemappt
    let placeholder: string | undefined;

    for (const [ph, data] of mapping.entries()) {
      if (data.original === entity) {
        placeholder = ph;
        break;
      }
    }

    // Erstelle neuen Platzhalter falls nicht vorhanden
    if (!placeholder) {
      placeholder = generatePlaceholder(type);
      mapping.set(placeholder, {
        placeholder,
        original: entity,
        type,
        timestamp: Date.now(),
      });
    }

    // Ersetze im Text (case-sensitive)
    anonymizedText = anonymizedText.split(entity).join(placeholder);
  }

  const replacedCount = detected.length;
  if (replacedCount > 0) {
    logger.info(
      `Anonymisiert: ${replacedCount} sensible Daten ersetzt (Session: ${sessionId.substring(0, 8)}...)`
    );
  }

  return anonymizedText;
}

/**
 * Deanonymisiert Text für eine Session
 */
export function deanonymize(sessionId: string, text: string): string {
  if (!PRIVACY_GUARD_ENABLED) return text;
  if (!text || text.length === 0) return text;

  const mapping = sessionMappings.get(sessionId);
  if (!mapping || mapping.size === 0) return text;

  let deanonymizedText = text;

  // Ersetze alle Platzhalter zurück
  for (const [placeholder, data] of mapping.entries()) {
    deanonymizedText = deanonymizedText.split(placeholder).join(data.original);
  }

  return deanonymizedText;
}

/**
 * Löscht Session-Mapping
 */
export function clearSession(sessionId: string): void {
  sessionMappings.delete(sessionId);
  logger.debug(`Session-Mapping gelöscht: ${sessionId.substring(0, 8)}...`);
}

/**
 * Gibt Status des Privacy Guard zurück
 */
export async function getStatus(): Promise<PrivacyGuardStatus> {
  const ollamaAvailable = await checkOllamaHealth();

  let totalMappings = 0;
  for (const mapping of sessionMappings.values()) {
    totalMappings += mapping.size;
  }

  return {
    enabled: PRIVACY_GUARD_ENABLED,
    ollamaAvailable,
    ollamaModel: OLLAMA_MODEL,
    lastCheck: new Date(),
    activeSessionMappings: totalMappings,
  };
}

/**
 * Health-Check beim Start
 */
export async function healthCheck(): Promise<boolean> {
  logger.info('Privacy Guard Health-Check...');

  if (!PRIVACY_GUARD_ENABLED) {
    logger.info('Privacy Guard ist deaktiviert (PRIVACY_GUARD_ENABLED=false)');
    return true;
  }

  const ollamaOk = await checkOllamaHealth();

  if (ollamaOk) {
    logger.info(`✅ Privacy Guard aktiv mit Ollama (${OLLAMA_MODEL})`);
  } else {
    logger.warn('⚠️ Privacy Guard aktiv mit Regex-Fallback (Ollama nicht verfügbar)');
  }

  // Teste Anonymisierung
  const testText = 'Test: max.mustermann@example.com, +49 123 456789';
  const testSession = 'health-check-test';
  const anonymized = await anonymize(testSession, testText, ollamaOk);
  const deanonymized = deanonymize(testSession, anonymized);
  clearSession(testSession);

  const success = deanonymized === testText;

  if (success) {
    logger.info('✅ Privacy Guard Selbsttest erfolgreich');
  } else {
    logger.error('❌ Privacy Guard Selbsttest fehlgeschlagen!');
  }

  return success;
}

// Export für einfachen Import
export const PrivacyGuard = {
  anonymize,
  deanonymize,
  clearSession,
  getStatus,
  healthCheck,
};

export default PrivacyGuard;
