import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Bot, RefreshCw, Star, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Ollama Model Interface
interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

// Model-Beschreibungen und Empfehlungen auf Deutsch
const MODEL_INFO: Record<
  string,
  {
    description: string;
    anonymization: 'excellent' | 'good' | 'moderate' | 'not_recommended';
    deanonymization: 'excellent' | 'good' | 'moderate' | 'not_recommended';
    specialNote?: string;
  }
> = {
  // Qwen Modelle - Ausgezeichnet für NER/Anonymisierung
  'qwen2.5:0.5b': {
    description: 'Ultraleichtes Modell, sehr schnell aber begrenzte Genauigkeit',
    anonymization: 'moderate',
    deanonymization: 'moderate',
  },
  'qwen2.5:1.5b': {
    description: 'Kleines Modell mit gutem Geschwindigkeits-/Qualitätsverhältnis',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'qwen2.5:3b': {
    description: 'Ausgewogenes Modell für alltägliche Aufgaben',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'qwen2.5:7b': {
    description: 'Empfohlenes Modell für Anonymisierung - beste Balance',
    anonymization: 'excellent',
    deanonymization: 'excellent',
    specialNote: 'Empfohlen für Anonymisierung',
  },
  'qwen2.5:14b': {
    description: 'Großes Modell mit hoher Genauigkeit, mehr Ressourcen',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'qwen2.5:32b': {
    description: 'Sehr großes Modell, beste Qualität aber ressourcenintensiv',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'qwen2.5:72b': {
    description: 'Maximale Qualität, erfordert erhebliche GPU-Ressourcen',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  // Llama Modelle
  'llama3.2:1b': {
    description: 'Metas kleinstes Llama 3.2 Modell, sehr schnell',
    anonymization: 'moderate',
    deanonymization: 'moderate',
  },
  'llama3.2:3b': {
    description: 'Kompaktes Llama 3.2 mit guter Leistung',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'llama3.1:8b': {
    description: 'Solides Allround-Modell von Meta',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'llama3.1:70b': {
    description: 'Großes Llama-Modell mit exzellenter Qualität',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'llama3.3:70b': {
    description: 'Neuestes Llama 3.3 mit verbesserter Leistung',
    anonymization: 'excellent',
    deanonymization: 'excellent',
    specialNote: 'Sehr gut für komplexe Anonymisierung',
  },
  // Mistral Modelle
  'mistral:7b': {
    description: 'Effizientes europäisches Modell mit guter Deutschunterstützung',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'mistral-nemo:12b': {
    description: 'Größeres Mistral-Modell mit verbesserter Genauigkeit',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'mixtral:8x7b': {
    description: 'MoE-Modell mit sehr hoher Qualität',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'mixtral:8x22b': {
    description: 'Großes MoE-Modell, beste Qualität bei Mistral',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  // Phi Modelle (Microsoft)
  'phi3:mini': {
    description: 'Microsofts kompaktes Modell, sehr effizient',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'phi3:medium': {
    description: 'Mittleres Phi-3 mit guter Leistung',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'phi4:14b': {
    description: 'Neues Phi-4 Modell mit exzellenter Reasoning-Fähigkeit',
    anonymization: 'excellent',
    deanonymization: 'excellent',
    specialNote: 'Empfohlen für Deanonymisierung',
  },
  // Gemma Modelle (Google)
  'gemma2:2b': {
    description: 'Googles kleines aber fähiges Modell',
    anonymization: 'moderate',
    deanonymization: 'moderate',
  },
  'gemma2:9b': {
    description: 'Mittleres Gemma-Modell mit guter Balance',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'gemma2:27b': {
    description: 'Großes Gemma-Modell mit hoher Qualität',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  // Spezielle NER/Anonymisierungs-Modelle
  'deepseek-r1:1.5b': {
    description: 'DeepSeek R1 Distilled mit starkem Reasoning',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'deepseek-r1:7b': {
    description: 'Mittleres DeepSeek R1 mit exzellentem Reasoning',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'deepseek-r1:14b': {
    description: 'Großes DeepSeek R1 für komplexe Aufgaben',
    anonymization: 'excellent',
    deanonymization: 'excellent',
    specialNote: 'Sehr gut für komplexe Deanonymisierung',
  },
  'deepseek-r1:32b': {
    description: 'Sehr großes DeepSeek R1, beste Reasoning-Qualität',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  'deepseek-r1:70b': {
    description: 'Maximales DeepSeek R1, benötigt viel VRAM',
    anonymization: 'excellent',
    deanonymization: 'excellent',
  },
  // Code-Modelle (weniger geeignet für Anonymisierung)
  'codellama:7b': {
    description: 'Spezialisiert auf Code, weniger für NER geeignet',
    anonymization: 'not_recommended',
    deanonymization: 'moderate',
  },
  'codellama:13b': {
    description: 'Größeres Code-Modell',
    anonymization: 'not_recommended',
    deanonymization: 'moderate',
  },
  'codegemma:7b': {
    description: 'Googles Code-Modell',
    anonymization: 'not_recommended',
    deanonymization: 'moderate',
  },
  'starcoder2:3b': {
    description: 'Code-Modell, nicht für Anonymisierung optimiert',
    anonymization: 'not_recommended',
    deanonymization: 'moderate',
  },
  // Weitere Modelle
  'vicuna:7b': {
    description: 'Älteres aber stabiles Modell',
    anonymization: 'moderate',
    deanonymization: 'moderate',
  },
  'neural-chat:7b': {
    description: 'Intels Chat-optimiertes Modell',
    anonymization: 'good',
    deanonymization: 'good',
  },
  'orca-mini:3b': {
    description: 'Kompaktes Reasoning-Modell',
    anonymization: 'moderate',
    deanonymization: 'moderate',
  },
  'orca2:7b': {
    description: 'Verbessertes Orca mit gutem Reasoning',
    anonymization: 'good',
    deanonymization: 'good',
  },
};

// Empfehlungs-Badge Komponente
const RecommendationBadge = ({
  level,
  type,
}: {
  level: 'excellent' | 'good' | 'moderate' | 'not_recommended';
  type: 'anon' | 'deanon';
}) => {
  const colors = {
    excellent: 'bg-green-500/20 text-green-500 border-green-500/30',
    good: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    moderate: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    not_recommended: 'bg-red-500/20 text-red-500 border-red-500/30',
  };

  const labels = {
    excellent: 'Exzellent',
    good: 'Gut',
    moderate: 'Mäßig',
    not_recommended: 'Nicht empfohlen',
  };

  return (
    <span className={cn('px-1.5 py-0.5 text-[10px] rounded border font-medium', colors[level])}>
      {type === 'anon' ? '🔒' : '🔓'} {labels[level]}
    </span>
  );
};

// Formatiere Modellgröße
const formatSize = (bytes: number): string => {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
};

// Hole Basis-Modellname (ohne Tag-Varianten)
const getBaseModelName = (name: string): string => {
  return name.toLowerCase();
};

// Finde passende Modell-Info
const getModelInfo = (modelName: string) => {
  const baseName = getBaseModelName(modelName);

  // Exakte Übereinstimmung
  if (MODEL_INFO[baseName]) {
    return MODEL_INFO[baseName];
  }

  // Teilübereinstimmung (z.B. "qwen2.5:7b-instruct" -> "qwen2.5:7b")
  for (const key of Object.keys(MODEL_INFO)) {
    if (baseName.startsWith(key) || baseName.includes(key.split(':')[0])) {
      return MODEL_INFO[key];
    }
  }

  // Standard-Info für unbekannte Modelle
  return {
    description: 'Modell-Informationen nicht verfügbar',
    anonymization: 'moderate' as const,
    deanonymization: 'moderate' as const,
  };
};

export function PrivacySection() {
  const privacyGuardEnabled = useAppStore((s) => s.privacyGuardEnabled);
  const privacyGuardModel = useAppStore((s) => s.privacyGuardModel);
  const privacyGuardOllamaUrl = useAppStore((s) => s.privacyGuardOllamaUrl);

  const setPrivacyGuardEnabled = useAppStore((s) => s.setPrivacyGuardEnabled);
  const setPrivacyGuardModel = useAppStore((s) => s.setPrivacyGuardModel);
  const setPrivacyGuardOllamaUrl = useAppStore((s) => s.setPrivacyGuardOllamaUrl);

  // Local state
  const [localOllamaUrl, setLocalOllamaUrl] = useState(privacyGuardOllamaUrl);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState(privacyGuardModel);

  // Lade Modelle wenn Ollama online ist
  const loadOllamaModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const response = await fetch(`${privacyGuardOllamaUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
        setOllamaStatus('online');
      } else {
        setOllamaStatus('offline');
        setAvailableModels([]);
      }
    } catch {
      setOllamaStatus('offline');
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [privacyGuardOllamaUrl]);

  // Check connection und lade Modelle bei Mount/URL-Änderung
  useEffect(() => {
    loadOllamaModels();
  }, [loadOllamaModels]);

  // Speichere Einstellungen (für zukünftige manuelle Speicherfunktion)
  const _handleSaveOllama = () => {
    setPrivacyGuardOllamaUrl(localOllamaUrl);
    setPrivacyGuardModel(selectedModel);
  };

  // Modell-Auswahl Handler
  const handleModelSelect = (modelName: string) => {
    setSelectedModel(modelName);
    setPrivacyGuardModel(modelName);
  };

  // Sortiere Modelle nach Empfehlung für Anonymisierung
  const sortedModels = [...availableModels].sort((a, b) => {
    const infoA = getModelInfo(a.name);
    const infoB = getModelInfo(b.name);

    const rankOrder = { excellent: 0, good: 1, moderate: 2, not_recommended: 3 };
    const rankA = rankOrder[infoA.anonymization];
    const rankB = rankOrder[infoB.anonymization];

    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });

  const StatusBadge = ({ status }: { status: 'checking' | 'online' | 'offline' }) => (
    <span
      className={cn(
        'px-2 py-0.5 text-xs rounded-full',
        status === 'online' && 'bg-green-500/20 text-green-500',
        status === 'offline' && 'bg-red-500/20 text-red-500',
        status === 'checking' && 'bg-yellow-500/20 text-yellow-500'
      )}
    >
      {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Prüfe...'}
    </span>
  );

  const currentModelInfo = getModelInfo(selectedModel);

  return (
    <div className="space-y-6">
      {/* Privacy Guard Section */}
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'border border-border/50',
          'bg-gradient-to-br from-card/80 via-card/70 to-card/80 backdrop-blur-xl',
          'shadow-sm'
        )}
      >
        <div className="p-6 border-b border-border/30 bg-gradient-to-r from-green-500/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center border border-green-500/20">
              <ShieldCheck className="w-5 h-5 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Privacy Guard (Anonymisierung)
            </h2>
          </div>
          <p className="text-sm text-muted-foreground/80 ml-12">
            Lokale Anonymisierung sensibler Daten vor dem Senden an die Cloud-KI.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500/15 to-green-600/10 border border-green-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-green-500" />
              </div>
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor="privacy-guard-toggle"
                  className="font-medium text-foreground cursor-pointer"
                >
                  Lokale Anonymisierung aktivieren
                </Label>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Sensible Daten (E-Mails, Namen, IPs, etc.) werden lokal anonymisiert
                </p>
              </div>
            </div>
            <Switch
              id="privacy-guard-toggle"
              checked={privacyGuardEnabled}
              onCheckedChange={setPrivacyGuardEnabled}
            />
          </div>

          {/* Ollama Settings */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-primary" />
                <span className="font-medium">Ollama Konfiguration</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ollamaStatus} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={loadOllamaModels}
                  disabled={isLoadingModels}
                >
                  <RefreshCw className={cn('w-4 h-4', isLoadingModels && 'animate-spin')} />
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {/* Ollama URL */}
              <div>
                <Label htmlFor="ollama-url" className="text-xs text-muted-foreground">
                  Ollama Server URL
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="ollama-url"
                    value={localOllamaUrl}
                    onChange={(e) => setLocalOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPrivacyGuardOllamaUrl(localOllamaUrl);
                      loadOllamaModels();
                    }}
                  >
                    Verbinden
                  </Button>
                </div>
              </div>

              {/* Model Selection Dropdown */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  KI-Modell für Anonymisierung/Deanonymisierung
                </Label>

                {ollamaStatus === 'online' && availableModels.length > 0 ? (
                  <Select value={selectedModel} onValueChange={handleModelSelect}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Modell auswählen..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      {sortedModels.map((model) => {
                        const info = getModelInfo(model.name);
                        return (
                          <SelectItem key={model.name} value={model.name}>
                            <div className="flex items-center gap-2">
                              {info.anonymization === 'excellent' && (
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                              )}
                              <span className="font-medium">{model.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({formatSize(model.size)})
                              </span>
                              <RecommendationBadge level={info.anonymization} type="anon" />
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      placeholder="qwen2.5:7b"
                      className="flex-1"
                    />
                    {ollamaStatus === 'offline' && (
                      <span className="text-xs text-muted-foreground">
                        (Ollama offline - manuelle Eingabe)
                      </span>
                    )}
                  </div>
                )}

                {/* Selected Model Info */}
                {selectedModel && (
                  <div className="mt-3 p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{selectedModel}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {currentModelInfo.description}
                        </p>
                        {currentModelInfo.specialNote && (
                          <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-500" />
                            {currentModelInfo.specialNote}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              Anonymisierung:
                            </span>
                            <RecommendationBadge
                              level={currentModelInfo.anonymization}
                              type="anon"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              Deanonymisierung:
                            </span>
                            <RecommendationBadge
                              level={currentModelInfo.deanonymization}
                              type="deanon"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modell-Empfehlungen */}
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'border border-border/50',
          'bg-gradient-to-br from-card/80 via-card/70 to-card/80 backdrop-blur-xl',
          'shadow-sm'
        )}
      >
        <div className="p-6 border-b border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Modell-Empfehlungen
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Anonymisierung Empfehlungen */}
          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
            <h3 className="text-sm font-semibold text-green-500 flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4" />
              Beste Modelle für Anonymisierung
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">qwen2.5:7b</span>
                <span className="text-muted-foreground">
                  - Beste Balance aus Geschwindigkeit und Qualität
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="font-medium">mistral-nemo:12b</span>
                <span className="text-muted-foreground">- Sehr gute Deutschunterstützung</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="font-medium">llama3.3:70b</span>
                <span className="text-muted-foreground">
                  - Beste Qualität (viel VRAM erforderlich)
                </span>
              </div>
            </div>
          </div>

          {/* Deanonymisierung Empfehlungen */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <h3 className="text-sm font-semibold text-blue-500 flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4" />
              Beste Modelle für Deanonymisierung
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">phi4:14b</span>
                <span className="text-muted-foreground">
                  - Exzellentes Reasoning für Kontext-Wiederherstellung
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium">deepseek-r1:14b</span>
                <span className="text-muted-foreground">
                  - Starkes Reasoning für komplexe Fälle
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-blue-500" />
                <span className="font-medium">qwen2.5:14b</span>
                <span className="text-muted-foreground">- Gutes Allround-Modell</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
        <p className="text-sm text-muted-foreground">
          <strong className="text-green-500">Privacy Guard</strong> schützt Ihre sensiblen Daten:
        </p>
        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
          <li>E-Mail-Adressen werden durch Platzhalter ersetzt</li>
          <li>Namen und persönliche Daten werden anonymisiert</li>
          <li>IP-Adressen und URLs werden maskiert</li>
          <li>Verarbeitung erfolgt vollständig lokal mit Ollama</li>
          <li>Deanonymisierung stellt den Originalkontext wieder her</li>
        </ul>
      </div>
    </div>
  );
}
