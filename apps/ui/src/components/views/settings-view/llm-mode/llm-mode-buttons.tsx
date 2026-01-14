/**
 * LLM Mode Buttons - 3 große Buttons für Cloud/Mixed/Local Auswahl
 */
import { Cloud, Server, Shuffle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import type { LLMMode } from './llm-mode-selector';

interface LlmModeButtonsProps {
  llmMode: LLMMode;
  setLlmMode: (mode: LLMMode) => void;
}

export function LlmModeButtons({ llmMode, setLlmMode }: LlmModeButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Cloud Button */}
      <button
        onClick={() => setLlmMode('cloud')}
        className={`relative p-4 rounded-xl border-2 transition-all ${
          llmMode === 'cloud'
            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
            : 'border-border hover:border-blue-500/50 hover:bg-blue-500/5'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Cloud
            className={`w-8 h-8 ${llmMode === 'cloud' ? 'text-blue-400' : 'text-muted-foreground'}`}
          />
          <span className={`font-semibold ${llmMode === 'cloud' ? 'text-blue-400' : ''}`}>
            Cloud
          </span>
          <span className="text-[10px] text-muted-foreground text-center">Claude API</span>
        </div>
        {llmMode === 'cloud' && (
          <Badge className="absolute -top-2 -right-2 bg-blue-500">Aktiv</Badge>
        )}
      </button>

      {/* Mixed Button */}
      <button
        onClick={() => setLlmMode('mixed')}
        className={`relative p-4 rounded-xl border-2 transition-all ${
          llmMode === 'mixed'
            ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
            : 'border-border hover:border-purple-500/50 hover:bg-purple-500/5'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Shuffle
            className={`w-8 h-8 ${llmMode === 'mixed' ? 'text-purple-400' : 'text-muted-foreground'}`}
          />
          <span className={`font-semibold ${llmMode === 'mixed' ? 'text-purple-400' : ''}`}>
            Mixed
          </span>
          <span className="text-[10px] text-muted-foreground text-center">Optimiert</span>
        </div>
        {llmMode === 'mixed' && (
          <Badge className="absolute -top-2 -right-2 bg-purple-500">Aktiv</Badge>
        )}
      </button>

      {/* Local Button */}
      <button
        onClick={() => setLlmMode('local')}
        className={`relative p-4 rounded-xl border-2 transition-all ${
          llmMode === 'local'
            ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
            : 'border-border hover:border-green-500/50 hover:bg-green-500/5'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Server
            className={`w-8 h-8 ${llmMode === 'local' ? 'text-green-400' : 'text-muted-foreground'}`}
          />
          <span className={`font-semibold ${llmMode === 'local' ? 'text-green-400' : ''}`}>
            Lokal
          </span>
          <span className="text-[10px] text-muted-foreground text-center">100% Privat</span>
        </div>
        {llmMode === 'local' && (
          <Badge className="absolute -top-2 -right-2 bg-green-500">Aktiv</Badge>
        )}
      </button>
    </div>
  );
}

interface ModeDescriptionProps {
  llmMode: LLMMode;
}

export function ModeDescription({ llmMode }: ModeDescriptionProps) {
  if (llmMode === 'cloud') {
    return (
      <div className="p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Cloud className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-blue-400">Claude API Modus</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Alle Aufgaben werden über die Claude API (Anthropic) verarbeitet. Höchste Qualität für
          Code-Generierung und komplexe Aufgaben.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">Opus - Beste Qualität</Badge>
          <Badge variant="outline">Sonnet - Ausgewogen</Badge>
          <Badge variant="outline">Haiku - Schnell</Badge>
        </div>
      </div>
    );
  }

  if (llmMode === 'mixed') {
    return (
      <div className="p-4 border rounded-lg bg-purple-500/5 border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Shuffle className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-purple-400">Mixed Modus</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Einfache Aufgaben lokal (schnell & privat), komplexe Aufgaben in der Cloud (beste
          Qualität). Optimale Balance zwischen Kosten, Privatsphäre und Qualität.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-green-500/5 border-green-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-5 h-5 text-green-400" />
        <span className="font-semibold text-green-400">Lokaler Modus</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Alle Aufgaben werden lokal mit Ollama verarbeitet. Komplett privat - keine Daten verlassen
        deinen Computer.
      </p>
    </div>
  );
}
