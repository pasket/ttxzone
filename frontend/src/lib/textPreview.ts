/** Inject files whose name says they're text (logs, exports, configs,
 * scripts...): those get a "Preview" next to their download. The server
 * still decides (409 MSEL_FILE_NOT_TEXT when a file doesn't read as
 * text), so a misnamed binary only shows a message. */
const TEXT_EXTENSIONS = new Set([
  'log',
  'txt',
  'text',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'ndjson',
  'xml',
  'yaml',
  'yml',
  'md',
  'conf',
  'cfg',
  'ini',
  'toml',
  'env',
  'eml',
  'har',
  'html',
  'htm',
  'js',
  'ps1',
  'psm1',
  'sh',
  'bash',
  'bat',
  'cmd',
  'vbs',
  'py',
  'sql',
  'rules',
  'yar',
  'yara',
  'ioc',
  'syslog',
  'out',
  'err',
  'diff',
  'patch',
])

export function isTextPreviewable(name: string): boolean {
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  return dot > 0 && TEXT_EXTENSIONS.has(lower.slice(dot + 1))
}
