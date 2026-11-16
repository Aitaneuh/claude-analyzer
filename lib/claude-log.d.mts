export interface ParsedBatch {
  messages: Array<Record<string, any>>
  tools: Array<Record<string, any>>
  toolResults: Array<Record<string, any>>
  prompts: Array<Record<string, any>>
  sessions: Array<Record<string, any>>
}
export function emptyBatch(): ParsedBatch
export function batchSize(b: ParsedBatch): number
export function projectName(cwd: string | null | undefined): string
export function parseLine(line: string, batch: ParsedBatch): void
export function listLogFiles(dir: string): string[]
export function readNewLines(file: string, offset?: number): { lines: string[], offset: number, size: number }
