#!/usr/bin/env node

/**
 * Electron-builder afterPack hook
 * Rebuilds native modules in the server bundle for the target architecture
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

exports.default = async function (context) {
  const { appOutDir, electronPlatformName, arch, packager } = context;
  const electronVersion = packager.config.electronVersion;

  // Convert arch to string if it's a number (electron-builder sometimes passes indices)
  const archNames = ['ia32', 'x64', 'armv7l', 'arm64', 'universal'];
  const archStr = typeof arch === 'number' ? archNames[arch] : arch;

  console.log(`\n🔨 Rebuilding server native modules for ${electronPlatformName}-${archStr}...`);

  // Path to server node_modules in the packaged app
  let serverNodeModulesPath;
  if (electronPlatformName === 'darwin') {
    serverNodeModulesPath = path.join(
      appOutDir,
      `${packager.appInfo.productName}.app`,
      'Contents',
      'Resources',
      'server',
      'node_modules'
    );
  } else if (electronPlatformName === 'win32') {
    serverNodeModulesPath = path.join(appOutDir, 'resources', 'server', 'node_modules');
  } else {
    serverNodeModulesPath = path.join(appOutDir, 'resources', 'server', 'node_modules');
  }

  try {
    // Rebuild native modules for the target architecture
    const rebuildCmd = `npx --yes @electron/rebuild --version=${electronVersion} --arch=${archStr} --force --module-dir="${serverNodeModulesPath}/.."`;

    console.log(`   Command: ${rebuildCmd}`);

    // Set environment variables to help node-gyp find CLT
    const sdkPath = '/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk';
    const cxxInclude = `${sdkPath}/usr/include/c++/v1`;
    const env = {
      ...process.env,
      DEVELOPER_DIR: '/Library/Developer/CommandLineTools',
      SDKROOT: sdkPath,
      CC: '/Library/Developer/CommandLineTools/usr/bin/clang',
      CXX: '/Library/Developer/CommandLineTools/usr/bin/clang++',
      MACOSX_DEPLOYMENT_TARGET: '10.15',
      // Force gyp to use CLT without receipt check
      GYP_CROSSCOMPILE: '1',
      // Add C++ include paths
      CXXFLAGS: `-isysroot ${sdkPath} -I${cxxInclude}`,
      CPPFLAGS: `-isysroot ${sdkPath} -I${cxxInclude}`,
      CFLAGS: `-isysroot ${sdkPath}`
    };

    const { stdout, stderr } = await execAsync(rebuildCmd, { env, timeout: 300000 });
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✅ Server native modules rebuilt successfully for ${archStr}\n`);
  } catch (error) {
    console.warn(`⚠️  Native module rebuild failed, using existing prebuilds...`);
    console.warn(`   This may affect terminal functionality. Error: ${error.message}`);

    // Try to use prebuild-install as fallback
    try {
      const fs = require('fs');
      const nodePtyPath = path.join(serverNodeModulesPath, 'node-pty');
      const prebuildsPath = path.join(nodePtyPath, 'prebuilds', `darwin-${archStr}`);

      if (fs.existsSync(prebuildsPath)) {
        console.log(`   ✅ Found existing prebuilds at ${prebuildsPath}`);
        console.log(`   Terminal functionality may work with Node.js ABI compatibility.`);
      }
    } catch {
      // Ignore fallback errors
    }
  }
};
