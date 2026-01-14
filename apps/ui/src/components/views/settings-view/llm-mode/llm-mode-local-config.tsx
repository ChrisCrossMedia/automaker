/**
 * LLM Mode Local Config - Konfiguration für lokalen Modus
 * Mit Empfehlungen direkt über der Modell-Auswahl
 */
import { Info, Wand2, Code, FileText, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { OllamaModel, PhaseConfig } from './llm-mode-types';
import { PHASES } from './llm-mode-constants';
import { ModelSelector } from './llm-mode-model-selector';

interface LlmModeLocalConfigProps {
  models: OllamaModel[];
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

export function LlmModeLocalConfig({
  models,
  localPhaseModels,
  setLocalPhaseModel,
}: LlmModeLocalConfigProps) {
  // Empfehlungen übernehmen - setzt alle empfohlenen Modelle
  const applyRecommendations = () => {
    PHASES.forEach((phase) => {
      if (phase.recommendedModel) {
        const installedName = findInstalledModelName(phase.recommendedModel, models);
        if (installedName) {
          setLocalPhaseModel(phase.key, installedName);
        }
      }
    });
  };

  // Prüfe wie viele Empfehlungen verfügbar sind
  const availableRecommendations = PHASES.filter(
    (p) => p.recommendedModel && isModelInstalled(p.recommendedModel, models)
  ).length;

  // Kategorisiere Phasen nach Typ
  const codePhases = PHASES.filter(
    (p) => p.localCapable && (p.key.includes('docstring') || p.key.includes('formatting'))
  );
  const textPhases = PHASES.filter(
    (p) =>
      p.localCapable &&
      !p.key.includes('docstring') &&
      !p.key.includes('formatting') &&
      !p.key.includes('image')
  );
  const specialPhases = PHASES.filter((p) => p.localCapable && p.key.includes('image'));
  const cloudPhases = PHASES.filter((p) => !p.localCapable);

  return (
    <>
      <div className="border-t border-border" />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Lokale Modell-Konfiguration</h4>
          <Badge variant="outline">{models.length} Modelle installiert</Badge>
        </div>

        {/* === EMPFEHLUNGEN DIREKT ÜBER DER MODELL-AUSWAHL === */}
        <ModelRecommendationsBox />

        {/* Header mit Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-medium text-muted-foreground">Modelle pro Aufgabe</h5>
          </div>
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
          <CategorySection
            title="CODE-Aufgaben"
            subtitle="(Code-Qualität wichtig)"
            icon={Code}
            color="blue"
            phases={codePhases}
            models={models}
            localPhaseModels={localPhaseModels}
            setLocalPhaseModel={setLocalPhaseModel}
          />
        )}

        {/* TEXT-Aufgaben */}
        {textPhases.length > 0 && (
          <CategorySection
            title="TEXT-Aufgaben"
            subtitle="(Deutsch wichtig)"
            icon={FileText}
            color="green"
            phases={textPhases}
            models={models}
            localPhaseModels={localPhaseModels}
            setLocalPhaseModel={setLocalPhaseModel}
          />
        )}

        {/* SPEZIAL-Aufgaben */}
        {specialPhases.length > 0 && (
          <CategorySection
            title="SPEZIAL-Aufgaben"
            subtitle=""
            icon={Star}
            color="purple"
            phases={specialPhases}
            models={models}
            localPhaseModels={localPhaseModels}
            setLocalPhaseModel={setLocalPhaseModel}
          />
        )}

        {/* Cloud-Aufgaben (nur Info) */}
        {cloudPhases.length > 0 && (
          <div className="space-y-2 opacity-60">
            <div className="flex items-center gap-2">
              <Info className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {cloudPhases.length} Aufgaben nutzen Claude (empfohlen für beste Ergebnisse)
              </span>
            </div>
          </div>
        )}
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

interface CategorySectionProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple';
  phases: PhaseConfig[];
  models: OllamaModel[];
  localPhaseModels: Record<string, string>;
  setLocalPhaseModel: (key: string, value: string) => void;
}

function CategorySection({
  title,
  subtitle,
  icon: Icon,
  color,
  phases,
  models,
  localPhaseModels,
  setLocalPhaseModel,
}: CategorySectionProps) {
  const colors = {
    blue: {
      icon: 'text-blue-400',
      border: 'border-blue-500/20 bg-blue-500/5',
      badge: 'bg-blue-500/10 text-blue-400',
    },
    green: {
      icon: 'text-green-400',
      border: 'border-green-500/20 bg-green-500/5',
      badge: 'bg-green-500/10 text-green-400',
    },
    purple: {
      icon: 'text-purple-400',
      border: 'border-purple-500/20 bg-purple-500/5',
      badge: 'bg-purple-500/10 text-purple-400',
    },
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-3 h-3 ${colors[color].icon}`} />
        <span className={`text-xs font-medium ${colors[color].icon}`}>{title}</span>
        {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
      </div>

      {phases.map((phase) => (
        <PhaseRow
          key={phase.key}
          phase={phase}
          models={models}
          value={localPhaseModels[phase.key] || ''}
          onChange={(value) => setLocalPhaseModel(phase.key, value)}
          colorClasses={colors[color]}
        />
      ))}
    </div>
  );
}

interface PhaseRowProps {
  phase: PhaseConfig;
  models: OllamaModel[];
  value: string;
  onChange: (value: string) => void;
  colorClasses: { icon: string; border: string; badge: string };
}

function PhaseRow({ phase, models, value, onChange, colorClasses }: PhaseRowProps) {
  const Icon = phase.icon;

  return (
    <div
      className={`flex items-center justify-between gap-4 p-3 border rounded-lg ${colorClasses.border}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{phase.label}</span>
            {phase.recommendedModel && (
              <Badge variant="outline" className={`text-[9px] ${colorClasses.badge}`}>
                Empf.: {phase.recommendedModel}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{phase.description}</div>
          {phase.whyRecommended && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
              <Info className="w-3 h-3" />
              <span className="italic">{phase.whyRecommended}</span>
            </div>
          )}
        </div>
      </div>
      <ModelSelector phase={phase} value={value} onChange={onChange} models={models} />
    </div>
  );
}
