/**
 * LLM Mode Privacy - Datenschutz-Integration für alle Modi
 * Lokale Anonymisierung auch im Cloud-Modus verfügbar
 */
import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Bot, RefreshCw, Star, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { OllamaModel } from './llm-mode-types';
import { CompactModelSelector } from './llm-mode-model-selector';

// Modell-Bewertung für Anonymisierung
const PRIVACY_MODEL_INFO: Record<
  string,
  {
    rating: 'excellent' | 'good' | 'moderate';
    description: string;
  }
> = {
  'qwen2.5:7b': { rating: 'excellent', description: 'Beste Balance für Anonymisierung' },
  'qwen2.5:14b': { rating: 'excellent', description: 'Höchste Qualität' },
  'qwen2.5:3b': { rating: 'good', description: 'Schnell, gute Qualität' },
  'mistral:7b': { rating: 'good', description: 'Gute Deutschunterstützung' },
  'mistral-nemo:12b': { rating: 'excellent', description: 'Sehr gute Genauigkeit' },
  'llama3.1:8b': { rating: 'good', description: 'Solide Leistung' },
  'phi4:14b': { rating: 'excellent', description: 'Starkes Reasoning' },
  'deepseek-r1:7b': { rating: 'excellent', description: 'Exzellentes Reasoning' },
};

interface LlmModePrivacyProps {
  privacyGuardEnabled: boolean;
  setPrivacyGuardEnabled: (enabled: boolean) => void;
  privacyGuardModel: string;
  setPrivacyGuardModel: (model: string) => void;
  ollamaUrl: string;
  llmMode: 'cloud' | 'local' | 'mixed';
}

export function LlmModePrivacy({
  privacyGuardEnabled,
  setPrivacyGuardEnabled,
  privacyGuardModel,
  setPrivacyGuardModel,
  ollamaUrl,
  llmMode,
}: LlmModePrivacyProps) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);

  // Lade Ollama-Modelle
  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
        setOllamaOnline(true);
      } else {
        setOllamaOnline(false);
      }
    } catch {
      setOllamaOnline(false);
    } finally {
      setLoading(false);
    }
  }, [ollamaUrl]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Sortiere Modelle nach Bewertung
  const sortedModels = [...models].sort((a, b) => {
    const ratingOrder = { excellent: 0, good: 1, moderate: 2 };
    const ratingA = PRIVACY_MODEL_INFO[a.name]?.rating || 'moderate';
    const ratingB = PRIVACY_MODEL_INFO[b.name]?.rating || 'moderate';
    return ratingOrder[ratingA] - ratingOrder[ratingB];
  });

  const currentModelInfo = PRIVACY_MODEL_INFO[privacyGuardModel];

  return (
    <div className="space-y-3">
      {/* Header mit Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center border border-green-500/20">
            <ShieldCheck className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <Label className="font-semibold text-foreground cursor-pointer">
              Privacy Guard (Datenschutz)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lokale Anonymisierung sensibler Daten{' '}
              {llmMode === 'cloud' ? 'vor Cloud-Übertragung' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {llmMode === 'cloud' && privacyGuardEnabled && (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 text-xs">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Aktiv auch bei Cloud
            </Badge>
          )}
          <Switch checked={privacyGuardEnabled} onCheckedChange={setPrivacyGuardEnabled} />
        </div>
      </div>

      {/* Modell-Auswahl - immer sichtbar wenn aktiviert */}
      {privacyGuardEnabled && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Lokales LLM für Anonymisierung</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  ollamaOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}
              >
                {ollamaOnline ? 'Ollama Online' : 'Ollama Offline'}
              </Badge>
              <button
                onClick={loadModels}
                disabled={loading}
                className="p-1 rounded hover:bg-accent transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {!ollamaOnline && (
            <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-400">
                Ollama nicht erreichbar. Privacy Guard benötigt Ollama für lokale Verarbeitung.
              </span>
            </div>
          )}

          {ollamaOnline && sortedModels.length > 0 && (
            <div className="space-y-2">
              <CompactModelSelector
                value={privacyGuardModel}
                onChange={setPrivacyGuardModel}
                models={sortedModels}
                placeholder="Modell für Anonymisierung wählen"
              />

              {/* Aktuelles Modell Info */}
              {currentModelInfo && (
                <div className="flex items-center gap-2 text-xs">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span
                    className={cn(
                      currentModelInfo.rating === 'excellent'
                        ? 'text-green-400'
                        : currentModelInfo.rating === 'good'
                          ? 'text-blue-400'
                          : 'text-yellow-400'
                    )}
                  >
                    {currentModelInfo.rating === 'excellent'
                      ? 'Exzellent'
                      : currentModelInfo.rating === 'good'
                        ? 'Gut'
                        : 'Akzeptabel'}
                  </span>
                  <span className="text-muted-foreground">- {currentModelInfo.description}</span>
                </div>
              )}

              {/* Empfehlungen */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground">
                  <strong>Empfohlen:</strong> qwen2.5:7b (beste Balance), mistral-nemo:12b (beste
                  Deutsch-Unterstützung)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Datenschutz-Hinweis für Cloud-Modus */}
      {llmMode === 'cloud' && (
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-xs text-muted-foreground">
            {privacyGuardEnabled ? (
              <>
                <strong className="text-green-400">✓ Privacy Guard aktiv:</strong> Sensible Daten
                werden lokal anonymisiert, bevor sie an die Claude API gesendet werden. Die Antwort
                wird anschließend deanonymisiert.
              </>
            ) : (
              <>
                <strong className="text-yellow-400">⚠ Privacy Guard inaktiv:</strong> Im Cloud-Modus
                werden alle Daten an die Claude API gesendet. Aktiviere Privacy Guard für lokale
                Anonymisierung.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
