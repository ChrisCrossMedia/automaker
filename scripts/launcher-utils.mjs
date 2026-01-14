/**
 * Shared utilities for Automaker launcher scripts (dev.mjs)
 *
 * This module contains cross-platform utilities for:
 * - Process management (ports, killing processes)
 * - Terminal output (colors, logging)
 * - npm/npx command execution
 * - User prompts
 * - Health checks
 *
 * SECURITY NOTE: Uses a restricted fs wrapper that only allows
 * operations within a specified base directory.
 */

import { execSync } from 'child_process';
import fsNative, { statSync } from 'fs';
import http from 'http';
import path from 'path';
import readline from 'readline';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const treeKill = require('tree-kill');
const crossSpawn = require('cross-spawn');

// =============================================================================
// Terminal Colors
// =============================================================================

export const colors = {
  green: '\x1b[0;32m',
  blue: '\x1b[0;34m',
  yellow: '\x1b[1;33m',
  red: '\x1b[0;31m',
  reset: '\x1b[0m',
};

export const isWindows = process.platform === 'win32';

// =============================================================================
// Restricted fs wrapper - only allows operations within a base directory
// =============================================================================

/**
 * Create a restricted fs wrapper for a given base directory
 * @param {string} baseDir - The base directory to restrict operations to
 * @param {string} scriptName - Name of the calling script for error messages
 * @returns {object} - Restricted fs operations
 */
export function createRestrictedFs(baseDir, scriptName = 'launcher') {
  const normalizedBase = path.resolve(baseDir);

  function validatePath(targetPath) {
    const resolved = path.resolve(baseDir, targetPath);
    if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
      throw new Error(
        `[${scriptName}] Security: Path access denied outside script directory: ${targetPath}`
      );
    }
    return resolved;
  }

  return {
    existsSync(targetPath) {
      const validated = validatePath(targetPath);
      return fsNative.existsSync(validated);
    },
    mkdirSync(targetPath, options) {
      const validated = validatePath(targetPath);
      return fsNative.mkdirSync(validated, options);
    },
    createWriteStream(targetPath) {
      const validated = validatePath(targetPath);
      return fsNative.createWriteStream(validated);
    },
  };
}

// =============================================================================
// Logging
// =============================================================================

/**
 * Print colored output
 * @param {string} message - Message to print
 * @param {string} color - Color name (green, blue, yellow, red, reset)
 */
export function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// =============================================================================
// Command Execution
// =============================================================================

/**
 * Execute a command synchronously and return stdout
 * @param {string} command - Command to execute
 * @param {object} options - execSync options
 * @returns {string|null} - Command output or null on error
 */
export function execCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Run npm command using cross-spawn for Windows compatibility
 * @param {string[]} args - npm command arguments
 * @param {object} options - spawn options
 * @param {string} cwd - Working directory
 * @returns {ChildProcess} - Spawned process
 */
export function runNpm(args, options = {}, cwd = process.cwd()) {
  const { env, ...restOptions } = options;
  const spawnOptions = {
    stdio: 'inherit',
    cwd,
    ...restOptions,
    env: {
      ...process.env,
      ...(env || {}),
    },
  };
  return crossSpawn('npm', args, spawnOptions);
}

/**
 * Run an npm command and wait for completion
 * @param {string[]} args - npm command arguments
 * @param {object} options - spawn options
 * @param {string} cwd - Working directory
 * @returns {Promise<void>}
 */
export function runNpmAndWait(args, options = {}, cwd = process.cwd()) {
  const child = runNpm(args, options, cwd);
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(' ')} failed with code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}

/**
 * Run npx command using cross-spawn for Windows compatibility
 * @param {string[]} args - npx command arguments
 * @param {object} options - spawn options
 * @param {string} cwd - Working directory
 * @returns {ChildProcess} - Spawned process
 */
export function runNpx(args, options = {}, cwd = process.cwd()) {
  const { env, ...restOptions } = options;
  const spawnOptions = {
    stdio: 'inherit',
    cwd,
    ...restOptions,
    env: {
      ...process.env,
      ...(env || {}),
    },
  };
  return crossSpawn('npx', args, spawnOptions);
}

// =============================================================================
// Process Management
// =============================================================================

/**
 * Get process IDs using a specific port (cross-platform)
 * @param {number} port - Port number to check
 * @returns {number[]} - Array of PIDs using the port
 */
export function getProcessesOnPort(port) {
  const pids = new Set();

  if (isWindows) {
    try {
      const output = execCommand(`netstat -ano | findstr :${port}`);
      if (output) {
        const lines = output.split('\n');
        for (const line of lines) {
          const match = line.match(/:\d+\s+.*?(\d+)\s*$/);
          if (match) {
            const pid = parseInt(match[1], 10);
            if (pid > 0) pids.add(pid);
          }
        }
      }
    } catch {
      // Ignore errors
    }
  } else {
    try {
      const output = execCommand(`lsof -ti:${port}`);
      if (output) {
        output.split('\n').forEach((pid) => {
          const parsed = parseInt(pid.trim(), 10);
          if (parsed > 0) pids.add(parsed);
        });
      }
    } catch {
      // Ignore errors
    }
  }

  return Array.from(pids);
}

/**
 * Kill a process by PID (cross-platform)
 * @param {number} pid - Process ID to kill
 * @returns {boolean} - Whether the kill succeeded
 */
