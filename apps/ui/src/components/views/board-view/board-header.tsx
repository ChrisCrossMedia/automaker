import { useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bot, Wand2, Settings2, GitBranch, Cloud, Server, Shuffle } from 'lucide-react';
import { UsagePopover } from '@/components/usage-popover';
import { useAppStore } from '@/store/app-store';
import { useSetupStore } from '@/store/setup-store';
import { AutoModeSettingsDialog } from './dialogs/auto-mode-settings-dialog';
import { WorktreeSettingsDialog } from './dialogs/worktree-settings-dialog';
import { PlanSettingsDialog } from './dialogs/plan-settings-dialog';
import { getHttpApiClient } from '@/lib/http-api-client';
import { BoardSearchBar } from './board-search-bar';
import { BoardControls } from './board-controls';
import { LLMModeBadge } from '../settings-view/llm-mode';

interface BoardHeaderProps {
  projectPath: string;
  maxConcurrency: number;
  runningAgentsCount: number;
  onConcurrencyChange: (value: number) => void;
  isAutoModeRunning: boolean;
  onAutoModeToggle: (enabled: boolean) => void;
  onOpenPlanDialog: () => void;
  isMounted: boolean;
  // Search bar props
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isCreatingSpec: boolean;
  creatingSpecProjectPath?: string;
  // Board controls props
  onShowBoardBackground: () => void;
  onShowCompletedModal: () => void;
  completedCount: number;
}

// Shared styles for header control containers
const controlContainerClass =
  'flex items-center gap-1.5 px-3 h-8 rounded-md bg-secondary border border-border';

