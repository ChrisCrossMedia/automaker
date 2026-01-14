import {
  Bot,
  PanelLeftClose,
  PanelLeft,
  Wrench,
  Trash2,
  Cloud,
  Server,
  Shuffle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/store/app-store';
import { LLMModeBadge } from '../../settings-view/llm-mode';

interface AgentHeaderProps {
  projectName: string;
  currentSessionId: string | null;
  isConnected: boolean;
  isProcessing: boolean;
  currentTool: string | null;
  messagesCount: number;
  showSessionManager: boolean;
  onToggleSessionManager: () => void;
  onClearChat: () => void;
}

export function AgentHeader({
  projectName,
  currentSessionId,
  isConnected,
  isProcessing,
  currentTool,
  messagesCount,
  showSessionManager,
  onToggleSessionManager,
  onClearChat,
}: AgentHeaderProps) {
  const llmMode = useAppStore((state) => state.llmMode);
  const setLlmMode = useAppStore((state) => state.setLlmMode);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSessionManager}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          {showSessionManager ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </Button>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">KI-Agent</h1>
          <p className="text-sm text-muted-foreground">
            {projectName}
            {currentSessionId && !isConnected && ' - Verbinde...'}
          </p>
        </div>
      </div>

      {/* Status indicators & actions */}
      <div className="flex items-center gap-3">
        {/* LLM Mode Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="cursor-pointer hover:opacity-80 transition-opacity">
              <LLMModeBadge mode={llmMode} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">LLM-Modus wechseln</h4>
                <p className="text-xs text-muted-foreground">
                  Der Kontext bleibt erhalten. Du kannst jederzeit wechseln.
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

        {currentTool && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border">
            <Wrench className="w-3 h-3 text-primary" />
            <span className="font-medium">{currentTool}</span>
          </div>
        )}
        {currentSessionId && messagesCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Löschen
          </Button>
        )}
      </div>
    </div>
  );
}