export function killProcess(pid) {
  try {
    if (isWindows) {
      execCommand(`taskkill /F /PID ${pid}`);
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a port is in use (without killing)
 * @param {number} port - Port number to check
 * @returns {boolean} - Whether the port is in use
 */
export function isPortInUse(port) {
  const pids = getProcessesOnPort(port);
  return pids.length > 0;
}

/**
 * Kill processes on a port and wait for it to be freed
 * @param {number} port - Port number to free
 * @returns {Promise<boolean>} - Whether the port was freed
 */
export async function killPort(port) {
  const pids = getProcessesOnPort(port);

  if (pids.length === 0) {
    log(`✓ Port ${port} is available`, 'green');
    return true;
  }

  log(`Killing process(es) on port ${port}: ${pids.join(', ')}`, 'yellow');

  for (const pid of pids) {
    killProcess(pid);
  }

  // Wait for port to be freed (max 5 seconds)
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    const remainingPids = getProcessesOnPort(port);
    if (remainingPids.length === 0) {
      log(`✓ Port ${port} is now free`, 'green');
      return true;
    }
  }

  log(`Warning: Port ${port} may still be in use`, 'red');
  return false;
}

/**
 * Kill a process tree using tree-kill
 * @param {number} pid - Root process ID
 * @returns {Promise<void>}
 */
export function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }
    treeKill(pid, 'SIGTERM', (err) => {
      if (err) {
        treeKill(pid, 'SIGKILL', () => resolve());
      } else {
        resolve();
      }
    });
  });
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if the server health endpoint is responding
 * @param {number} port - Server port (default 3008)
 * @returns {Promise<boolean>} - Whether the server is healthy
 */
export function checkHealth(port = 3008) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Prompt the user for input
 * @param {string} question - Question to ask
 * @returns {Promise<string>} - User's answer
 */
export function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// =============================================================================
// Port Configuration Flow
// =============================================================================

/**
 * Check ports and prompt user for resolution if in use
 * @param {object} options - Configuration options
 * @param {number} options.defaultWebPort - Default web port (3007)
 * @param {number} options.defaultServerPort - Default server port (3008)
 * @returns {Promise<{webPort: number, serverPort: number, corsOriginEnv: string}>}
 */
export async function resolvePortConfiguration({
  defaultWebPort = 3007,
  defaultServerPort = 3008,
} = {}) {
  log(`Checking for processes on ports ${defaultWebPort} and ${defaultServerPort}...`, 'yellow');

  const webPortInUse = isPortInUse(defaultWebPort);
  const serverPortInUse = isPortInUse(defaultServerPort);

  let webPort = defaultWebPort;
  let serverPort = defaultServerPort;

  if (webPortInUse || serverPortInUse) {
    console.log('');
    if (webPortInUse) {
      const pids = getProcessesOnPort(defaultWebPort);
      log(`⚠ Port ${defaultWebPort} is in use by process(es): ${pids.join(', ')}`, 'yellow');
    }
    if (serverPortInUse) {
      const pids = getProcessesOnPort(defaultServerPort);
      log(`⚠ Port ${defaultServerPort} is in use by process(es): ${pids.join(', ')}`, 'yellow');
    }
    console.log('');

    while (true) {
      const choice = await prompt(
        'What would you like to do? (k)ill processes, (u)se different ports, or (c)ancel: '
      );
      const lowerChoice = choice.toLowerCase();

      if (lowerChoice === 'k' || lowerChoice === 'kill') {
        if (webPortInUse) {
          await killPort(defaultWebPort);
        } else {
          log(`✓ Port ${defaultWebPort} is available`, 'green');
        }
        if (serverPortInUse) {
          await killPort(defaultServerPort);
        } else {
          log(`✓ Port ${defaultServerPort} is available`, 'green');
        }
        break;
      } else if (lowerChoice === 'u' || lowerChoice === 'use') {
        webPort = await promptForPort('web', defaultWebPort);
        serverPort = await promptForPort('server', defaultServerPort, webPort);
        log(`Using ports: Web=${webPort}, Server=${serverPort}`, 'blue');
        break;
      } else if (lowerChoice === 'c' || lowerChoice === 'cancel') {
        log('Cancelled.', 'yellow');
        process.exit(0);
      } else {
        log(
          'Invalid choice. Please enter k (kill), u (use different ports), or c (cancel).',
          'red'
        );
      }
    }
  } else {
    log(`✓ Port ${defaultWebPort} is available`, 'green');
    log(`✓ Port ${defaultServerPort} is available`, 'green');
  }

  // Build CORS origin env
  const existing = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .filter((o) => o !== '*');
  const origins = new Set(existing);
  origins.add(`http://localhost:${webPort}`);
  origins.add(`http://127.0.0.1:${webPort}`);
  const corsOriginEnv = Array.from(origins).join(',');

  console.log('');

  return { webPort, serverPort, corsOriginEnv };
}

/**
 * Prompt for a specific port with validation
 * @param {string} name - Port name (web/server)
 * @param {number} defaultPort - Default port value
 * @param {number} excludePort - Port to exclude (optional)
 * @returns {Promise<number>}
 */
