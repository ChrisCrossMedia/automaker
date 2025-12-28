# Cursor CLI Integration Analysis

> Phase 0 Analysis Document for AutoMaker Cursor Integration
> Generated: 2025-12-28

## Executive Summary

This document analyzes the existing Claude CLI integration architecture in AutoMaker and documents the Cursor CLI (cursor-agent) behavior to plan a parallel provider implementation.

## 1. Current Architecture Analysis

### 1.1 Provider System (`apps/server/src/providers/`)

#### BaseProvider (`base-provider.ts`)

- Abstract class with core interface for all providers
- Key methods:
  - `execute(options)` - Runs the CLI process
  - `buildCommand(options)` - Constructs CLI command
  - `parseOutput(output)` - Parses CLI response
  - `buildSystemPrompt(options)` - Constructs system prompts
- Uses `@automaker/platform.spawnJSONLProcess()` for CLI execution
- Handles abort signals for cancellation

#### ClaudeProvider (`claude-provider.ts`)

- Extends BaseProvider for Claude CLI
- Uses Claude Agent SDK via `@anthropic-ai/claude-code` package
- Key features:
  - Thinking levels (none, low, medium, high, ultrathink)
  - Model selection (haiku, sonnet, opus)
  - System prompt injection
  - Session/conversation management
  - MCP server support
- SDK options built via `buildSdkOptions()` in `sdk-options.ts`

#### ProviderFactory (`provider-factory.ts`)

- Creates provider instances based on type
- Currently only supports 'claude' provider
- Extension point for adding new providers

#### Types (`types.ts`)

- `ProviderType`: Currently `'claude'`
- `ProviderConfig`: Configuration for providers
- `ExecuteResult`: Standardized result format

### 1.2 Service Integration

#### AgentService (`agent-service.ts`)

- Manages chat agent sessions
- Uses ClaudeProvider for execution
- Handles streaming output to clients
- Session persistence and history

#### AutoModeService (`auto-mode-service.ts`)

- Orchestrates feature generation workflow
- Manages concurrent feature execution
- Uses provider for each feature task
- Handles planning, execution, verification phases

#### SDK Options (`sdk-options.ts`)

- Builds Claude SDK options from settings
- Handles thinking level configuration
- Maps model aliases to full model IDs
- Configures MCP servers

### 1.3 UI Components

#### LogParser (`log-parser.ts`)

- Parses agent output into structured entries
- Detects entry types: tool_call, tool_result, phase, error, success, etc.
- Extracts metadata: tool name, file path, summary
- Claude-specific patterns (🔧 Tool:, etc.)

#### LogViewer (`log-viewer.tsx`)

- Renders parsed log entries
- Collapsible sections
- Filtering by type/category
- Tool-specific icons and colors

### 1.4 Setup Flow

#### Claude Status Detection (`get-claude-status.ts`)

- Checks CLI installation via `which`/`where`
- Searches common installation paths
- Detects authentication via:
  - `~/.claude/stats-cache.json` (activity)
  - `~/.claude/.credentials.json` (OAuth)
  - Environment variables (`ANTHROPIC_API_KEY`)
  - Stored API keys in AutoMaker

#### Setup View (`setup-view.tsx`)

- Multi-step wizard: welcome → theme → claude → github → complete
- `ClaudeSetupStep` handles CLI detection and auth
- Skip option for users without Claude

#### HTTP API Client (`http-api-client.ts`)

- Client-side API wrapper
- `setup.getClaudeStatus()` - Get Claude CLI status
- `setup.installClaude()` - Trigger installation
- `setup.authClaude()` - Trigger authentication

### 1.5 Types Package (`@automaker/types`)

#### Model Types (`model.ts`)

```typescript
CLAUDE_MODEL_MAP = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-5-20251101',
};
```

#### Settings Types (`settings.ts`)

- `ModelProvider`: Currently `'claude'` only
- `AIProfile`: Provider field for profiles
- `ThinkingLevel`: Reasoning intensity levels

#### Model Display (`model-display.ts`)

- `CLAUDE_MODELS`: UI metadata for model selection
- `getModelDisplayName()`: Human-readable names

## 2. Cursor CLI Behavior Analysis

### 2.1 Installation & Location

- **Binary**: `cursor-agent`
- **Installed at**: `~/.local/bin/cursor-agent`
- **Version tested**: `2025.12.17-996666f`
- **Config directory**: `~/.cursor/`
- **Config file**: `~/.cursor/cli-config.json`

### 2.2 Authentication

```bash
# Login command
cursor-agent login

# Status check
cursor-agent status    # or `cursor-agent whoami`

# Logout
cursor-agent logout
```

Authentication is browser-based (OAuth) by default. Status output:

```
✓ Logged in as user@example.com
```

### 2.3 CLI Options

| Option                     | Description                                 |
| -------------------------- | ------------------------------------------- |
| `--print`                  | Non-interactive mode, outputs to stdout     |
| `--output-format <format>` | `text`, `json`, or `stream-json`            |
| `--model <model>`          | Model selection (e.g., `gpt-5`, `sonnet-4`) |
| `--workspace <path>`       | Working directory                           |
| `--resume [chatId]`        | Resume previous session                     |
| `--api-key <key>`          | API key (or `CURSOR_API_KEY` env)           |
| `--force`                  | Auto-approve tool calls                     |
| `--approve-mcps`           | Auto-approve MCP servers                    |

### 2.4 Output Formats

#### JSON Format (`--output-format json`)

