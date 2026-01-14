/**
 * Model Selector - Dropdown für Modell-Auswahl mit erweiterten Infos
 * - Geschlossen: Nur Modellname (ohne Tags)
 * - Geöffnet: Vollständige Infos pro Modell
 */
import { Star, Info, Cpu, Languages } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { OllamaModel, PhaseConfig } from './llm-mode-types';
import {
  SizeBadge,
  GermanSupportBadge,
  isRecommended,
  getModelInfo,
  formatBytes,
} from './llm-mode-utils';

interface ModelSelectorProps {
  phase: PhaseConfig;
  value: string;
  onChange: (value: string) => void;
  models: OllamaModel[];
  width?: 'normal' | 'wide' | 'full';
}

export function ModelSelector({
  phase,
  value,
  onChange,
  models,
  width = 'wide',
}: ModelSelectorProps) {
  const widthClass = {
    normal: 'w-[220px]',
    wide: 'w-[320px]',
    full: 'w-full',
  }[width];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={widthClass}>
        {/* Nur Modellname anzeigen wenn geschlossen */}
        <SelectValue placeholder="Modell wählen">{value || 'Modell wählen'}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[500px] w-[420px]">
        {models.map((model) => {
          const info = getModelInfo(model.name);
          const recommended =
            isRecommended(model.name, phase.key) || model.name === phase.recommendedModel;

          return (
            <SelectItem key={model.name} value={model.name} className="py-3 px-3 cursor-pointer">
              <div className="flex flex-col gap-2 w-full">
                {/* Kopfzeile: Name + Empfehlung + Größe */}
                <div className="flex items-center gap-2 flex-wrap">
                  {recommended && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                  <span className="font-semibold text-foreground">{model.name}</span>
                  <SizeBadge size={model.size} />
                  {recommended && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
                      Empfohlen
                    </Badge>
                  )}
                </div>

                {/* Beschreibung */}
                {info && (
                  <div className="space-y-1.5 pl-0">
                    {/* Beschreibung */}
                    <p className="text-xs text-muted-foreground">{info.description}</p>

                    {/* Details */}
                    {info.details && (
                      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80">
                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{info.details}</span>
                      </div>
                    )}

                    {/* Tags-Zeile */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Deutsche Unterstützung */}
                      <GermanSupportBadge level={info.germanSupport} />

                      {/* Größenkategorie */}
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        <Cpu className="w-2.5 h-2.5 mr-1" />~{info.sizeGB} GB
                      </Badge>

                      {/* Stärken */}
                      {info.strengths.slice(0, 3).map((strength, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 bg-muted/50"
                        >
                          {strength}
                        </Badge>
                      ))}
                    </div>

                    {/* Best For */}
                    {info.bestFor && info.bestFor.length > 0 && (
                      <div className="text-[10px] text-muted-foreground/70 italic">
                        Ideal für: {info.bestFor.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Kompakter Model Selector für kleinere Bereiche
 */
interface CompactModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  models: OllamaModel[];
  placeholder?: string;
}

export function CompactModelSelector({
  value,
  onChange,
  models,
  placeholder = 'Modell wählen',
}: CompactModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={placeholder}>{value || placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[400px] w-[350px]">
        {models.map((model) => {
          const info = getModelInfo(model.name);

          return (
            <SelectItem key={model.name} value={model.name} className="py-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({formatBytes(model.size)})
                  </span>
                </div>
                {info && (
                  <div className="flex items-center gap-1.5">
                    <GermanSupportBadge level={info.germanSupport} />
                    <span className="text-[10px] text-muted-foreground">{info.description}</span>
                  </div>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
