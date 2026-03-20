#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {init} from './cli/init.js';
import {version} from './cli/version.js';
import {printHelp} from './cli/help.js';
import {main} from './main.js';

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error: unknown) => {
  console.error('Unhandled rejection:', error);
});

interface CliOptions {
  init?: boolean;
  help?: boolean;
  version?: boolean;
}

let values: CliOptions;

try {
  const args = parseArgs({
    options: {
      init: {type: 'boolean', short: 'i'},
      help: {type: 'boolean', short: 'h'},
      version: {type: 'boolean', short: 'v'},
    },
  });
  values = args.values as CliOptions;
} catch {
  console.error('Unrecognized argument. Run `web4cool-mcp --help`.');
  process.exit(1);
}

if (values.help) {
  printHelp();
  process.exit(0);
}

if (values.version) {
  console.log(version);
  process.exit(0);
}

if (values.init) {
  await init();
  process.exit(0);
}

main().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
