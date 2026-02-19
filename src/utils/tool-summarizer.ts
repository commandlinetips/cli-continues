/**
 * Shared tool call summarizer — formatting helpers + SummaryCollector.
 * Each parser normalizes its raw tool events and uses these utilities
 * for consistent, concise summaries across all 5 CLIs.
 */
import type { ToolSample, ToolUsageSummary } from '../types/index.js';

// ── Formatting Helpers ──────────────────────────────────────────────────────

/** Truncate a string, adding '...' if it exceeds max length */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

/** Extract exit code from tool result text */
export function extractExitCode(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/exit(?:ed with)? code[:\s]+(\d+)/i);
  return m ? parseInt(m[1]) : undefined;
}

/** Append ` → "result"` to a summary if result is non-empty */
export function withResult(summary: string, result?: string): string {
  if (!result) return summary;
  return `${summary} → "${truncate(result, 80)}"`;
}

/** Format a shell command invocation */
export function shellSummary(cmd: string, result?: string): string {
  let s = `$ ${truncate(cmd, 80)}`;
  const exitCode = extractExitCode(result);
  if (exitCode !== undefined) {
    s += ` → exit ${exitCode}`;
  } else if (result) {
    s += ` → "${truncate(result, 80)}"`;
  }
  return s;
}

/** Format a file operation (read/write/edit) */
export function fileSummary(
  op: 'read' | 'write' | 'edit',
  filePath: string,
  diffStat?: { added: number; removed: number },
  isNewFile?: boolean,
): string {
  let s = `${op} ${filePath}`;
  if (isNewFile) {
    s += ' (new file)';
  } else if (diffStat) {
    s += ` (+${diffStat.added} -${diffStat.removed} lines)`;
  }
  return s;
}

/** Format a grep invocation */
export function grepSummary(pattern: string, targetPath?: string): string {
  return `grep "${pattern}" ${targetPath || ''}`.trim();
}

/** Format a glob invocation */
export function globSummary(pattern: string): string {
  return `glob "${pattern}"`;
}

/** Format a web search */
export function searchSummary(query: string): string {
  return `search "${truncate(query, 60)}"`;
}

/** Format a web fetch */
export function fetchSummary(url: string): string {
  return `fetch ${truncate(url, 80)}`;
}

/** Format an MCP or generic tool call */
export function mcpSummary(name: string, argsStr: string, result?: string): string {
  let s = `${name}(${argsStr})`;
  if (result) s += ` → "${truncate(result, 80)}"`;
  return s;
}

/** Format a subagent/task invocation */
export function subagentSummary(desc: string, type?: string): string {
  if (type) return `task "${truncate(desc, 60)}" (${type})`;
  return `task-output: ${truncate(desc, 80)}`;
}

// ── SummaryCollector ────────────────────────────────────────────────────────

/**
 * Accumulates tool call summaries by category (tool name).
 * Keeps up to `maxSamples` representative samples per category
 * and tracks files modified.
 */
export class SummaryCollector {
  private data = new Map<string, { count: number; samples: ToolSample[] }>();
  private files = new Set<string>();
  private maxSamples: number;

  constructor(maxSamples = 3) {
    this.maxSamples = maxSamples;
  }

  /** Add a tool invocation. Optionally tracks file modification. */
  add(category: string, summary: string, filePath?: string, isWrite?: boolean): void {
    if (!this.data.has(category)) {
      this.data.set(category, { count: 0, samples: [] });
    }
    const entry = this.data.get(category)!;
    entry.count++;
    if (entry.samples.length < this.maxSamples) {
      entry.samples.push({ summary });
    }
    if (isWrite && filePath) {
      this.files.add(filePath);
    }
  }

  /** Track a file modification without adding a tool summary entry */
  trackFile(filePath: string): void {
    this.files.add(filePath);
  }

  /** Get aggregated tool usage summaries */
  getSummaries(): ToolUsageSummary[] {
    return Array.from(this.data.entries()).map(([name, { count, samples }]) => ({
      name,
      count,
      samples,
    }));
  }

  /** Get deduplicated list of files modified */
  getFilesModified(): string[] {
    return Array.from(this.files);
  }
}