async function promptForPort(name, defaultPort, excludePort = null) {
  while (true) {
    const input = await prompt(`Enter ${name} port (default ${defaultPort}): `);
    const parsed = input.trim() ? parseInt(input.trim(), 10) : defaultPort;

    if (isNaN(parsed) || parsed < 1024 || parsed > 65535) {
      log('Invalid port. Please enter a number between 1024 and 65535.', 'red');
      continue;
    }

    if (excludePort && parsed === excludePort) {
      log(`${name} port cannot be the same as the other port.`, 'red');
      continue;
    }

    if (isPortInUse(parsed)) {
      const pids = getProcessesOnPort(parsed);
      log(`Port ${parsed} is already in use by process(es): ${pids.join(', ')}`, 'red');
      const useAnyway = await prompt('Use this port anyway? (y/n): ');
      if (useAnyway.toLowerCase() !== 'y' && useAnyway.toLowerCase() !== 'yes') {
        continue;
      }
    }

    return parsed;
  }
}

// =============================================================================
// UI Components
// =============================================================================

/**
 * Print the application header banner
 * @param {string} title - Header title
 */
export function printHeader(title) {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log(`║        ${title.padEnd(45)}║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * Print the application mode menu
 * @param {object} options - Menu options
 * @param {boolean} options.isDev - Whether this is dev mode (changes Docker option description)
 */
export function printModeMenu({ isDev = false } = {}) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Select Application Mode:');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  1) Web Application (Browser)');
  console.log('  2) Desktop Application (Electron)');
  if (isDev) {
    console.log('  3) Docker Container (Dev with Live Reload)');
    console.log('  4) Electron + Docker API (Local Electron, Container API)');
  } else {
    console.log('  3) Docker Container (Isolated)');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

// =============================================================================
// Process Cleanup
// =============================================================================

/**
 * Create a cleanup handler for spawned processes
 * @param {object} processes - Object with process references {server, web, electron, docker}
 * @returns {Function} - Cleanup function
 */
export function createCleanupHandler(processes) {
  return async function cleanup() {
    console.log('\nCleaning up...');

    const killPromises = [];

    if (processes.server && !processes.server.killed && processes.server.pid) {
      killPromises.push(killProcessTree(processes.server.pid));
    }

    if (processes.web && !processes.web.killed && processes.web.pid) {
      killPromises.push(killProcessTree(processes.web.pid));
    }

    if (processes.electron && !processes.electron.killed && processes.electron.pid) {
      killPromises.push(killProcessTree(processes.electron.pid));
    }

    if (processes.docker && !processes.docker.killed && processes.docker.pid) {
      killPromises.push(killProcessTree(processes.docker.pid));
    }

    // Note: MEGABRAIN process runs detached and persists after Automaker exits
    // This is intentional - MEGABRAIN can serve multiple clients
    // To stop MEGABRAIN manually: kill the python3 megabrain8_startup.py process

    await Promise.all(killPromises);
  };
}

/**
 * Setup signal handlers for graceful shutdown
 * @param {Function} cleanup - Cleanup function
 */
export function setupSignalHandlers(cleanup) {
  let cleaningUp = false;

  const handleExit = async () => {
    if (cleaningUp) return;
    cleaningUp = true;
    await cleanup();
    process.exit(0);
  };

  process.on('SIGINT', () => handleExit());
  process.on('SIGTERM', () => handleExit());
}

// =============================================================================
// Server Startup
// =============================================================================

/**
 * Start the backend server and wait for it to be ready
 * @param {object} options - Configuration options
 * @returns {Promise<ChildProcess>} - Server process
 */
export async function startServerAndWait({ serverPort, corsOriginEnv, npmArgs, cwd, fs, baseDir }) {
  log(`Starting backend server on port ${serverPort}...`, 'blue');

  // Create logs directory
  const logsDir = path.join(baseDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logStream = fs.createWriteStream(path.join(baseDir, 'logs', 'server.log'));
  const serverProcess = runNpm(
    npmArgs,
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PORT: String(serverPort),
        CORS_ORIGIN: corsOriginEnv,
      },
    },
    cwd
  );

  // Pipe to both log file and console
  serverProcess.stdout?.on('data', (data) => {
    process.stdout.write(data);
    logStream.write(data);
  });
  serverProcess.stderr?.on('data', (data) => {
    process.stderr.write(data);
    logStream.write(data);
  });

  log('Waiting for server to be ready...', 'yellow');

  // Wait for server health check
  const maxRetries = 30;
  let serverReady = false;

  for (let i = 0; i < maxRetries; i++) {
    if (await checkHealth(serverPort)) {
      serverReady = true;
      break;
    }
    process.stdout.write('.');
    await sleep(1000);
  }

  console.log('');

  if (!serverReady) {
    log('Error: Server failed to start', 'red');
    console.log('Check logs/server.log for details');

    // Clean up the spawned server process that failed health check
    if (serverProcess && !serverProcess.killed && serverProcess.pid) {
      log('Terminating failed server process...', 'yellow');
      try {
        await killProcessTree(serverProcess.pid);
      } catch (killErr) {
        // Fallback: try direct kill if tree-kill fails
        try {
          serverProcess.kill('SIGKILL');
        } catch {
          // Process may have already exited
        }
      }
    }

    // Close the log stream
    logStream.end();

    return null;
  }

  log('✓ Server is ready!', 'green');
  return serverProcess;
}

// =============================================================================
// Dependencies
// =============================================================================

/**
 * Ensure node_modules exists, install if not
 * @param {object} fs - Restricted fs object
 * @param {string} baseDir - Base directory
 */
export async function ensureDependencies(fs, baseDir) {
  if (!fs.existsSync(path.join(baseDir, 'node_modules'))) {
    log('Installing dependencies...', 'blue');
    const install = runNpm(['install'], { stdio: 'inherit' }, baseDir);
    await new Promise((resolve, reject) => {
      install.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });
  }
}

// =============================================================================
// Docker Utilities
// =============================================================================

/**
 * Sanitize a project name to be safe for use in shell commands and Docker image names.
 * Converts to lowercase and removes any characters that aren't alphanumeric.
 * @param {string} name - Project name to sanitize
 * @returns {string} - Sanitized project name
 */
export function sanitizeProjectName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get the current git commit SHA
 * @param {string} baseDir - Base directory of the git repository
 * @returns {string|null} - Current commit SHA or null if not available
 */
export function getCurrentCommitSha(baseDir) {
  try {
    const sha = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
      cwd: baseDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * Get the commit SHA from a Docker image label
 * @param {string} imageName - Docker image name
 * @returns {string|null} - Commit SHA from image label or null if not found
 */
export function getImageCommitSha(imageName) {
  try {
    const labelValue = execSync(
      `docker image inspect ${imageName} --format "{{index .Config.Labels \\"automaker.git.commit.sha\\"}}" 2>/dev/null`,
      { encoding: 'utf-8' }
    ).trim();
    return labelValue && labelValue !== 'unknown' && labelValue !== '' ? labelValue : null;
  } catch {
    return null;
  }
}

/**
 * Check if Docker images need to be rebuilt based on git commit SHA
 * Compares the current git commit with the commit SHA stored in the image labels
 * @param {string} baseDir - Base directory containing Dockerfile and docker-compose.yml
 * @returns {{needsRebuild: boolean, reason: string, currentSha: string|null, imageSha: string|null}}
 */
export function shouldRebuildDockerImages(baseDir) {
  try {
    // Get current git commit SHA
    const currentSha = getCurrentCommitSha(baseDir);
    if (!currentSha) {
      return {
        needsRebuild: true,
        reason: 'Could not determine current git commit',
        currentSha: null,
        imageSha: null,
      };
    }

    // Get project name from docker-compose config, falling back to directory name
    let projectName;
    try {
      const composeConfig = execSync('docker compose config --format json', {
        encoding: 'utf-8',
        cwd: baseDir,
      });
      const config = JSON.parse(composeConfig);
      projectName = config.name;
    } catch {
      // Fallback handled below
    }

    // Sanitize project name
    const sanitizedProjectName = sanitizeProjectName(projectName || path.basename(baseDir));
    const serverImageName = `${sanitizedProjectName}-server`;
    const uiImageName = `${sanitizedProjectName}-ui`;

    // Check if images exist
    const serverExists = checkImageExists(serverImageName);
    const uiExists = checkImageExists(uiImageName);

    if (!serverExists || !uiExists) {
      return {
        needsRebuild: true,
        reason: 'Docker images do not exist',
        currentSha,
        imageSha: null,
      };
    }

    // Get commit SHA from server image (both should have the same)
    const imageSha = getImageCommitSha(serverImageName);

    if (!imageSha) {
      return {
        needsRebuild: true,
        reason: 'Docker images have no commit SHA label (legacy build)',
        currentSha,
        imageSha: null,
      };
    }

    // Compare commit SHAs
    if (currentSha !== imageSha) {
      return {
        needsRebuild: true,
        reason: `Code changed: ${imageSha.substring(0, 8)} -> ${currentSha.substring(0, 8)}`,
        currentSha,
        imageSha,
      };
    }

    return {
      needsRebuild: false,
      reason: 'Images are up to date',
      currentSha,
      imageSha,
    };
  } catch (error) {
    return {
      needsRebuild: true,
      reason: 'Could not check Docker image status',
      currentSha: null,
      imageSha: null,
    };
  }
}

/**
 * Check if a Docker image exists
 * @param {string} imageName - Docker image name
 * @returns {boolean} - Whether the image exists
 */
function checkImageExists(imageName) {
  try {
    execSync(`docker image inspect ${imageName} 2>/dev/null`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Launch Docker containers for development with live reload
 * Uses docker-compose.dev.yml which volume mounts the source code
 * Also includes docker-compose.override.yml if it exists (for workspace mounts)
 * @param {object} options - Configuration options
 * @param {string} options.baseDir - Base directory containing docker-compose.dev.yml
 * @param {object} options.processes - Processes object to track docker process
 * @returns {Promise<void>}
 */
export async function launchDockerDevContainers({ baseDir, processes }) {
  log('Launching Docker Container (Development Mode with Live Reload)...', 'blue');
  console.log('');

  // AUTO-REFRESH: Prüfe und erneuere Claude OAuth Token
  const tokenValid = await refreshClaudeOAuthToken(baseDir);
  if (!tokenValid) {
    log('⚠️  OAuth Token konnte nicht validiert/erneuert werden', 'yellow');
    log('Falls Fehler auftreten, bitte "claude /login" ausführen', 'yellow');
    console.log('');
  }

  // Check if ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    log('Warning: ANTHROPIC_API_KEY environment variable is not set.', 'yellow');
    log('The server will require an API key to function.', 'yellow');
    log('Set it with: export ANTHROPIC_API_KEY=your-key', 'yellow');
    console.log('');
  }

  // Start MEGABRAIN 8 before Docker container (runs on host, not in container)
  await startMegabrain8(processes);
  console.log('');

  log('Starting development container...', 'yellow');
  log('Source code is volume mounted for live reload', 'yellow');
  log('Running npm install inside container (this may take a moment on first run)...', 'yellow');
  console.log('');

  // Build compose file arguments
  // Start with dev compose file, then add override if it exists
  const composeArgs = ['compose', '-f', 'docker-compose.dev.yml'];

  // Check if docker-compose.override.yml exists and include it for workspace mounts
  const overridePath = path.join(baseDir, 'docker-compose.override.yml');
  if (fsNative.existsSync(overridePath)) {
    composeArgs.push('-f', 'docker-compose.override.yml');
    log('Using docker-compose.override.yml for workspace mount', 'yellow');
  }

  composeArgs.push('up', '--build', '-d'); // -d = detached mode (Hintergrund)

  // Use docker-compose.dev.yml for development
  processes.docker = crossSpawn('docker', composeArgs, {
    stdio: 'pipe', // Don't show logs in terminal
    cwd: baseDir,
    env: {
      ...process.env,
    },
  });

  log('Development container starting im Hintergrund...', 'blue');
  log('UI will be available at: http://localhost:3007 (with HMR)', 'green');
  log('API will be available at: http://localhost:3008', 'green');
  console.log('');
  log('Logs anzeigen: docker logs -f automaker-dev-server-only', 'yellow');
  log('Changes to source files will automatically reload.', 'yellow');
  log('Press Ctrl+C to stop the container.', 'yellow');

  await new Promise((resolve) => {
    processes.docker.on('close', resolve);
  });
}

/**
 * Refresh Claude OAuth Token wenn abgelaufen
 * Prüft Token-Ablauf und erneuert automatisch via refreshToken
 * @param {string} baseDir - Base directory des Projekts
 * @returns {Promise<boolean>} - true wenn Token gültig/erneuert, false bei Fehler
 */
export async function refreshClaudeOAuthToken(baseDir) {
  log('Prüfe Claude OAuth Token...', 'yellow');

  try {
    const homeDir = process.env.HOME;
    const credentialsPath = path.join(homeDir, '.claude', '.credentials.json');
    let creds;
    let credsSource = '';

    // 1. Versuche zuerst aus Keychain zu laden (primär auf macOS)
    if (process.platform === 'darwin') {
      const username = execSync('whoami', { encoding: 'utf-8' }).trim();
      try {
        creds = execSync(
          `security find-generic-password -s "Claude Code-credentials" -a "${username}" -w`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        credsSource = 'Keychain';
      } catch {
        // Keychain leer - versuche Datei
      }
    }

    // 2. Fallback: credentials.json
    if (!creds && fsNative.existsSync(credentialsPath)) {
      creds = fsNative.readFileSync(credentialsPath, 'utf-8').trim();
      credsSource = 'credentials.json';
    }

    // 3. Keine Credentials gefunden - automatisches Login starten
    if (!creds) {
      log('Keine Credentials gefunden - starte automatisches Login...', 'yellow');
      return await performAutoLogin(baseDir, credentialsPath);
    }

    log(`Credentials aus ${credsSource} geladen`, 'green');

    if (!creds) {
      log('Keine Credentials gefunden', 'red');
      return false;
    }

    // Parse Credentials
    const credsObj = JSON.parse(creds);
    const oauth = credsObj.claudeAiOauth;

    if (!oauth) {
      log('Keine OAuth Daten in Credentials', 'red');
      return false;
    }

    const expiresAt = oauth.expiresAt || 0;
    const currentTime = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 Minuten Puffer

    // Token noch gültig?
    if (expiresAt > currentTime + bufferMs) {
      const minutesLeft = Math.round((expiresAt - currentTime) / 60000);
      log(`✓ Token noch ${minutesLeft} Minuten gültig`, 'green');

      // .env trotzdem aktualisieren
      updateEnvFile(baseDir, creds);
      return true;
    }

    log('Token abgelaufen oder bald ablaufend', 'yellow');

    // Versuche zuerst Refresh via API (mit korrekter Client-ID)
    const refreshToken = oauth.refreshToken;
    if (refreshToken) {
      log('Versuche automatischen Token-Refresh...', 'blue');
      try {
        const refreshResponse = execSync(
          `curl -s -X POST "https://console.anthropic.com/v1/oauth/token" ` +
            `-H "Content-Type: application/x-www-form-urlencoded" ` +
            `-d "grant_type=refresh_token&refresh_token=${refreshToken}&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e"`,
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
        );

        const refreshData = JSON.parse(refreshResponse);

        if (refreshData.access_token) {
          // Erfolg! Neue Credentials speichern
          const newExpiresAt = Date.now() + (refreshData.expires_in || 86400) * 1000;
          credsObj.claudeAiOauth = {
            ...oauth,
            accessToken: refreshData.access_token,
            refreshToken: refreshData.refresh_token || refreshToken,
            expiresAt: newExpiresAt,
          };

          const newCreds = JSON.stringify(credsObj);

          // In Keychain speichern (falls macOS)
          if (process.platform === 'darwin') {
            const username = execSync('whoami', { encoding: 'utf-8' }).trim();
            try {
              execSync(
                `security delete-generic-password -s "Claude Code-credentials" -a "${username}"`,
                { stdio: 'pipe' }
              );
            } catch {
              /* ignorieren */
            }
            execSync(
              `security add-generic-password -s "Claude Code-credentials" -a "${username}" -w '${newCreds.replace(/'/g, "'\\''")}'`,
              { stdio: 'pipe' }
            );
          }

          // Auch in Datei speichern
          fsNative.writeFileSync(credentialsPath, newCreds);
          updateEnvFile(baseDir, newCreds);

          const minutesValid = Math.round((newExpiresAt - Date.now()) / 60000);
          log(`✓ Token automatisch erneuert! Gültig für ${minutesValid} Minuten`, 'green');
          return true;
        }
      } catch (refreshErr) {
        log(`API-Refresh fehlgeschlagen: ${refreshErr.message}`, 'yellow');
      }
    }

    // Refresh fehlgeschlagen - automatisches Login starten
    return await performAutoLogin(baseDir, credentialsPath);
  } catch (err) {
    log(`Token-Refresh Fehler: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Führt automatisches Login via Claude CLI durch
 * Öffnet Browser, wartet auf Abschluss, lädt neue Credentials
 */
async function performAutoLogin(baseDir, credentialsPath) {
  log('Starte automatisches Login...', 'blue');
  console.log('');
  log('═══════════════════════════════════════════════════════════', 'yellow');
  log('  BROWSER ÖFFNET SICH - Bitte einloggen!', 'yellow');
  log('  Das Fenster schließt sich automatisch nach dem Login.', 'yellow');
  log('═══════════════════════════════════════════════════════════', 'yellow');
  console.log('');

  try {
    // Führe claude login aus (blockiert bis Login abgeschlossen)
    execSync('claude /login', {
      stdio: 'inherit',
      timeout: 300000, // 5 Minuten Timeout
    });

    // Kurz warten bis Credentials geschrieben sind
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Lade neue Credentials aus Keychain (primär) oder Datei
    let newCreds;
    if (process.platform === 'darwin') {
      const username = execSync('whoami', { encoding: 'utf-8' }).trim();
      try {
        newCreds = execSync(
          `security find-generic-password -s "Claude Code-credentials" -a "${username}" -w`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
      } catch {
        /* Keychain leer */
      }
    }

    if (!newCreds && fsNative.existsSync(credentialsPath)) {
      newCreds = fsNative.readFileSync(credentialsPath, 'utf-8').trim();
    }

    if (newCreds) {
      const newCredsObj = JSON.parse(newCreds);
      const newOauth = newCredsObj.claudeAiOauth;

      if (newOauth && newOauth.expiresAt > Date.now()) {
        // Sync: Speichere in credentials.json falls noch nicht vorhanden
        if (!fsNative.existsSync(credentialsPath)) {
          fsNative.writeFileSync(credentialsPath, newCreds);
        }
        updateEnvFile(baseDir, newCreds);

        const minutesValid = Math.round((newOauth.expiresAt - Date.now()) / 60000);
        log(`✓ Login erfolgreich! Token gültig für ${minutesValid} Minuten`, 'green');
        return true;
      }
    }

    log('Login möglicherweise nicht abgeschlossen - bitte erneut versuchen', 'yellow');
    return false;
  } catch (loginErr) {
    if (loginErr.message.includes('ETIMEDOUT') || loginErr.message.includes('timeout')) {
      log('Login-Timeout - bitte manuell "claude /login" ausführen', 'red');
    } else {
      log(`Login-Fehler: ${loginErr.message}`, 'red');
    }
    return false;
  }
}

/**
 * Aktualisiert die .env Datei mit neuen OAuth Credentials
 * @param {string} baseDir - Base directory des Projekts
 * @param {string} creds - JSON string der Credentials
 */
function updateEnvFile(baseDir, creds) {
  const envPath = path.join(baseDir, '.env');

  let envContent = '';
  if (fsNative.existsSync(envPath)) {
    envContent = fsNative.readFileSync(envPath, 'utf-8');
  }

  // Entferne alte CLAUDE_OAUTH_CREDENTIALS Zeile
  envContent = envContent
    .split('\n')
    .filter((line) => !line.startsWith('CLAUDE_OAUTH_CREDENTIALS='))
    .join('\n');

  // Füge neue Zeile hinzu
  if (!envContent.endsWith('\n') && envContent.length > 0) {
    envContent += '\n';
  }
  envContent += `CLAUDE_OAUTH_CREDENTIALS=${creds}\n`;

  fsNative.writeFileSync(envPath, envContent);
}

/**
 * Launch only the Docker server container for use with local Electron
 * Uses docker-compose.dev-server.yml which only runs the backend API
 * Also includes docker-compose.override.yml if it exists (for workspace mounts)
 * Automatically launches Electron once the server is healthy.
 * @param {object} options - Configuration options
 * @param {string} options.baseDir - Base directory containing docker-compose.dev-server.yml
 * @param {object} options.processes - Processes object to track docker process
 * @returns {Promise<void>}
 */
export async function launchDockerDevServerContainer({ baseDir, processes }) {
  log('Launching Docker Server Container + Local Electron...', 'blue');
  console.log('');

  // AUTO-REFRESH: Prüfe und erneuere Claude OAuth Token
  const tokenValid = await refreshClaudeOAuthToken(baseDir);
  if (!tokenValid) {
    log('⚠️  OAuth Token konnte nicht validiert/erneuert werden', 'yellow');
    log('Falls Fehler auftreten, bitte "claude /login" ausführen', 'yellow');
    console.log('');
  }

  // Check if ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    log('Warning: ANTHROPIC_API_KEY environment variable is not set.', 'yellow');
    log('The server will require an API key to function.', 'yellow');
    log('Set it with: export ANTHROPIC_API_KEY=your-key', 'yellow');
    console.log('');
  }

  // Start MEGABRAIN 8 before Docker container (runs on host, not in container)
  await startMegabrain8(processes);
  console.log('');

  log('Starting server container...', 'yellow');
  log('Source code is volume mounted for live reload', 'yellow');
  log('Running npm install inside container (this may take a moment on first run)...', 'yellow');
  console.log('');

  // Build compose file arguments
  // Start with dev-server compose file, then add override if it exists
  const composeArgs = ['compose', '-f', 'docker-compose.dev-server.yml'];

  // Check if docker-compose.override.yml exists and include it for workspace mounts
  const overridePath = path.join(baseDir, 'docker-compose.override.yml');
  if (fsNative.existsSync(overridePath)) {
    composeArgs.push('-f', 'docker-compose.override.yml');
    log('Using docker-compose.override.yml for workspace mount', 'yellow');
  }

  composeArgs.push('up', '--build', '-d'); // -d = detached mode (Hintergrund)

  // Use docker-compose.dev-server.yml for server-only development
  // Run detached so no terminal window is needed
  processes.docker = crossSpawn('docker', composeArgs, {
    stdio: 'pipe', // Don't show logs in terminal
    cwd: baseDir,
    env: {
      ...process.env,
    },
  });

  log('Server container starting im Hintergrund...', 'blue');
  log('API will be available at: http://localhost:3008', 'green');
  log('Logs anzeigen: docker logs -f automaker-dev-server-only', 'yellow');
  console.log('');

  // Wait for the server to become healthy
  log('Waiting for server to be ready...', 'yellow');
  const serverPort = 3008;
  const maxRetries = 120; // 2 minutes (first run may need npm install + build)
  let serverReady = false;

  for (let i = 0; i < maxRetries; i++) {
    if (await checkHealth(serverPort)) {
      serverReady = true;
      break;
    }
    await sleep(1000);
    // Show progress dots every 5 seconds
    if (i > 0 && i % 5 === 0) {
      process.stdout.write('.');
    }
  }

  if (!serverReady) {
    console.log('');
    log('Error: Server container failed to become healthy', 'red');
    log('Check the Docker logs above for errors', 'red');
    return;
  }

  console.log('');
  log('Server is ready! Launching Electron...', 'green');
  console.log('');

  // Build shared packages before launching Electron
  log('Building shared packages...', 'blue');
  try {
    await runNpmAndWait(['run', 'build:packages'], { stdio: 'inherit' }, baseDir);
  } catch (error) {
    log('Failed to build packages: ' + error.message, 'red');
    return;
  }

  // Launch Electron with SKIP_EMBEDDED_SERVER=true
  // This tells Electron to connect to the external Docker server instead of starting its own
  processes.electron = crossSpawn('npm', ['run', '_dev:electron'], {
    stdio: 'inherit',
    cwd: baseDir,
    env: {
      ...process.env,
      SKIP_EMBEDDED_SERVER: 'true',
      PORT: '3008',
      VITE_SERVER_URL: 'http://localhost:3008',
      VITE_APP_MODE: '4',
    },
  });

  log('Electron launched with SKIP_EMBEDDED_SERVER=true', 'green');
  log('Docker container läuft im Hintergrund.', 'yellow');
  log('Press Ctrl+C to stop Electron. Container stoppt automatisch.', 'yellow');
  console.log('');

  // Wait for Electron to exit (Docker runs detached in background)
  await new Promise((resolve) => processes.electron.on('close', resolve));

  // Stop Docker container when Electron closes
  log('Stopping Docker container...', 'yellow');
  try {
    execSync('docker compose -f docker-compose.dev-server.yml down', {
      cwd: baseDir,
      stdio: 'pipe',
    });
    log('Docker container gestoppt.', 'green');
  } catch {
    // Container might already be stopped
  }
}

/**
 * Launch Docker containers with docker-compose (production mode)
 * Uses git commit SHA to determine if rebuild is needed
 * @param {object} options - Configuration options
 * @param {string} options.baseDir - Base directory containing docker-compose.yml
 * @param {object} options.processes - Processes object to track docker process
 * @returns {Promise<void>}
 */
export async function launchDockerContainers({ baseDir, processes }) {
  log('Launching Docker Container (Isolated Mode)...', 'blue');

  // Check if ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    log('Warning: ANTHROPIC_API_KEY environment variable is not set.', 'yellow');
    log('The server will require an API key to function.', 'yellow');
    log('Set it with: export ANTHROPIC_API_KEY=your-key', 'yellow');
    console.log('');
  }

  // Check if rebuild is needed based on git commit SHA
  const rebuildCheck = shouldRebuildDockerImages(baseDir);

  if (rebuildCheck.needsRebuild) {
    log(`Rebuild needed: ${rebuildCheck.reason}`, 'yellow');

    if (rebuildCheck.currentSha) {
      log(`Building images for commit: ${rebuildCheck.currentSha.substring(0, 8)}`, 'blue');
    }
    console.log('');

    // Build with commit SHA label
    const buildArgs = ['compose', 'build'];
    if (rebuildCheck.currentSha) {
      buildArgs.push('--build-arg', `GIT_COMMIT_SHA=${rebuildCheck.currentSha}`);
    }

    const buildProcess = crossSpawn('docker', buildArgs, {
      stdio: 'inherit',
      cwd: baseDir,
    });

    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code !== 0) {
          log('Build failed. Exiting.', 'red');
          reject(new Error(`Docker build failed with code ${code}`));
        } else {
          log('Build complete. Starting containers...', 'green');
          console.log('');
          resolve();
        }
      });
      buildProcess.on('error', (err) => reject(err));
    });

    // Start containers (already built above)
    processes.docker = crossSpawn('docker', ['compose', 'up'], {
      stdio: 'inherit',
      cwd: baseDir,
      env: {
        ...process.env,
      },
    });
  } else {
    log(
      `Images are up to date (commit: ${rebuildCheck.currentSha?.substring(0, 8) || 'unknown'})`,
      'green'
    );
    log('Starting Docker containers...', 'yellow');
    console.log('');

    // Start containers without rebuilding
    processes.docker = crossSpawn('docker', ['compose', 'up'], {
      stdio: 'inherit',
      cwd: baseDir,
      env: {
        ...process.env,
      },
    });
  }

  log('Docker containers starting...', 'blue');
  log('UI will be available at: http://localhost:3007', 'green');
  log('API will be available at: http://localhost:3008', 'green');
  console.log('');
  log('Press Ctrl+C to stop the containers.', 'yellow');

  await new Promise((resolve) => {
    processes.docker.on('close', resolve);
  });
}

// =============================================================================
// MEGABRAIN 8 Auto-Start
// =============================================================================

const MEGABRAIN_PATH = '/Users/chriscrossmedia/Megabrain 8.0';
const MEGABRAIN_API_PORT = 8081;

/**
 * Check if MEGABRAIN 8 is already running
 * @returns {Promise<boolean>} True if MEGABRAIN is running on port 8081
 */
async function isMegabrainRunning() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: MEGABRAIN_API_PORT,
        path: '/health',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Start MEGABRAIN 8 API server
 * Runs megabrain8_startup.py in the background
 * @param {object} processes - Processes object to track megabrain process
 * @returns {Promise<boolean>} True if MEGABRAIN started successfully
 */
export async function startMegabrain8(processes = {}) {
  // Check if already running
  if (await isMegabrainRunning()) {
    log('MEGABRAIN 8 is already running on port ' + MEGABRAIN_API_PORT, 'green');
    return true;
  }

  log('Starting MEGABRAIN 8...', 'blue');

  // Check if MEGABRAIN path exists
  if (!fsNative.existsSync(MEGABRAIN_PATH)) {
    log('Warning: MEGABRAIN 8 path not found: ' + MEGABRAIN_PATH, 'yellow');
    log('MEGABRAIN features will not be available.', 'yellow');
    return false;
  }

  // Check if startup script exists
  const startupScript = path.join(MEGABRAIN_PATH, 'megabrain8_startup.py');
  if (!fsNative.existsSync(startupScript)) {
    log('Warning: MEGABRAIN startup script not found: ' + startupScript, 'yellow');
    return false;
  }

  try {
    // Start MEGABRAIN in background with detached process
    const megabrainProcess = crossSpawn('python3', [startupScript], {
      cwd: MEGABRAIN_PATH,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MEGABRAIN_INSTANCE_ID: 'automaker',
        MEGABRAIN_INSTANCE_TYPE: 'api',
      },
    });

    // Store reference for cleanup
    if (processes) {
      processes.megabrain = megabrainProcess;
    }

    // Unref to allow parent to exit independently (but we'll manage cleanup)
    megabrainProcess.unref();

    // Log output for debugging
    if (megabrainProcess.stdout) {
      megabrainProcess.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line.includes('ERROR') || line.includes('error')) {
          log('[MEGABRAIN] ' + line, 'red');
        }
      });
    }

    if (megabrainProcess.stderr) {
      megabrainProcess.stderr.on('data', (data) => {
        const line = data.toString().trim();
        if (line && !line.includes('INFO')) {
          log('[MEGABRAIN] ' + line, 'yellow');
        }
      });
    }

    // Wait for MEGABRAIN to become healthy (max 30 seconds)
    log('Waiting for MEGABRAIN 8 to start...', 'yellow');
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await sleep(1000);
      if (await isMegabrainRunning()) {
        log('MEGABRAIN 8 started successfully on port ' + MEGABRAIN_API_PORT, 'green');
        return true;
      }
      if (i > 0 && i % 5 === 0) {
        process.stdout.write('.');
      }
    }

    console.log('');
    log('Warning: MEGABRAIN 8 did not become healthy within 30 seconds', 'yellow');
    log('MEGABRAIN features may not be available.', 'yellow');
    return false;
  } catch (error) {
    log('Error starting MEGABRAIN 8: ' + error.message, 'red');
    return false;
  }
}
