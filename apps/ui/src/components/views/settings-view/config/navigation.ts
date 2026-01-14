import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Key,
  Bot,
  SquareTerminal,
  Palette,
  Settings2,
  Volume2,
  Trash2,
  Plug,
  MessageSquareText,
  User,
  Shield,
  GitBranch,
  Brain,
  Server,
} from 'lucide-react';
import { AnthropicIcon, CursorIcon, OpenAIIcon, OpenCodeIcon } from '@/components/ui/provider-icon';
import type { SettingsViewId } from '../hooks/use-settings-view';

export interface NavigationItem {
  id: SettingsViewId;
  label: string;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  subItems?: NavigationItem[];
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

// Global settings organized into groups
export const GLOBAL_NAV_GROUPS: NavigationGroup[] = [
  {
    label: 'Modell & Prompts',
    items: [
      { id: 'llm-mode', label: 'LLM-Modus', icon: Server },
      { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
      { id: 'prompts', label: 'Prompt-Anpassung', icon: MessageSquareText },
      { id: 'api-keys', label: 'API-Schlüssel', icon: Key },
      {
        id: 'providers',
        label: 'KI-Anbieter',
        icon: Bot,
        subItems: [
          { id: 'claude-provider', label: 'Claude', icon: AnthropicIcon },
          { id: 'cursor-provider', label: 'Cursor', icon: CursorIcon },
          { id: 'codex-provider', label: 'Codex', icon: OpenAIIcon },
          { id: 'opencode-provider', label: 'OpenCode', icon: OpenCodeIcon },
        ],
      },
      { id: 'mcp-servers', label: 'MCP-Server', icon: Plug },
    ],
  },
  {
    label: 'Oberfläche',
    items: [
      { id: 'appearance', label: 'Erscheinungsbild', icon: Palette },
      { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
      { id: 'keyboard', label: 'Tastenkürzel', icon: Settings2 },
      { id: 'audio', label: 'Audio', icon: Volume2 },
    ],
  },
  {
    label: 'KI & Integration',
    items: [{ id: 'megabrain', label: 'MEGABRAIN 8', icon: Brain }],
  },
  {
    label: 'Konto & Sicherheit',
    items: [
      { id: 'account', label: 'Konto', icon: User },
      { id: 'security', label: 'Sicherheit', icon: Shield },
    ],
  },
];

// Flat list of all global nav items for backwards compatibility
export const GLOBAL_NAV_ITEMS: NavigationItem[] = GLOBAL_NAV_GROUPS.flatMap((group) => group.items);

// Project-specific settings - only visible when a project is selected
export const PROJECT_NAV_ITEMS: NavigationItem[] = [
  { id: 'danger', label: 'Gefahrenzone', icon: Trash2 },
];

// Legacy export for backwards compatibility
export const NAV_ITEMS: NavigationItem[] = [...GLOBAL_NAV_ITEMS, ...PROJECT_NAV_ITEMS];