export function BoardHeader({
  projectPath,
  maxConcurrency,
  runningAgentsCount,
  onConcurrencyChange,
  isAutoModeRunning,
  onAutoModeToggle,
  onOpenPlanDialog,
  isMounted,
  searchQuery,
  onSearchChange,
  isCreatingSpec,
  creatingSpecProjectPath,
  onShowBoardBackground,
  onShowCompletedModal,
  completedCount,
}: BoardHeaderProps) {
  const [showAutoModeSettings, setShowAutoModeSettings] = useState(false);
  const [showWorktreeSettings, setShowWorktreeSettings] = useState(false);
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const apiKeys = useAppStore((state) => state.apiKeys);
  const claudeAuthStatus = useSetupStore((state) => state.claudeAuthStatus);
  const skipVerificationInAutoMode = useAppStore((state) => state.skipVerificationInAutoMode);
  const setSkipVerificationInAutoMode = useAppStore((state) => state.setSkipVerificationInAutoMode);
  const planUseSelectedWorktreeBranch = useAppStore((state) => state.planUseSelectedWorktreeBranch);
  const setPlanUseSelectedWorktreeBranch = useAppStore(
    (state) => state.setPlanUseSelectedWorktreeBranch
  );
  const addFeatureUseSelectedWorktreeBranch = useAppStore(
    (state) => state.addFeatureUseSelectedWorktreeBranch
  );
  const setAddFeatureUseSelectedWorktreeBranch = useAppStore(
    (state) => state.setAddFeatureUseSelectedWorktreeBranch
  );
  const codexAuthStatus = useSetupStore((state) => state.codexAuthStatus);

  // LLM Mode
  const llmMode = useAppStore((state) => state.llmMode);
  const setLlmMode = useAppStore((state) => state.setLlmMode);

  // Worktree panel visibility (per-project)
  const worktreePanelVisibleByProject = useAppStore((state) => state.worktreePanelVisibleByProject);
  const setWorktreePanelVisible = useAppStore((state) => state.setWorktreePanelVisible);
  const isWorktreePanelVisible = worktreePanelVisibleByProject[projectPath] ?? true;

  const handleWorktreePanelToggle = useCallback(
    async (visible: boolean) => {
      // Update local store
      setWorktreePanelVisible(projectPath, visible);

      // Persist to server
      try {
        const httpClient = getHttpApiClient();
        await httpClient.settings.updateProject(projectPath, {
          worktreePanelVisible: visible,
        });
      } catch (error) {
        console.error('Failed to persist worktree panel visibility:', error);
      }
    },
    [projectPath, setWorktreePanelVisible]
  );

  // Claude usage tracking visibility logic
  // Hide when using API key (only show for Claude Code CLI users)
  // Also hide on Windows for now (CLI usage command not supported)
  const isWindows =
    typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('win');
  const hasClaudeApiKey = !!apiKeys.anthropic || !!claudeAuthStatus?.hasEnvApiKey;
  const isClaudeCliVerified =
    claudeAuthStatus?.authenticated && claudeAuthStatus?.method === 'cli_authenticated';
  const showClaudeUsage = !hasClaudeApiKey && !isWindows && isClaudeCliVerified;

  // Codex usage tracking visibility logic
  // Show if Codex is authenticated (CLI or API key)
  const showCodexUsage = !!codexAuthStatus?.authenticated;

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-glass backdrop-blur-md">
      <div className="flex items-center gap-4">
        <BoardSearchBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          isCreatingSpec={isCreatingSpec}
          creatingSpecProjectPath={creatingSpecProjectPath}
          currentProjectPath={projectPath}
        />
        <BoardControls
          isMounted={isMounted}
          onShowBoardBackground={onShowBoardBackground}
          onShowCompletedModal={onShowCompletedModal}
          completedCount={completedCount}
        />
      </div>
      <div className="flex gap-2 items-center">
        {/* LLM Mode Selector */}
        {isMounted && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`${controlContainerClass} cursor-pointer hover:bg-accent/50 transition-colors`}
                data-testid="llm-mode-container"
              >
                <LLMModeBadge mode={llmMode} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm mb-1">LLM-Modus</h4>
                  <p className="text-xs text-muted-foreground">
                    Wechsel jederzeit zwischen Cloud, Mixed und Lokal. Der Kontext bleibt erhalten.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLlmMode('cloud')}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      llmMode === 'cloud'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-border hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Cloud
                        className={`w-5 h-5 ${llmMode === 'cloud' ? 'text-blue-400' : 'text-muted-foreground'}`}
                      />
                      <span
                        className={`text-xs font-medium ${llmMode === 'cloud' ? 'text-blue-400' : ''}`}
                      >
                        Cloud
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setLlmMode('mixed')}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      llmMode === 'mixed'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-border hover:border-purple-500/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Shuffle
                        className={`w-5 h-5 ${llmMode === 'mixed' ? 'text-purple-400' : 'text-muted-foreground'}`}
                      />
                      <span
                        className={`text-xs font-medium ${llmMode === 'mixed' ? 'text-purple-400' : ''}`}
                      >
                        Mixed
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setLlmMode('local')}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      llmMode === 'local'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-border hover:border-green-500/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Server
                        className={`w-5 h-5 ${llmMode === 'local' ? 'text-green-400' : 'text-muted-foreground'}`}
                      />
                      <span
                        className={`text-xs font-medium ${llmMode === 'local' ? 'text-green-400' : ''}`}
                      >
                        Lokal
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Usage Popover - show if either provider is authenticated */}
        {isMounted && (showClaudeUsage || showCodexUsage) && <UsagePopover />}

        {/* Worktrees Toggle - only show after mount to prevent hydration issues */}
        {isMounted && (
          <div className={controlContainerClass} data-testid="worktrees-toggle-container">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="worktrees-toggle" className="text-sm font-medium cursor-pointer">
              Worktrees
            </Label>
            <Switch
              id="worktrees-toggle"
              checked={isWorktreePanelVisible}
              onCheckedChange={handleWorktreePanelToggle}
              data-testid="worktrees-toggle"
            />
            <button
              onClick={() => setShowWorktreeSettings(true)}
              className="p-1 rounded hover:bg-accent/50 transition-colors"
              title="Worktree-Einstellungen"
              data-testid="worktree-settings-button"
            >
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Worktree Settings Dialog */}
        <WorktreeSettingsDialog
          open={showWorktreeSettings}
          onOpenChange={setShowWorktreeSettings}
          addFeatureUseSelectedWorktreeBranch={addFeatureUseSelectedWorktreeBranch}
          onAddFeatureUseSelectedWorktreeBranchChange={setAddFeatureUseSelectedWorktreeBranch}
        />

        {/* Concurrency Control - only show after mount to prevent hydration issues */}
        {isMounted && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`${controlContainerClass} cursor-pointer hover:bg-accent/50 transition-colors`}
                data-testid="concurrency-slider-container"
              >
                <Bot className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Agenten</span>
                <span className="text-sm text-muted-foreground" data-testid="concurrency-value">
                  {runningAgentsCount}/{maxConcurrency}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Max. parallele Agenten</h4>
                  <p className="text-xs text-muted-foreground">
                    Steuert, wie viele KI-Agenten gleichzeitig laufen können. Höhere Werte
                    verarbeiten mehr Features parallel, verbrauchen aber mehr API-Ressourcen.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[maxConcurrency]}
                    onValueChange={(value) => onConcurrencyChange(value[0])}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                    data-testid="concurrency-slider"
                  />
                  <span className="text-sm font-medium min-w-[2ch] text-right">
                    {maxConcurrency}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Auto Mode Toggle - only show after mount to prevent hydration issues */}
        {isMounted && (
          <div className={controlContainerClass} data-testid="auto-mode-toggle-container">
            <Label htmlFor="auto-mode-toggle" className="text-sm font-medium cursor-pointer">
              Auto-Modus
            </Label>
            <Switch
              id="auto-mode-toggle"
              checked={isAutoModeRunning}
              onCheckedChange={onAutoModeToggle}
              data-testid="auto-mode-toggle"
            />
            <button
              onClick={() => setShowAutoModeSettings(true)}
              className="p-1 rounded hover:bg-accent/50 transition-colors"
              title="Auto-Modus Einstellungen"
              data-testid="auto-mode-settings-button"
            >
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Auto Mode Settings Dialog */}
        <AutoModeSettingsDialog
          open={showAutoModeSettings}
          onOpenChange={setShowAutoModeSettings}
          skipVerificationInAutoMode={skipVerificationInAutoMode}
          onSkipVerificationChange={setSkipVerificationInAutoMode}
        />

        {/* Plan Button with Settings */}
        <div className={controlContainerClass} data-testid="plan-button-container">
          <button
            onClick={onOpenPlanDialog}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            data-testid="plan-backlog-button"
          >
            <Wand2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Planen</span>
          </button>
          <button
            onClick={() => setShowPlanSettings(true)}
            className="p-1 rounded hover:bg-accent/50 transition-colors"
            title="Plan-Einstellungen"
            data-testid="plan-settings-button"
          >
            <Settings2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Plan Settings Dialog */}
        <PlanSettingsDialog
          open={showPlanSettings}
          onOpenChange={setShowPlanSettings}
          planUseSelectedWorktreeBranch={planUseSelectedWorktreeBranch}
          onPlanUseSelectedWorktreeBranchChange={setPlanUseSelectedWorktreeBranch}
        />
      </div>
    </div>
  );
}
