/**
 * LLM Mode Utils - Hilfskomponenten und Funktionen
 */
import { Badge } from '@/components/ui/badge';
import { MODEL_RECOMMENDATIONS } from './llm-mode-constants';
import type { OllamaModel, DownloadProgress } from './llm-mode-types';

/**
 * Formatiert Bytes in lesbare Größe
 */
export function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

// Alias für formatSize
export const formatBytes = formatSize;

/**
 * Badge-Komponente für Modellgröße mit Farbkodierung
 */
export function SizeBadge({ size }: { size: number }) {
  const gb = size / (1024 * 1024 * 1024);
  let color = 'bg-green-500/20 text-green-400';
  if (gb > 8) color = 'bg-red-500/20 text-red-400';
  else if (gb > 5) color = 'bg-yellow-500/20 text-yellow-400';
  return (
    <Badge variant="outline" className={`text-xs ${color}`}>
      {formatSize(size)}
    </Badge>
  );
}

/**
 * Badge für deutsche Sprachunterstützung
 */
export function GermanSupportBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    exzellent: 'bg-green-500/20 text-green-400',
    'sehr gut': 'bg-green-500/15 text-green-400',
    gut: 'bg-blue-500/20 text-blue-400',
    mittel: 'bg-yellow-500/20 text-yellow-400',
  };
  const labels: Record<string, string> = {
    exzellent: '🇩🇪 Exzellent',
    'sehr gut': '🇩🇪 Sehr gut',
    gut: '🇩🇪 Gut',
    mittel: '🇩🇪 Mittel',
  };
  return (
    <Badge variant="outline" className={`text-[9px] ${colors[level] || 'bg-muted'}`}>
      {labels[level] || level}
    </Badge>
  );
}

/**
 * Prüft ob ein Modell für eine bestimmte Phase empfohlen ist
 */
export function isRecommended(modelName: string, phaseKey: string): boolean {
  const info = MODEL_RECOMMENDATIONS[modelName];
  return (
    info?.bestFor.some((phase) => phaseKey.toLowerCase().includes(phase.toLowerCase())) ?? false
  );
}

/**
 * Holt die Empfehlung für eine Phase aus installierten Modellen
 */
export function getRecommendation(phaseKey: string, models: OllamaModel[]): string | null {
  for (const [modelName, info] of Object.entries(MODEL_RECOMMENDATIONS)) {
    if (info.bestFor.some((phase) => phaseKey.toLowerCase().includes(phase.toLowerCase()))) {
      const installed = models.find((m) => m.name === modelName);
      if (installed) return modelName;
    }
  }
  return null;
}

/**
 * Holt erweiterte Modell-Informationen
 */
export function getModelInfo(modelName: string) {
  return MODEL_RECOMMENDATIONS[modelName] || null;
}

/**
 * Extrahiert den Basis-Namen eines Modells (ohne :tag)
 * z.B. "moondream:latest" → "moondream"
 */
function getBaseModelName(name: string): string {
  return name.split(':')[0];
}

/**
 * Prüft welche empfohlenen Modelle noch fehlen
 * Vergleicht Basis-Namen (ohne Tag), damit "moondream:latest" als "moondream" erkannt wird
 */
export function getMissingModels(
  installedModels: OllamaModel[],
  recommendedModels: Array<{ name: string; priority: number; reason: string }>
) {
  // Installierte Namen normalisieren (ohne Tag)
  const installedBaseNames = new Set(installedModels.map((m) => getBaseModelName(m.name)));
  // Auch mit Tag prüfen für exakte Matches
  const installedFullNames = new Set(installedModels.map((m) => m.name));

  return recommendedModels.filter((rm) => {
    const baseName = getBaseModelName(rm.name);
    // Modell ist installiert wenn entweder Basis-Name oder voller Name matcht
    return !installedBaseNames.has(baseName) && !installedFullNames.has(rm.name);
  });
}

/**
 * Download-Funktion für Ollama-Modelle
 */
export async function downloadModel(
  modelName: string,
  ollamaUrl: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<boolean> {
  onProgress({ model: modelName, status: 'downloading', progress: 0 });

  try {
    const response = await fetch(`${ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Keine Stream-Unterstützung');
    }

    const decoder = new TextDecoder();
    let lastProgress = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.total && data.completed) {
            const progress = Math.round((data.completed / data.total) * 100);
            if (progress !== lastProgress) {
              lastProgress = progress;
              onProgress({ model: modelName, status: 'downloading', progress });
            }
          }
          if (data.status === 'success') {
            onProgress({ model: modelName, status: 'completed', progress: 100 });
            return true;
          }
        } catch {
          // Ignoriere Parse-Fehler
        }
      }
    }

    onProgress({ model: modelName, status: 'completed', progress: 100 });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    onProgress({ model: modelName, status: 'error', progress: 0, error: errorMessage });
    return false;
  }
}
