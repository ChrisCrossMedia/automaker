/**
 * LLM Mode Mixed Config - Konfiguration für Mixed-Modus
 * Mit Empfehlungen direkt über der Modell-Auswahl
 */
import { Cloud, Server, Star, Wand2, Code, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import type { OllamaModel } from './llm-mode-types';
import { PHASES, MIXED_MODE_OPTIONS } from './llm-mode-constants';
import { ModelSelector } from './llm-mode-model-selector';

interface LlmModeMixedConfigProps {
  models: OllamaModel[];
  mixedModeConfig: Record<string, boolean>;
  setMixedModeConfig: (key: string, value: boolean) => void;
  localPhaseModels: Record<string, string>;
  setLocalPhaseModel: (key: string, value: string) => void;
}

// Hilfsfunktion: Prüft ob ein Modell installiert ist (mit oder ohne Tag)
function isModelInstalled(modelName: string, installedModels: OllamaModel[]): boolean {
  const baseName = modelName.split(':')[0];
  return installedModels.some((m) => {
    const installedBase = m.name.split(':')[0];
    return m.name === modelName || installedBase === baseName || installedBase === modelName;
  });
}

// Hilfsfunktion: Findet den exakten installierten Namen für ein empfohlenes Modell
function findInstalledModelName(
  recommendedModel: string,
  installedModels: OllamaModel[]
): string | null {
  const baseName = recommendedModel.split(':')[0];
  // Erst exakten Match suchen
  const exactMatch = installedModels.find((m) => m.name === recommendedModel);
  if (exactMatch) return exactMatch.name;
  // Dann Basis-Namen Match
  const baseMatch = installedModels.find((m) => m.name.split(':')[0] === baseName);
  if (baseMatch) return baseMatch.name;
  return null;
}

export function LlmModeMixedConfig({
  models,
  mixedModeConfig,
  setMixedModeConfig,
  localPhaseModels,
  setLocalPhaseModel,
}: LlmModeMixedConfigProps) {
  const localCapablePhases = PHASES.filter((p) => p.localCapable);

  // Empfehlungen übernehmen - setzt alle empfohlenen Modelle
  const applyRecommendations = () => {
    localCapablePhases.forEach((phase) => {
      if (phase.recommendedModel) {
        const installedName = findInstalledModelName(phase.recommendedModel, models);
        if (installedName) {
          setLocalPhaseModel(phase.key, installedName);
        }
      }
    });
  };

  // Prüfe wie viele Empfehlungen verfügbar sind
  const availableRecommendations = localCapablePhases.filter(
    (p) => p.recommendedModel && isModelInstalled(p.recommendedModel, models)
  ).length;

  // Kategorisiere Phasen nach Typ
  const codePhases = localCapablePhases.filter(
    (p) => p.key.includes('docstring') || p.key.includes('formatting')
  );
  const textPhases = localCapablePhases.filter(
    (p) => !p.key.includes('docstring') && !p.key.includes('formatting') && !p.key.includes('image')
  );
  const specialPhases = localCapablePhases.filter((p) => p.key.includes('image'));

  return (
    <>
      <div className="border-t border-border" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Mixed-Mode Konfiguration</h4>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/20 text-green-400">
              <Server className="w-3 h-3 mr-1" /> Lokal
            </Badge>
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
              <Cloud className="w-3 h-3 mr-1" /> Cloud
            </Badge>
          </div>
        </div>

        <div className="grid gap-3">
          {/* Lokal empfohlene Aufgaben */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-green-400" />
              <h5 className="text-sm font-medium text-green-400">Lokale LLMs empfohlen</h5>
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400">
                Gute Ergebnisse
              </Badge>
            </div>
          </div>

          {MIXED_MODE_OPTIONS.filter((o) => o.localCapable).map((option) => (
            <MixedModeOptionRow
              key={option.key}
              option={option}
              isLocal={mixedModeConfig[option.key] ?? true}
              onToggle={(checked) => setMixedModeConfig(option.key, checked)}
              variant="local"
            />
          ))}

          <div className="border-t border-border my-2" />

          {/* Cloud empfohlene Aufgaben */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-400" />
              <h5 className="text-sm font-medium text-blue-400">Claude empfohlen</h5>
              <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400">
                Komplexe Aufgaben
              </Badge>
            </div>
          </div>

          {MIXED_MODE_OPTIONS.filter((o) => !o.localCapable).map((option) => (
            <MixedModeOptionRow
              key={option.key}
              option={option}
              isLocal={mixedModeConfig[option.key] ?? true}
              onToggle={(checked) => setMixedModeConfig(option.key, checked)}
              variant="cloud"
            />
          ))}
        </div>

        {/* === EMPFEHLUNGEN DIREKT ÜBER DER MODELL-AUSWAHL === */}
        <div className="border-t border-border" />
        <ModelRecommendationsBox />

        {/* Lokale Modelle für Mixed-Mode */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                Lokale Modelle für Mixed-Mode
              </h5>
              <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-400">
                {localCapablePhases.length} Aufgaben lokal
              </Badge>
            </div>
            {/* Empfehlungen übernehmen Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={applyRecommendations}
              disabled={availableRecommendations === 0}
              className="text-xs h-7 bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
            >
              <Wand2 className="w-3 h-3 mr-1" />
              Empfehlungen übernehmen ({availableRecommendations})
            </Button>
          </div>

          {/* CODE-Aufgaben */}
          {codePhases.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Code className="w-3 h-3 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">CODE-Aufgaben</span>
                <span className="text-[10px] text-muted-foreground">(Code-Qualität wichtig)</span>
              </div>
              {codePhases.map((phase) => (
                <PhaseModelRow
                  key={phase.key}
                  phase={phase}
                  models={models}
                  value={localPhaseModels[phase.key] || phase.recommendedModel || ''}
                  onChange={(value) => setLocalPhaseModel(phase.key, value)}
                  variant="code"
                />
              ))}
            </div>
          )}

          {/* TEXT-Aufgaben */}
          {textPhases.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-green-400">TEXT-Aufgaben</span>
                <span className="text-[10px] text-muted-foreground">(Deutsch wichtig)</span>
              </div>
              {textPhases.map((phase) => (
                <PhaseModelRow
                  key={phase.key}
                  phase={phase}
                  models={models}
                  value={localPhaseModels[phase.key] || phase.recommendedModel || ''}
                  onChange={(value) => setLocalPhaseModel(phase.key, value)}
                  variant="text"
                />
              ))}
            </div>
          )}

          {/* SPEZIAL-Aufgaben */}
          {specialPhases.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="w-3 h-3 text-purple-400" />
                <span className="text-xs font-medium text-purple-400">SPEZIAL-Aufgaben</span>
              </div>
              {specialPhases.map((phase) => (
                <PhaseModelRow
                  key={phase.key}
                  phase={phase}
                  models={models}
                  value={localPhaseModels[phase.key] || phase.recommendedModel || ''}
                  onChange={(value) => setLocalPhaseModel(phase.key, value)}
                  variant="special"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Kompakte Empfehlungs-Box
function ModelRecommendationsBox() {
  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
      <h6 className="text-xs font-semibold">Empfohlene Modelle nach Aufgabentyp</h6>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
          <div className="font-semibold text-blue-400 mb-1">CODE</div>
          <div className="text-muted-foreground">qwen2.5-coder:7b</div>
          <div className="text-muted-foreground/70">deepseek-coder:6.7b</div>
        </div>
        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
          <div className="font-semibold text-green-400 mb-1">TEXT (DE)</div>
          <div className="text-muted-foreground">qwen2.5:3b</div>
          <div className="text-muted-foreground/70">qwen2.5:7b</div>
        </div>
        <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
          <div className="font-semibold text-purple-400 mb-1">SPEZIAL</div>
          <div className="text-muted-foreground">moondream (Vision)</div>
        </div>
      </div>
    </div>
  );
}

interface PhaseModelRowProps {
  phase: (typeof PHASES)[0];
  models: OllamaModel[];
  value: string;
  onChange: (value: string) => void;
  variant: 'code' | 'text' | 'special';
}

function PhaseModelRow({ phase, models, value, onChange, variant }: PhaseModelRowProps) {
  const borderColors = {
    code: 'border-blue-500/20 bg-blue-500/5',
    text: 'border-green-500/20 bg-green-500/5',
    special: 'border-purple-500/20 bg-purple-500/5',
  };
  const badgeColors = {
    code: 'bg-blue-500/10 text-blue-400',
    text: 'bg-green-500/10 text-green-400',
    special: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div
      className={`flex items-center justify-between gap-4 p-2 border rounded ${borderColors[variant]}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <phase.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <span className="text-sm font-medium">{phase.label}</span>
          {phase.recommendedModel && (
            <Badge variant="outline" className={`text-[9px] ml-2 ${badgeColors[variant]}`}>
              Empf.: {phase.recommendedModel}
            </Badge>
          )}
        </div>
      </div>
      <ModelSelector phase={phase} value={value} onChange={onChange} models={models} />
    </div>
  );
}

interface MixedModeOptionRowProps {
  option: {
    key: string;
    label: string;
    description: string;
    localCapable: boolean;
    recommendedModel?: string;
    reason?: string;
  };
  isLocal: boolean;
  onToggle: (checked: boolean) => void;
  variant: 'local' | 'cloud';
}

function MixedModeOptionRow({ option, isLocal, onToggle, variant }: MixedModeOptionRowProps) {
  const isLocalVariant = variant === 'local';
  const borderColor = isLocalVariant ? 'border-green-500/20' : 'border-blue-500/20';
  const bgColor = isLocalVariant ? 'bg-green-500/5' : 'bg-blue-500/5';
  const badgeClass = isLocalVariant
    ? 'text-[10px] bg-green-500/20 text-green-400'
    : 'text-[10px] bg-blue-500/20 text-blue-400';
  const reasonColor = isLocalVariant ? 'text-green-400/70' : 'text-blue-400/70';

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-lg ${borderColor} ${bgColor}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{option.label}</span>
          <Badge variant="outline" className={badgeClass}>
            {isLocalVariant ? (
              <>
                <Star className="w-2.5 h-2.5 mr-1 fill-green-400" /> Lokal empfohlen
              </>
            ) : (
              <>
                <Cloud className="w-2.5 h-2.5 mr-1" /> Claude
              </>
            )}
          </Badge>
          {option.recommendedModel && (
            <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground">
              {option.recommendedModel}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{option.description}</div>
        {option.reason && (
          <div className={`text-[10px] ${reasonColor} mt-1 italic`}>{option.reason}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">
          {isLocalVariant ? (isLocal ? 'Lokal' : 'Cloud') : isLocal ? 'Cloud' : 'Lokal'}
        </span>
        <Switch checked={isLocal} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}
