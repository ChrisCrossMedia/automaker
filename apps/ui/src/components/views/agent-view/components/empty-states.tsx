import { Sparkles, Bot, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NoProjectState() {
  return (
    <div
      className="flex-1 flex items-center justify-center bg-background"
      data-testid="agent-view-no-project"
    >
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-3 text-foreground">Kein Projekt ausgewählt</h2>
        <p className="text-muted-foreground leading-relaxed">
          Öffne oder erstelle ein Projekt, um mit dem KI-Agenten zu arbeiten.
        </p>
      </div>
    </div>
  );
}

interface NoSessionStateProps {
  showSessionManager: boolean;
  onShowSessionManager: () => void;
}

export function NoSessionState({ showSessionManager, onShowSessionManager }: NoSessionStateProps) {
  return (
    <div
      className="flex-1 flex items-center justify-center bg-background"
      data-testid="no-session-placeholder"
    >
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
          <Bot className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-3 text-foreground">Keine Sitzung ausgewählt</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Erstelle oder wähle eine Sitzung, um mit dem KI-Agenten zu chatten
        </p>
        <Button onClick={onShowSessionManager} variant="outline" className="gap-2">
          <PanelLeft className="w-4 h-4" />
          {showSessionManager ? 'Sitzungen anzeigen' : 'Sitzungen öffnen'}
        </Button>
      </div>
    </div>
  );
}
