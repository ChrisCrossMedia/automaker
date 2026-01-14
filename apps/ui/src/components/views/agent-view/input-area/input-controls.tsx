import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Square,
  ListOrdered,
  ShieldCheck,
  ShieldOff,
  Scale,
  Users,
  Sparkles,
  ChevronDown,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AgentModelSelector } from '../shared/agent-model-selector';
import { useAppStore } from '@/store/app-store';
import type { PhaseModelEntry } from '@automaker/types';

interface InputControlsProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onToggleImageDropZone: () => void;
  onPaste: (e: React.ClipboardEvent) => Promise<void>;
  /** Current model selection (model + optional thinking level) */
  modelSelection: PhaseModelEntry;
  /** Callback when model is selected */
  onModelSelect: (entry: PhaseModelEntry) => void;
  isProcessing: boolean;
  isConnected: boolean;
  hasFiles: boolean;
  isDragOver: boolean;
  showImageDropZone: boolean;
  // Drag handlers
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;
  // Refs
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function InputControls({
  input,
  onInputChange,
  onSend,
  onStop,
  onToggleImageDropZone,
  onPaste,
  modelSelection,
  onModelSelect,
  isProcessing,
  isConnected,
  hasFiles,
  isDragOver,
  showImageDropZone,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  inputRef: externalInputRef,
}: InputControlsProps) {
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;

  // Privacy Guard state
  const privacyGuardEnabled = useAppStore((s) => s.privacyGuardEnabled);
  const setPrivacyGuardEnabled = useAppStore((s) => s.setPrivacyGuardEnabled);

  // Prompt Optimization (RAG) state
  const megabrainRagEnabled = useAppStore((s) => s.megabrainRagEnabled);
  const setMegabrainRagEnabled = useAppStore((s) => s.setMegabrainRagEnabled);

  // Advocatus Diaboli state
  const megabrainAdvocatusEnabled = useAppStore((s) => s.megabrainAdvocatusEnabled);
  const setMegabrainAdvocatusEnabled = useAppStore((s) => s.setMegabrainAdvocatusEnabled);

  // Expert Opinions state
  const megabrainExpertsEnabled = useAppStore((s) => s.megabrainExpertsEnabled);
  const setMegabrainExpertsEnabled = useAppStore((s) => s.setMegabrainExpertsEnabled);

  // Enhancement Mode state
  const selectedEnhancementMode = useAppStore((s) => s.selectedEnhancementMode);
  const setSelectedEnhancementMode = useAppStore((s) => s.setSelectedEnhancementMode);
  const [enhancementPopoverOpen, setEnhancementPopoverOpen] = useState(false);

  const enhancementModes = [
    { id: null, label: 'Aus', description: 'Keine Prompt-Optimierung' },
    { id: 'improve' as const, label: 'Verbessern', description: 'Vage Anfragen klar formulieren' },
    { id: 'technical' as const, label: 'Technisch', description: 'Technische Details hinzufügen' },
    { id: 'simplify' as const, label: 'Vereinfachen', description: 'Beschreibungen kürzen' },
    {
      id: 'acceptance' as const,
      label: 'Akzeptanzkriterien',
      description: 'Testbare Kriterien hinzufügen',
    },
    { id: 'ux' as const, label: 'UX-Review', description: 'UX-Perspektive einbeziehen' },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [inputRef]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const canSend = (input.trim() || hasFiles) && isConnected;

  return (
    <>
      {/* Text Input and Controls */}
      <div
        className={cn(
          'flex gap-2 transition-all duration-200 rounded-xl p-1',
          isDragOver && 'bg-primary/5 ring-2 ring-primary/30'
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="flex-1 relative">
          <Textarea
            ref={inputRef}
            placeholder={
              isDragOver
                ? 'Dateien hier ablegen...'
                : isProcessing
                  ? 'Nächste Anfrage eingeben...'
                  : 'Beschreibe, was du entwickeln möchtest...'
            }
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            disabled={!isConnected}
            data-testid="agent-input"
            rows={1}
            className={cn(
              'min-h-11 bg-background border-border rounded-xl pl-4 pr-20 text-sm transition-all resize-none max-h-36 overflow-y-auto py-2.5',
              'focus:ring-2 focus:ring-primary/20 focus:border-primary/50',
              hasFiles && 'border-primary/30',
              isDragOver && 'border-primary bg-primary/5'
            )}
          />
          {hasFiles && !isDragOver && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
              Dateien angehängt
            </div>
          )}
          {isDragOver && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-primary font-medium">
              <Paperclip className="w-3 h-3" />
              Hier ablegen
            </div>
          )}
        </div>

        {/* Model Selector */}
        <AgentModelSelector
          value={modelSelection}
          onChange={onModelSelect}
          disabled={!isConnected}
        />

        {/* File Attachment Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleImageDropZone}
          disabled={!isConnected}
          className={cn(
            'h-11 w-11 rounded-xl border-border',
            showImageDropZone && 'bg-primary/10 text-primary border-primary/30',
            hasFiles && 'border-primary/30 text-primary'
          )}
          title="Dateien anhängen (Bilder, .txt, .md)"
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        {/* VDB RAG Toggle - Wissen aus VDB in Antworten */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMegabrainRagEnabled(!megabrainRagEnabled)}
          disabled={!isConnected}
          className={cn(
            'h-11 w-11 rounded-xl border-border',
            megabrainRagEnabled && 'bg-blue-500/10 text-blue-500 border-blue-500/30'
          )}
          title={
            megabrainRagEnabled
              ? 'VDB-Wissen aktiv - Relevantes Wissen aus der VDB wird in Antworten einbezogen'
              : 'VDB-Wissen deaktiviert - Klicken um VDB-Kontext zu aktivieren'
          }
        >
          {megabrainRagEnabled ? (
            <Database className="w-4 h-4" />
          ) : (
            <Database className="w-4 h-4 opacity-50" />
          )}
        </Button>

        {/* Enhancement Mode Dropdown */}
        <Popover open={enhancementPopoverOpen} onOpenChange={setEnhancementPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={!isConnected}
              className={cn(
                'h-11 px-3 rounded-xl border-border gap-1.5',
                selectedEnhancementMode && 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30'
              )}
              title="Prompt-Optimierung wählen"
            >
              <Sparkles className={cn('w-4 h-4', !selectedEnhancementMode && 'opacity-50')} />
              <ChevronDown className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 pb-1">
                Prompt-Optimierung
              </p>
              {enhancementModes.map((mode) => (
                <button
                  key={mode.id ?? 'off'}
                  onClick={() => {
                    setSelectedEnhancementMode(mode.id);
                    setEnhancementPopoverOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedEnhancementMode === mode.id
                      ? 'bg-cyan-500/10 text-cyan-500'
                      : 'hover:bg-accent'
                  )}
                >
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">{mode.description}</div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Privacy Guard Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPrivacyGuardEnabled(!privacyGuardEnabled)}
          disabled={!isConnected}
          className={cn(
            'h-11 w-11 rounded-xl border-border',
            privacyGuardEnabled && 'bg-green-500/10 text-green-500 border-green-500/30'
          )}
          title={
            privacyGuardEnabled
              ? 'Anonymisierung aktiv - Sensible Daten werden lokal anonymisiert'
              : 'Anonymisierung deaktiviert - Klicken zum Aktivieren'
          }
        >
          {privacyGuardEnabled ? (
            <ShieldCheck className="w-4 h-4" />
          ) : (
            <ShieldOff className="w-4 h-4" />
          )}
        </Button>

        {/* Advocatus Diaboli Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMegabrainAdvocatusEnabled(!megabrainAdvocatusEnabled)}
          disabled={!isConnected}
          className={cn(
            'h-11 w-11 rounded-xl border-border',
            megabrainAdvocatusEnabled && 'bg-purple-500/10 text-purple-500 border-purple-500/30'
          )}
          title={
            megabrainAdvocatusEnabled
              ? 'Advocatus Diaboli aktiv - Kritische Analyse vor jeder Änderung (10/10 Qualität)'
              : 'Advocatus Diaboli deaktiviert - Klicken für kritische Code-Review'
          }
        >
          <Scale className={cn('w-4 h-4', !megabrainAdvocatusEnabled && 'opacity-50')} />
        </Button>

        {/* Expert Opinions Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMegabrainExpertsEnabled(!megabrainExpertsEnabled)}
          disabled={!isConnected}
          className={cn(
            'h-11 w-11 rounded-xl border-border',
            megabrainExpertsEnabled && 'bg-amber-500/10 text-amber-500 border-amber-500/30'
          )}
          title={
            megabrainExpertsEnabled
              ? 'Expertenmeinungen aktiv - VDB-Experten werden in Antworten einbezogen'
              : 'Expertenmeinungen deaktiviert - Klicken für Expertenintegration'
          }
        >
          <Users className={cn('w-4 h-4', !megabrainExpertsEnabled && 'opacity-50')} />
        </Button>

        {/* Stop Button (only when processing) */}
        {isProcessing && (
          <Button
            onClick={onStop}
            disabled={!isConnected}
            className="h-11 px-4 rounded-xl"
            variant="destructive"
            data-testid="stop-agent"
            title="Generierung stoppen"
          >
            <Square className="w-4 h-4 fill-current" />
          </Button>
        )}

        {/* Send / Queue Button */}
        <Button
          onClick={onSend}
          disabled={!canSend}
          className="h-11 px-4 rounded-xl"
          variant={isProcessing ? 'outline' : 'default'}
          data-testid="send-message"
          title={isProcessing ? 'Zur Warteschlange hinzufügen' : 'Nachricht senden'}
        >
          {isProcessing ? <ListOrdered className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* Keyboard hint */}
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">Enter</kbd> zum
        Senden,{' '}
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">Shift+Enter</kbd>{' '}
        für neue Zeile
      </p>
    </>
  );
}