Single JSON object on completion:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 2691,
  "result": "Response text here",
  "session_id": "uuid",
  "request_id": "uuid"
}
```

#### Stream-JSON Format (`--output-format stream-json`)

JSONL (one JSON per line) during execution:

1. **Init event**:

```json
{
  "type": "system",
  "subtype": "init",
  "apiKeySource": "login",
  "cwd": "/path",
  "session_id": "uuid",
  "model": "Composer 1"
}
```

2. **User message**:

```json
{
  "type": "user",
  "message": { "role": "user", "content": [{ "type": "text", "text": "prompt" }] },
  "session_id": "uuid"
}
```

3. **Thinking events**:

```json
{"type":"thinking","subtype":"delta","text":"","session_id":"uuid","timestamp_ms":123}
{"type":"thinking","subtype":"completed","session_id":"uuid","timestamp_ms":123}
```

4. **Assistant response**:

```json
{
  "type": "assistant",
  "message": { "role": "assistant", "content": [{ "type": "text", "text": "response" }] },
  "session_id": "uuid"
}
```

5. **Result**:

```json
{
  "type": "result",
  "subtype": "success",
  "duration_ms": 1825,
  "is_error": false,
  "result": "response",
  "session_id": "uuid"
}
```

### 2.5 Config File Structure

`~/.cursor/cli-config.json`:

```json
{
  "permissions": {
    "allow": ["Shell(ls)"],
    "deny": []
  },
  "version": 1,
  "model": {
    "modelId": "composer-1",
    "displayModelId": "composer-1",
    "displayName": "Composer 1"
  },
  "approvalMode": "allowlist",
  "sandbox": {
    "mode": "disabled",
    "networkAccess": "allowlist"
  }
}
```

### 2.6 Available Models

From `--help`:

- `gpt-5`
- `sonnet-4`
- `sonnet-4-thinking`
- `composer-1` (default)

### 2.7 MCP Support

```bash
cursor-agent mcp list          # List configured servers
cursor-agent mcp login <id>    # Authenticate with server
cursor-agent mcp list-tools <id>  # List tools for server
cursor-agent mcp disable <id>  # Remove from approved list
```

## 3. Integration Strategy

### 3.1 Types to Add (`@automaker/types`)

```typescript
// settings.ts
export type ModelProvider = 'claude' | 'cursor';

// model.ts (new: cursor-models.ts)
export type CursorModelId = 'composer-1' | 'gpt-5' | 'sonnet-4' | 'sonnet-4-thinking';

export const CURSOR_MODEL_MAP: Record<string, CursorModelId> = {
  composer: 'composer-1',
  gpt5: 'gpt-5',
  sonnet: 'sonnet-4',
  'sonnet-thinking': 'sonnet-4-thinking',
};
```

### 3.2 Provider Implementation

New `CursorProvider` class extending `BaseProvider`:

- Override `buildCommand()` for cursor-agent CLI
- Override `parseOutput()` for Cursor's JSONL format
- Handle stream-json output parsing
- Map thinking events to existing log format

### 3.3 Setup Flow Changes

1. Add `CursorSetupStep` component
2. Add `get-cursor-status.ts` route handler
3. Update setup wizard to detect/choose providers
4. Add Cursor authentication flow

### 3.4 UI Updates

1. Extend `LogParser` for Cursor event types
2. Add Cursor icon (Terminal from lucide-react)
3. Update model selectors for Cursor models
4. Provider toggle in settings

## 4. Key Differences: Claude vs Cursor

| Aspect     | Claude CLI                  | Cursor CLI              |
| ---------- | --------------------------- | ----------------------- |
| Binary     | `claude`                    | `cursor-agent`          |
| SDK        | `@anthropic-ai/claude-code` | Direct CLI spawn        |
| Config dir | `~/.claude/`                | `~/.cursor/`            |
| Auth file  | `.credentials.json`         | `cli-config.json`       |
| Output     | SDK events                  | JSONL stream            |
| Thinking   | Extended thinking API       | `thinking` events       |
| Models     | haiku/sonnet/opus           | composer/gpt-5/sonnet-4 |
| Session    | Conversation system         | `session_id` in output  |

## 5. Files to Create/Modify

### Phase 1: Types

- [ ] `libs/types/src/cursor-models.ts` - Cursor model definitions
- [ ] `libs/types/src/settings.ts` - Update ModelProvider type
- [ ] `libs/types/src/index.ts` - Export new types

### Phase 2: Provider

- [ ] `apps/server/src/providers/cursor-provider.ts` - New provider
- [ ] `apps/server/src/providers/provider-factory.ts` - Add cursor
- [ ] `apps/server/src/providers/types.ts` - Update ProviderType

### Phase 3: Setup

- [ ] `apps/server/src/routes/setup/get-cursor-status.ts` - Detection
- [ ] `apps/server/src/routes/setup/routes/cursor-status.ts` - Route
- [ ] `apps/server/src/routes/setup/index.ts` - Register route

### Phase 4: UI

- [ ] `apps/ui/src/components/views/setup-view/steps/CursorSetupStep.tsx`
- [ ] `apps/ui/src/lib/log-parser.ts` - Cursor event parsing
- [ ] `apps/ui/src/lib/http-api-client.ts` - Add cursor endpoints

## 6. Verification Checklist

- [x] Read all core provider files
- [x] Read service integration files
- [x] Read UI streaming/logging files
- [x] Read setup flow files
- [x] Read types package files
- [x] Document Cursor CLI behavior
- [x] Create this analysis document

## 7. Next Steps

Proceed to **Phase 1: Types & Interfaces** to:

1. Add Cursor model types to `@automaker/types`
2. Update `ModelProvider` type
3. Create cursor model display constants
