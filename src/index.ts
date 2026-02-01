export function main(argv: string[]): number {
  // Placeholder CLI entry point.
  // Next: parse args, read config, call GitHub client.
  if (argv.includes('--help') || argv.length <= 2) {
    process.stdout.write('pr-autopilot (WIP)\n');
    process.stdout.write('Usage: pr-autopilot <command>\n');
    process.stdout.write('Commands: ping\n');
    return 0;
  }

  const cmd = argv[2];
  if (cmd === 'ping') {
    process.stdout.write('pong\n');
    return 0;
  }

  process.stderr.write(`Unknown command: ${cmd}\n`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv));
}
