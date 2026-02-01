export type OutputOptions = {
  json?: boolean;
  pretty?: boolean;
};

export function formatJson(value: unknown, opts: OutputOptions = {}): string {
  const space = opts.pretty ? 2 : 0;
  return JSON.stringify(value, null, space) + '\n';
}
