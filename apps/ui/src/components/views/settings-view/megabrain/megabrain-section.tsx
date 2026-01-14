import { useState, useEffect } from 'react';
import {
  Brain,
  Server,
  Sparkles,
  Scale,
  Zap,
  Database,
  RefreshCw,
  Play,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';

export function MegabrainSection() {
  // MEGABRAIN Settings
  const megabrainEnabled = useAppStore((s) => s.megabrainEnabled);
  const megabrainApiUrl = useAppStore((s) => s.megabrainApiUrl);
  const megabrainWsUrl = useAppStore((s) => s.megabrainWsUrl);
  const megabrainRagEnabled = useAppStore((s) => s.megabrainRagEnabled);
  const megabrainSkillsEnabled = useAppStore((s) => s.megabrainSkillsEnabled);
  const megabrainAdvocatusEnabled = useAppStore((s) => s.megabrainAdvocatusEnabled);

  // VDB Settings (shared with MEGABRAIN)
  const vdbUrl = useAppStore((s) => s.vdbUrl);
  const vdbCollection = useAppStore((s) => s.vdbCollection);

  // MEGABRAIN Setters
  const setMegabrainEnabled = useAppStore((s) => s.setMegabrainEnabled);
  const setMegabrainApiUrl = useAppStore((s) => s.setMegabrainApiUrl);
  const setMegabrainWsUrl = useAppStore((s) => s.setMegabrainWsUrl);
  const setMegabrainRagEnabled = useAppStore((s) => s.setMegabrainRagEnabled);
  const setMegabrainSkillsEnabled = useAppStore((s) => s.setMegabrainSkillsEnabled);
  const setMegabrainAdvocatusEnabled = useAppStore((s) => s.setMegabrainAdvocatusEnabled);
  const setVdbUrl = useAppStore((s) => s.setVdbUrl);
  const setVdbCollection = useAppStore((s) => s.setVdbCollection);

  // Local state for inputs
  const [localMegabrainApiUrl, setLocalMegabrainApiUrl] = useState(megabrainApiUrl);
  const [localMegabrainWsUrl, setLocalMegabrainWsUrl] = useState(megabrainWsUrl);
  const [localVdbUrl, setLocalVdbUrl] = useState(vdbUrl);
  const [localVdbCollection, setLocalVdbCollection] = useState(vdbCollection);

  // Connection status
  const [megabrainStatus, setMegabrainStatus] = useState<'checking' | 'online' | 'offline'>(
    'checking'
  );
  const [vdbStatus, setVdbStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isStarting, setIsStarting] = useState(false);
  const [startMessage, setStartMessage] = useState<string | null>(null);

  // Synchronisiere lokale States mit Store-Werten (wichtig beim Laden gespeicherter Settings)
  useEffect(() => {
    setLocalMegabrainApiUrl(megabrainApiUrl);
  }, [megabrainApiUrl]);

  useEffect(() => {
    setLocalMegabrainWsUrl(megabrainWsUrl);
  }, [megabrainWsUrl]);

  useEffect(() => {
    setLocalVdbUrl(vdbUrl);
  }, [vdbUrl]);

  useEffect(() => {
    setLocalVdbCollection(vdbCollection);
  }, [vdbCollection]);

  // Check connections on mount and when URLs change
  useEffect(() => {
    checkMegabrainConnection();
  }, [megabrainApiUrl]);

  useEffect(() => {
    checkVdbConnection();
  }, [vdbUrl]);

  const checkMegabrainConnection = async () => {
    setMegabrainStatus('checking');
    try {
      // Verwende Automaker-Server als Proxy um CORS zu umgehen
      // Der Server leitet die Anfrage an MEGABRAIN weiter
      // In Electron: UI läuft auf 3007, Server auf 3008 - verwende vollständige URL
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3008';
      const baseUrl = `http://localhost:${serverPort}`;
      const response = await fetch(`${baseUrl}/api/megabrain/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setMegabrainStatus(data.success && data.status === 'online' ? 'online' : 'offline');
      } else {
        setMegabrainStatus('offline');
      }
    } catch {
      setMegabrainStatus('offline');
    }
  };

  const checkVdbConnection = async () => {
    setVdbStatus('checking');
    try {
      const response = await fetch(`${vdbUrl}/collections`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      setVdbStatus(response.ok ? 'online' : 'offline');
    } catch {
      setVdbStatus('offline');
    }
  };

  const startMegabrain = async () => {
    setIsStarting(true);
    setStartMessage(null);
    try {
      const serverPort = import.meta.env.VITE_SERVER_PORT || '3008';
      const baseUrl = `http://localhost:${serverPort}`;
      const response = await fetch(`${baseUrl}/api/megabrain/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000), // 60s Timeout für Start
      });

      const data = await response.json();

      if (data.success) {
        setMegabrainStatus('online');
        setStartMessage(data.message || 'MEGABRAIN gestartet');
        // Aktualisiere VDB-Status falls in Antwort enthalten
        if (data.vdb_available !== undefined) {
          setVdbStatus(data.vdb_available ? 'online' : 'offline');
        }
      } else {
        setStartMessage(data.message || 'Start fehlgeschlagen');
      }
    } catch (error) {
      setStartMessage(error instanceof Error ? error.message : 'Verbindungsfehler');
    } finally {
      setIsStarting(false);
      // Nach 5 Sekunden Nachricht ausblenden
      setTimeout(() => setStartMessage(null), 5000);
    }
  };

  const handleSaveMegabrain = () => {
    setMegabrainApiUrl(localMegabrainApiUrl);
    setMegabrainWsUrl(localMegabrainWsUrl);
  };

  const handleSaveVdb = () => {
    setVdbUrl(localVdbUrl);
    setVdbCollection(localVdbCollection);
  };

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

  return (
    <div className="space-y-6">
      {/* MEGABRAIN Header */}
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'border border-border/50',
          'bg-gradient-to-br from-card/80 via-card/70 to-card/80 backdrop-blur-xl',
          'shadow-sm'
        )}
      >
        <div className="p-6 border-b border-border/30 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/20">
              <Brain className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">MEGABRAIN 8</h2>
              <p className="text-sm text-muted-foreground/80">
                Erweiterte KI-Fähigkeiten für Automaker
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Master Enable Toggle */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-purple-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor="megabrain-toggle"
                  className="font-medium text-foreground cursor-pointer"
                >
                  MEGABRAIN Integration aktivieren
                </Label>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Verbindet Automaker mit MEGABRAIN 8 für RAG, Skills und Advocatus Diaboli
                </p>
              </div>
            </div>
            <Switch
              id="megabrain-toggle"
              checked={megabrainEnabled}
              onCheckedChange={setMegabrainEnabled}
            />
          </div>
        </div>
      </div>

      {/* Server Configuration */}
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'border border-border/50',
          'bg-gradient-to-br from-card/80 via-card/70 to-card/80 backdrop-blur-xl',
          'shadow-sm',
          !megabrainEnabled && 'opacity-50 pointer-events-none'
        )}
      >
        <div className="p-6 border-b border-border/30 bg-gradient-to-r from-blue-500/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Server Konfiguration
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* MEGABRAIN API Settings */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Brain className="w-5 h-5 text-blue-500" />
                <span className="font-medium">MEGABRAIN Server</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={megabrainStatus} />
                {megabrainStatus === 'offline' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={startMegabrain}
                    disabled={isStarting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Startet...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        Starten
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {startMessage && (
              <div
                className={cn(
                  'text-xs px-2 py-1 rounded',
                  megabrainStatus === 'online'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                )}
              >
                {startMessage}
              </div>
            )}

            <div className="grid gap-3">
              <div>
                <Label htmlFor="megabrain-api-url" className="text-xs text-muted-foreground">
                  API URL
                </Label>
                <Input
                  id="megabrain-api-url"
                  value={localMegabrainApiUrl}
                  onChange={(e) => setLocalMegabrainApiUrl(e.target.value)}
                  placeholder="http://192.168.10.1:8001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="megabrain-ws-url" className="text-xs text-muted-foreground">
                  WebSocket URL
                </Label>
                <Input
                  id="megabrain-ws-url"
                  value={localMegabrainWsUrl}
                  onChange={(e) => setLocalMegabrainWsUrl(e.target.value)}
                  placeholder="ws://192.168.10.1:8002"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveMegabrain}>
                  Speichern
                </Button>
                <Button variant="ghost" size="sm" onClick={checkMegabrainConnection}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Verbindung testen
                </Button>
              </div>
            </div>
          </div>

          {/* VDB Settings */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Qdrant VDB (Shared)</span>
              </div>
              <StatusBadge status={vdbStatus} />
            </div>

            <div className="grid gap-3">
              <div>
                <Label htmlFor="vdb-url" className="text-xs text-muted-foreground">
                  Qdrant URL
                </Label>
                <Input
                  id="vdb-url"
                  value={localVdbUrl}
                  onChange={(e) => setLocalVdbUrl(e.target.value)}
                  placeholder="http://192.168.10.1:6333"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="vdb-collection" className="text-xs text-muted-foreground">
                  Standard-Collection
                </Label>
                <Input
                  id="vdb-collection"
                  value={localVdbCollection}
                  onChange={(e) => setLocalVdbCollection(e.target.value)}
                  placeholder="automaker_knowledge"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveVdb}>
                  Speichern
                </Button>
                <Button variant="ghost" size="sm" onClick={checkVdbConnection}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Verbindung testen
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/60">
              Diese VDB wird von Automaker und MEGABRAIN gemeinsam genutzt.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'border border-border/50',
          'bg-gradient-to-br from-card/80 via-card/70 to-card/80 backdrop-blur-xl',
          'shadow-sm',
          !megabrainEnabled && 'opacity-50 pointer-events-none'
        )}
      >
        <div className="p-6 border-b border-border/30 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Features</h2>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {/* RAG Enhancement */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor="megabrain-rag"
                  className="font-medium text-foreground cursor-pointer"
                >
                  RAG Enhancement
                </Label>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Semantisches Retrieval aus der VDB für besseren Kontext
                </p>
              </div>
            </div>
            <Switch
              id="megabrain-rag"
              checked={megabrainRagEnabled}
              onCheckedChange={setMegabrainRagEnabled}
            />
          </div>

          {/* Skills Execution */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/15 to-yellow-600/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor="megabrain-skills"
                  className="font-medium text-foreground cursor-pointer"
                >
                  Skills Execution
                </Label>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  50+ spezialisierte Skills für Code-Analyse, Testing, Dokumentation
                </p>
              </div>
            </div>
            <Switch
              id="megabrain-skills"
              checked={megabrainSkillsEnabled}
              onCheckedChange={setMegabrainSkillsEnabled}
            />
          </div>

          {/* Advocatus Diaboli */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/15 to-red-600/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor="megabrain-advocatus"
                  className="font-medium text-foreground cursor-pointer"
                >
                  Advocatus Diaboli
                </Label>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Kritisches Review mit 100/100 Scoring vor jeder Implementierung
                </p>
              </div>
            </div>
            <Switch
              id="megabrain-advocatus"
              checked={megabrainAdvocatusEnabled}
              onCheckedChange={setMegabrainAdvocatusEnabled}
            />
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <p className="text-sm text-muted-foreground">
          <strong className="text-blue-500">MEGABRAIN 8</strong> erweitert Automaker um:
        </p>
        <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
          <li>RAG-basiertes Wissens-Retrieval aus der Vektordatenbank</li>
          <li>Spezialisierte Skills für Code-Analyse, Testing und Dokumentation</li>
          <li>Advocatus Diaboli Workflow für kritische Code-Reviews</li>
          <li>40+ KI-Agenten für verschiedene Aufgaben</li>
        </ul>
      </div>
    </div>
  );
}
