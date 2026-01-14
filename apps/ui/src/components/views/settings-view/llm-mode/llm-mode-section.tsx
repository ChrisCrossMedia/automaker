/**
 * LLM Mode Section - Auswahl zwischen Cloud, Lokal und Mixed-Modus
 * Mit Privacy Guard Integration für alle Modi
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, RefreshCw, AlertTriangle } from 'lucide-react';

import type { OllamaModel, DownloadProgress } from './llm-mode-types';
import { RECOMMENDED_MODELS } from './llm-mode-constants';
import { downloadModel, getMissingModels } from './llm-mode-utils';

// Neue modulare Komponenten
import { LlmModeButtons, ModeDescription } from './llm-mode-buttons';
import { LlmModeDownload } from './llm-mode-download';
import { LlmModeLocalConfig } from './llm-mode-local-config';
import { LlmModeMixedConfig } from './llm-mode-mixed-config';
import { LlmModePrivacy } from './llm-mode-privacy';
import { ModelDefaultsSection } from '../model-defaults';
import { FeatureDefaultsSection } from '../feature-defaults/feature-defaults-section';

export function LlmModeSection() {
  const {
    llmMode,
    setLlmMode,
    localPhaseModels,
    setLocalPhaseModel,
    mixedModeConfig,
    setMixedModeConfig,
    ollamaUrl,
    // Privacy Guard
    privacyGuardEnabled,
    setPrivacyGuardEnabled,
    privacyGuardModel,
    setPrivacyGuardModel,
    // Feature-Standards (für Cloud-Modus)
    defaultSkipTests,
    setDefaultSkipTests,
    enableDependencyBlocking,
    setEnableDependencyBlocking,
    skipVerificationInAutoMode,
    setSkipVerificationInAutoMode,
    defaultPlanningMode,
    setDefaultPlanningMode,
    defaultRequirePlanApproval,
    setDefaultRequirePlanApproval,
  } = useAppStore();

  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
  const previousModelsRef = useRef<string>('');

  // Lade Ollama-Modelle
  const loadModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      if (!response.ok) throw new Error('Ollama nicht erreichbar');
      const data = await response.json();
      const modelList = (data.models || []) as OllamaModel[];

      const modelNames = modelList
        .map((m) => m.name)
        .sort()
        .join(',');
      if (modelNames !== previousModelsRef.current) {
        previousModelsRef.current = modelNames;
        setModels(modelList.sort((a, b) => a.size - b.size));
      }

      setLastRefresh(new Date());
    } catch {
      setError('Ollama nicht erreichbar. Bitte starte Ollama.');
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [ollamaUrl]);

  useEffect(() => {
    loadModels();
    const interval = setInterval(loadModels, 10000);
    return () => clearInterval(interval);
  }, [loadModels]);

  // Download Handler
  const handleDownload = async (modelName: string) => {
    setDownloadProgress((prev) => ({
      ...prev,
      [modelName]: { model: modelName, status: 'pending', progress: 0 },
    }));

    await downloadModel(modelName, ollamaUrl, (progress) => {
      setDownloadProgress((prev) => ({ ...prev, [modelName]: progress }));
    });

    // Nach Download Modelle neu laden
    await loadModels();
  };

  const missingModels = getMissingModels(models, RECOMMENDED_MODELS);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            <CardTitle>LLM-Modus</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Aktualisiert: {lastRefresh.toLocaleTimeString('de-DE')}
              </span>
            )}
            <button
              onClick={loadModels}
              disabled={loading}
              className="p-1 hover:bg-accent rounded"
              title="Modelle neu laden"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <CardDescription>
          Wähle zwischen Cloud-LLM (Claude API), lokalen LLMs (Ollama) oder Mixed-Modus
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 3 große Mode-Buttons */}
        <LlmModeButtons llmMode={llmMode} setLlmMode={setLlmMode} />

        {/* Modus-Beschreibung */}
        <ModeDescription llmMode={llmMode} />

        {/* Fehler-Anzeige */}
        {error && llmMode !== 'cloud' && (
          <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 rounded-lg text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Privacy Guard - IMMER sichtbar (auch bei Cloud-Modus) */}
        <div className="border-t border-border pt-4">
          <LlmModePrivacy
            privacyGuardEnabled={privacyGuardEnabled}
            setPrivacyGuardEnabled={setPrivacyGuardEnabled}
            privacyGuardModel={privacyGuardModel}
            setPrivacyGuardModel={setPrivacyGuardModel}
            ollamaUrl={ollamaUrl}
            llmMode={llmMode}
          />
        </div>

        {/* Download-Sektion für fehlende Modelle - nur bei Mixed/Local */}
        {llmMode !== 'cloud' && missingModels.length > 0 && (
          <LlmModeDownload
            models={models}
            downloadProgress={downloadProgress}
            onDownload={handleDownload}
          />
        )}

        {/* Lokale Modell-Konfiguration */}
        {llmMode === 'local' && (
          <LlmModeLocalConfig
            models={models}
            localPhaseModels={localPhaseModels}
            setLocalPhaseModel={setLocalPhaseModel}
          />
        )}

        {/* Mixed-Mode Konfiguration */}
        {llmMode === 'mixed' && (
          <LlmModeMixedConfig
            models={models}
            mixedModeConfig={mixedModeConfig}
            setMixedModeConfig={setMixedModeConfig}
            localPhaseModels={localPhaseModels}
            setLocalPhaseModel={setLocalPhaseModel}
          />
        )}

        {/* Cloud-Modus: Modell-Standards und Feature-Standards */}
        {llmMode === 'cloud' && (
          <>
            <div className="border-t border-border pt-6">
              <ModelDefaultsSection />
            </div>
            <div className="border-t border-border pt-6">
              <FeatureDefaultsSection
                defaultSkipTests={defaultSkipTests}
                enableDependencyBlocking={enableDependencyBlocking}
                skipVerificationInAutoMode={skipVerificationInAutoMode}
                defaultPlanningMode={defaultPlanningMode}
                defaultRequirePlanApproval={defaultRequirePlanApproval}
                onDefaultSkipTestsChange={setDefaultSkipTests}
                onEnableDependencyBlockingChange={setEnableDependencyBlocking}
                onSkipVerificationInAutoModeChange={setSkipVerificationInAutoMode}
                onDefaultPlanningModeChange={setDefaultPlanningMode}
                onDefaultRequirePlanApprovalChange={setDefaultRequirePlanApproval}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
