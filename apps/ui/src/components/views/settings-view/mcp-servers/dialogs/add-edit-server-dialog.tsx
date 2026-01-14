import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MCPServerConfig } from '@automaker/types';
import type { ServerFormData, ServerType } from '../types';

interface AddEditServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingServer: MCPServerConfig | null;
  formData: ServerFormData;
  onFormDataChange: (data: ServerFormData) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function AddEditServerDialog({
  open,
  onOpenChange,
  editingServer,
  formData,
  onFormDataChange,
  onSave,
  onCancel,
}: AddEditServerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="mcp-server-dialog">
        <DialogHeader>
          <DialogTitle>
            {editingServer ? 'MCP-Server bearbeiten' : 'MCP-Server hinzufügen'}
          </DialogTitle>
          <DialogDescription>
            Konfiguriere einen MCP-Server, um Agent-Fähigkeiten mit benutzerdefinierten Tools zu
            erweitern.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Name</Label>
            <Input
              id="server-name"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="my-mcp-server"
              data-testid="mcp-server-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-description">Beschreibung (optional)</Label>
            <Input
              id="server-description"
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder="Was dieser Server bereitstellt..."
              data-testid="mcp-server-description-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-type">Transport-Typ</Label>
            <Select
              value={formData.type}
              onValueChange={(value: ServerType) => onFormDataChange({ ...formData, type: value })}
            >
              <SelectTrigger id="server-type" data-testid="mcp-server-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">Stdio (Subprozess)</SelectItem>
                <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                <SelectItem value="http">HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.type === 'stdio' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="server-command">Befehl</Label>
                <Input
                  id="server-command"
                  value={formData.command}
                  onChange={(e) => onFormDataChange({ ...formData, command: e.target.value })}
                  placeholder="npx, node, python, etc."
                  data-testid="mcp-server-command-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-args">Argumente (durch Leerzeichen getrennt)</Label>
                <Input
                  id="server-args"
                  value={formData.args}
                  onChange={(e) => onFormDataChange({ ...formData, args: e.target.value })}
                  placeholder="-y @modelcontextprotocol/server-filesystem"
                  data-testid="mcp-server-args-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-env">Umgebungsvariablen (JSON, optional)</Label>
                <Textarea
                  id="server-env"
                  value={formData.env}
                  onChange={(e) => onFormDataChange({ ...formData, env: e.target.value })}
                  placeholder={'{\n  "API_KEY": "your-key"\n}'}
                  className="font-mono text-sm h-24"
                  data-testid="mcp-server-env-input"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="server-url">URL</Label>
                <Input
                  id="server-url"
                  value={formData.url}
                  onChange={(e) => onFormDataChange({ ...formData, url: e.target.value })}
                  placeholder="https://example.com/mcp"
                  data-testid="mcp-server-url-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-headers">Header (JSON, optional)</Label>
                <Textarea
                  id="server-headers"
                  value={formData.headers}
                  onChange={(e) => onFormDataChange({ ...formData, headers: e.target.value })}
                  placeholder={
                    '{\n  "x-api-key": "your-api-key",\n  "Authorization": "Bearer token"\n}'
                  }
                  className="font-mono text-sm h-24"
                  data-testid="mcp-server-headers-input"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={onSave} data-testid="mcp-server-save-button">
            {editingServer ? 'Änderungen speichern' : 'Server hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
