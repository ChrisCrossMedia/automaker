import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { SquareTerminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { TERMINAL_FONT_OPTIONS } from '@/config/terminal-themes';

export function TerminalSection() {
  const {
    terminalState,
    setTerminalDefaultRunScript,
    setTerminalScreenReaderMode,
    setTerminalFontFamily,
    setTerminalScrollbackLines,
    setTerminalLineHeight,
    setTerminalDefaultFontSize,
  } = useAppStore();

  const {
    defaultRunScript,
    screenReaderMode,
    fontFamily,
    scrollbackLines,
    lineHeight,
    defaultFontSize,
  } = terminalState;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
    >
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center border border-green-500/20">
            <SquareTerminal className="w-5 h-5 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Terminal</h2>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-12">
          Terminal-Erscheinung und -Verhalten anpassen. Das Design folgt dem App-Design in den
          Erscheinungsbild-Einstellungen.
        </p>
      </div>
      <div className="p-6 space-y-6">
        {/* Font Family */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Schriftart</Label>
          <select
            value={fontFamily}
            onChange={(e) => {
              setTerminalFontFamily(e.target.value);
              toast.info('Schriftart geändert', {
                description: 'Terminal neu starten, damit Änderungen wirksam werden',
              });
            }}
            className={cn(
              'w-full px-3 py-2 rounded-lg',
              'bg-accent/30 border border-border/50',
              'text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-green-500/30'
            )}
          >
            {TERMINAL_FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default Font Size */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Standard-Schriftgröße</Label>
            <span className="text-sm text-muted-foreground">{defaultFontSize}px</span>
          </div>
          <Slider
            value={[defaultFontSize]}
            min={8}
            max={32}
            step={1}
            onValueChange={([value]) => setTerminalDefaultFontSize(value)}
            className="flex-1"
          />
        </div>

        {/* Line Height */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Zeilenhöhe</Label>
            <span className="text-sm text-muted-foreground">{lineHeight.toFixed(1)}</span>
          </div>
          <Slider
            value={[lineHeight]}
            min={1.0}
            max={2.0}
            step={0.1}
            onValueChange={([value]) => {
              setTerminalLineHeight(value);
            }}
            onValueCommit={() => {
              toast.info('Zeilenhöhe geändert', {
                description: 'Terminal neu starten, damit Änderungen wirksam werden',
              });
            }}
            className="flex-1"
          />
        </div>

        {/* Scrollback Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Scrollback-Puffer</Label>
            <span className="text-sm text-muted-foreground">
              {(scrollbackLines / 1000).toFixed(0)}k Zeilen
            </span>
          </div>
          <Slider
            value={[scrollbackLines]}
            min={1000}
            max={100000}
            step={1000}
            onValueChange={([value]) => setTerminalScrollbackLines(value)}
            onValueCommit={() => {
              toast.info('Scrollback geändert', {
                description: 'Terminal neu starten, damit Änderungen wirksam werden',
              });
            }}
            className="flex-1"
          />
        </div>

        {/* Default Run Script */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Standard-Startskript</Label>
          <p className="text-xs text-muted-foreground">
            Befehl, der beim Öffnen eines neuen Terminals automatisch ausgeführt wird (z.B.
            "claude", "codex")
          </p>
          <Input
            value={defaultRunScript}
            onChange={(e) => setTerminalDefaultRunScript(e.target.value)}
            placeholder="z.B. claude, codex, npm run dev"
            className="bg-accent/30 border-border/50"
          />
        </div>

        {/* Screen Reader Mode */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Screenreader-Modus</Label>
            <p className="text-xs text-muted-foreground">
              Barrierefreiheitsmodus für Screenreader aktivieren
            </p>
          </div>
          <Switch
            checked={screenReaderMode}
            onCheckedChange={(checked) => {
              setTerminalScreenReaderMode(checked);
              toast.success(
                checked ? 'Screenreader-Modus aktiviert' : 'Screenreader-Modus deaktiviert',
                {
                  description: 'Terminal neu starten, damit Änderungen wirksam werden',
                }
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
