/**
 * LLM Mode Download - Download-Sektion für fehlende empfohlene Modelle
 */
import { Download, Check, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import type { DownloadProgress } from './llm-mode-types';
import { MODEL_RECOMMENDATIONS, RECOMMENDED_MODELS } from './llm-mode-constants';
import { GermanSupportBadge, getMissingModels } from './llm-mode-utils';
import type { OllamaModel } from './llm-mode-types';

interface LlmModeDownloadProps {
  models: OllamaModel[];
  downloadProgress: Record<string, DownloadProgress>;
  onDownload: (modelName: string) => void;
}

export function LlmModeDownload({ models, downloadProgress, onDownload }: LlmModeDownloadProps) {
  const missingModels = getMissingModels(models, RECOMMENDED_MODELS);

  if (missingModels.length === 0) {
    return null;
  }

  return (
    <>
      <div className="border-t border-border" />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-yellow-400" />
            <h4 className="font-medium text-yellow-400">Empfohlene Modelle installieren</h4>
          </div>
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">
            {missingModels.length} fehlen
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Diese Modelle werden via Ollama heruntergeladen und sind sofort nutzbar.
        </p>
        <div className="grid gap-2">
          {missingModels.map((model) => {
            const info = MODEL_RECOMMENDATIONS[model.name];
            const progress = downloadProgress[model.name];
            const isDownloading = progress?.status === 'downloading';
            const isCompleted = progress?.status === 'completed';
            const hasError = progress?.status === 'error';

            return (
              <div
                key={model.name}
                className="flex items-center justify-between p-3 border rounded-lg bg-yellow-500/5 border-yellow-500/20"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {info && (
                      <>
                        <Badge variant="outline" className="text-[9px]">
                          ~{info.sizeGB} GB
                        </Badge>
                        <GermanSupportBadge level={info.germanSupport} />
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{model.reason}</p>
                  {isDownloading && (
                    <div className="mt-2">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 transition-all duration-300"
                          style={{ width: `${progress.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {progress.progress}%
                      </span>
                    </div>
                  )}
                  {hasError && (
                    <p className="text-xs text-destructive mt-1">Fehler: {progress.error}</p>
                  )}
                </div>
                <button
                  onClick={() => onDownload(model.name)}
                  disabled={isDownloading || isCompleted}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                    isCompleted
                      ? 'bg-green-500/20 text-green-400'
                      : isDownloading
                        ? 'bg-muted text-muted-foreground cursor-wait'
                        : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  }`}
                >
                  {isCompleted ? (
                    <>
                      <Check className="w-4 h-4" /> Installiert
                    </>
                  ) : isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Lädt...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Installieren
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function LlmModeInfoBox() {
  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-4">
      <h5 className="font-medium text-sm">Empfohlene lokale LLMs für deinen Mac (16 GB RAM)</h5>

      {/* Code-Aufgaben - Code-Qualität wichtiger als Sprache */}
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
        <h6 className="text-xs font-semibold text-blue-400 flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-blue-500/20 rounded text-[10px]">CODE</span>
          Für Coding-Aufgaben (Code-Qualität wichtiger als Sprache)
        </h6>
        <ul className="text-xs text-muted-foreground space-y-1.5 ml-2">
          <li className="flex items-center gap-2">
            <span className="text-yellow-400">★</span>
            <strong>qwen2.5-coder:7b</strong>
            <span className="text-blue-400 text-[10px]">BESTE WAHL</span>
            <span className="text-muted-foreground/70">
              - Spezialisiert auf Code, exzellente Qualität (~4.5 GB)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <strong>deepseek-coder:6.7b</strong>
            <span className="text-muted-foreground/70">
              - Starke Code-Alternative, gutes Reasoning (~4 GB)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <strong>codellama:7b</strong>
            <span className="text-muted-foreground/70">- Meta's Code-Spezialist (~3.8 GB)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-muted-foreground">○</span>
            <strong>starcoder2:3b</strong>
            <span className="text-muted-foreground/70">
              - Schnell für einfache Code-Aufgaben (~2 GB)
            </span>
          </li>
        </ul>
      </div>

      {/* Text-Aufgaben - Deutsche Sprache wichtig */}
      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
        <h6 className="text-xs font-semibold text-green-400 flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-green-500/20 rounded text-[10px]">TEXT</span>
          Für Text-Aufgaben (Deutsche Sprache wichtig)
        </h6>
        <ul className="text-xs text-muted-foreground space-y-1.5 ml-2">
          <li className="flex items-center gap-2">
            <span className="text-yellow-400">★</span>
            <strong>qwen2.5:7b</strong>
            <span className="text-green-400 text-[10px]">BESTE WAHL</span>
            <span className="text-muted-foreground/70">
              - Exzellentes Deutsch, starkes Reasoning (~4.5 GB)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <strong>qwen2.5:3b</strong>
            <span className="text-muted-foreground/70">- Schnell, sehr gutes Deutsch (~2 GB)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <strong>mistral:7b</strong>
            <span className="text-muted-foreground/70">
              - Europäisch, gute Mehrsprachigkeit (~4.1 GB)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-muted-foreground">○</span>
            <strong>llama3.2:3b</strong>
            <span className="text-muted-foreground/70">- Schnell, akzeptables Deutsch (~2 GB)</span>
          </li>
        </ul>
      </div>

      {/* Spezial-Aufgaben */}
      <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
        <h6 className="text-xs font-semibold text-purple-400 flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-purple-500/20 rounded text-[10px]">SPEZIAL</span>
          Für spezielle Aufgaben
        </h6>
        <ul className="text-xs text-muted-foreground space-y-1.5 ml-2">
          <li className="flex items-center gap-2">
            <span className="text-yellow-400">★</span>
            <strong>moondream</strong>
            <span className="text-purple-400 text-[10px]">VISION</span>
            <span className="text-muted-foreground/70">
              - Bildanalyse & Screenshot-Verarbeitung (~1.5 GB)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <strong>deepseek-r1:7b</strong>
            <span className="text-purple-400 text-[10px]">REASONING</span>
            <span className="text-muted-foreground/70">- Komplexes Denken, Planung (~4 GB)</span>
          </li>
        </ul>
      </div>

      <div className="border-t border-border pt-2">
        <p className="text-[10px] text-muted-foreground">
          <strong>Tipp:</strong> Für beste Ergebnisse: Code-Modelle für Code, Text-Modelle für
          Dokumentation/Commits. Modelle werden via{' '}
          <code className="bg-background px-1 rounded">ollama pull</code> installiert.
        </p>
      </div>
    </div>
  );
}
