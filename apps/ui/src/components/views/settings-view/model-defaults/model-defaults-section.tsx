import { Workflow, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { PhaseModelSelector } from './phase-model-selector';
import type { PhaseModelKey } from '@automaker/types';
import { DEFAULT_PHASE_MODELS } from '@automaker/types';

interface PhaseConfig {
  key: PhaseModelKey;
  label: string;
  description: string;
}

const QUICK_TASKS: PhaseConfig[] = [
  {
    key: 'enhancementModel',
    label: 'Feature-Verbesserung',
    description: 'Verbessert Feature-Namen und -Beschreibungen',
  },
  {
    key: 'fileDescriptionModel',
    label: 'Dateibeschreibungen',
    description: 'Generiert Beschreibungen für Kontextdateien',
  },
  {
    key: 'imageDescriptionModel',
    label: 'Bildbeschreibungen',
    description: 'Analysiert und beschreibt Kontextbilder',
  },
];

const VALIDATION_TASKS: PhaseConfig[] = [
  {
    key: 'validationModel',
    label: 'GitHub Issue Validierung',
    description: 'Validiert und verbessert GitHub Issues',
  },
];

const GENERATION_TASKS: PhaseConfig[] = [
  {
    key: 'specGenerationModel',
    label: 'App-Spezifikation',
    description: 'Generiert vollständige Anwendungsspezifikationen',
  },
  {
    key: 'featureGenerationModel',
    label: 'Feature-Generierung',
    description: 'Erstellt Features aus Spezifikationen',
  },
  {
    key: 'backlogPlanningModel',
    label: 'Backlog-Planung',
    description: 'Reorganisiert und priorisiert das Backlog',
  },
  {
    key: 'projectAnalysisModel',
    label: 'Projektanalyse',
    description: 'Analysiert die Projektstruktur für Vorschläge',
  },
  {
    key: 'suggestionsModel',
    label: 'KI-Vorschläge',
    description: 'Modell für Feature-, Refactoring-, Sicherheits- und Performance-Vorschläge',
  },
];

const MEMORY_TASKS: PhaseConfig[] = [
  {
    key: 'memoryExtractionModel',
    label: 'Wissensextraktion',
    description: 'Extrahiert Erkenntnisse aus abgeschlossenen Agent-Sitzungen',
  },
];

function PhaseGroup({
  title,
  subtitle,
  phases,
}: {
  title: string;
  subtitle: string;
  phases: PhaseConfig[];
}) {
  const { phaseModels, setPhaseModel } = useAppStore();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-3">
        {phases.map((phase) => (
          <PhaseModelSelector
            key={phase.key}
            label={phase.label}
            description={phase.description}
            value={phaseModels[phase.key] ?? DEFAULT_PHASE_MODELS[phase.key]}
            onChange={(model) => setPhaseModel(phase.key, model)}
          />
        ))}
      </div>
    </div>
  );
}

export function ModelDefaultsSection() {
  const { resetPhaseModels } = useAppStore();

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-600/10 flex items-center justify-center border border-brand-500/20">
              <Workflow className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Modell-Standards
              </h2>
              <p className="text-sm text-muted-foreground/80">
                Konfiguriere, welches KI-Modell für jede Anwendungsaufgabe verwendet wird
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetPhaseModels} className="gap-2">
            <RotateCcw className="w-3.5 h-3.5" />
            Auf Standards zurücksetzen
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Quick Tasks */}
        <PhaseGroup
          title="Schnelle Aufgaben"
          subtitle="Schnelle Modelle empfohlen für Geschwindigkeit und Kostenersparnis"
          phases={QUICK_TASKS}
        />

        {/* Validation Tasks */}
        <PhaseGroup
          title="Validierungsaufgaben"
          subtitle="Intelligente Modelle empfohlen für Genauigkeit"
          phases={VALIDATION_TASKS}
        />

        {/* Generation Tasks */}
        <PhaseGroup
          title="Generierungsaufgaben"
          subtitle="Leistungsstarke Modelle empfohlen für Qualitätsausgabe"
          phases={GENERATION_TASKS}
        />

        {/* Memory Tasks */}
        <PhaseGroup
          title="Wissensaufgaben"
          subtitle="Schnelle Modelle empfohlen für Wissensextraktion"
          phases={MEMORY_TASKS}
        />
      </div>
    </div>
  );
}
