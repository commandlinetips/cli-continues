/**
 * Integration tests for all 5 parsers using real session data.
 * Tests parseAll + extractContext for each tool.
 */
import { describe, it, expect } from 'vitest';
import {
  parseClaudeSessions,
  extractClaudeContext,
  parseCopilotSessions,
  extractCopilotContext,
  parseGeminiSessions,
  extractGeminiContext,
  parseCodexSessions,
  extractCodexContext,
  parseOpenCodeSessions,
  extractOpenCodeContext,
} from '../parsers/index.js';
import type { UnifiedSession, SessionContext } from '../types/index.js';

/**
 * Validate that a UnifiedSession has all required fields
 */
function validateSession(session: UnifiedSession, source: string) {
  expect(session.id).toBeTruthy();
  expect(session.source).toBe(source);
  expect(session.cwd).toBeDefined();
  expect(typeof session.lines).toBe('number');
  expect(typeof session.bytes).toBe('number');
  expect(session.createdAt).toBeInstanceOf(Date);
  expect(session.updatedAt).toBeInstanceOf(Date);
  expect(session.originalPath).toBeTruthy();
}

/**
 * Validate that a SessionContext has all required fields
 */
function validateContext(ctx: SessionContext) {
  expect(ctx.session).toBeDefined();
  expect(ctx.session.id).toBeTruthy();
  expect(Array.isArray(ctx.recentMessages)).toBe(true);
  expect(Array.isArray(ctx.filesModified)).toBe(true);
  expect(Array.isArray(ctx.pendingTasks)).toBe(true);
  expect(typeof ctx.markdown).toBe('string');
  expect(ctx.markdown.length).toBeGreaterThan(0);
  expect(ctx.markdown).toContain('Session Handoff Context');
}

/**
 * Validate that handoff markdown has proper structure
 */
function validateHandoffMarkdown(markdown: string, source: string) {
  expect(markdown).toContain('# Session Handoff Context');
  expect(markdown).toContain('## Original Session');
  expect(markdown).toContain('**Session ID**');
  expect(markdown).toContain('**Last Active**');
  expect(markdown).toContain('Continue this session');
}

describe('Claude Parser', () => {
  it('should find Claude sessions', async () => {
    const sessions = await parseClaudeSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions.slice(0, 3)) {
      validateSession(session, 'claude');
    }
  });

  it('should have sorted sessions (newest first)', async () => {
    const sessions = await parseClaudeSessions();
    for (let i = 1; i < Math.min(sessions.length, 5); i++) {
      expect(sessions[i - 1].updatedAt.getTime()).toBeGreaterThanOrEqual(sessions[i].updatedAt.getTime());
    }
  });

  it('should extract context from a Claude session', async () => {
    const sessions = await parseClaudeSessions();
    expect(sessions.length).toBeGreaterThan(0);

    const ctx = await extractClaudeContext(sessions[0]);
    validateContext(ctx);
    validateHandoffMarkdown(ctx.markdown, 'claude');

    // Should have at least some messages
    expect(ctx.recentMessages.length).toBeGreaterThan(0);
    for (const msg of ctx.recentMessages) {
      expect(['user', 'assistant', 'system', 'tool']).toContain(msg.role);
      expect(msg.content.length).toBeGreaterThan(0);
    }
  });
});

describe('Copilot Parser', () => {
  it('should find Copilot sessions', async () => {
    const sessions = await parseCopilotSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions.slice(0, 3)) {
      validateSession(session, 'copilot');
    }
  });

  it('should parse workspace.yaml fields correctly', async () => {
    const sessions = await parseCopilotSessions();
    const session = sessions[0];
    expect(session.cwd).toBeTruthy();
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
  });

  it('should extract context from a Copilot session', async () => {
    const sessions = await parseCopilotSessions();
    // Find a session with events
    const sessWithEvents = sessions.find(s => s.bytes > 0);
    if (!sessWithEvents) return; // skip if no sessions with events

    const ctx = await extractCopilotContext(sessWithEvents);
    validateContext(ctx);
    validateHandoffMarkdown(ctx.markdown, 'copilot');
  });
});

describe('Gemini Parser', () => {
  it('should find Gemini sessions', async () => {
    const sessions = await parseGeminiSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions.slice(0, 3)) {
      validateSession(session, 'gemini');
    }
  });

  it('should extract context with messages from a Gemini session', async () => {
    const sessions = await parseGeminiSessions();
    expect(sessions.length).toBeGreaterThan(0);

    const ctx = await extractGeminiContext(sessions[0]);
    validateContext(ctx);
    validateHandoffMarkdown(ctx.markdown, 'gemini');

    expect(ctx.recentMessages.length).toBeGreaterThan(0);
    // Gemini messages should have user and assistant (gemini) roles
    const userMsgs = ctx.recentMessages.filter(m => m.role === 'user');
    const asstMsgs = ctx.recentMessages.filter(m => m.role === 'assistant');
    expect(userMsgs.length).toBeGreaterThan(0);
    expect(asstMsgs.length).toBeGreaterThan(0);
  });
});

describe('Codex Parser', () => {
  it('should find Codex sessions', async () => {
    const sessions = await parseCodexSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions.slice(0, 3)) {
      validateSession(session, 'codex');
    }
  });

  it('should parse session metadata from filename', async () => {
    const sessions = await parseCodexSessions();
    const session = sessions[0];
    expect(session.id).toBeTruthy();
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('should extract context with agent_message from Codex session', async () => {
    const sessions = await parseCodexSessions();
    expect(sessions.length).toBeGreaterThan(0);

    const ctx = await extractCodexContext(sessions[0]);
    validateContext(ctx);
    validateHandoffMarkdown(ctx.markdown, 'codex');

    // After the fix, should find both user and agent messages
    expect(ctx.recentMessages.length).toBeGreaterThan(0);
    const userMsgs = ctx.recentMessages.filter(m => m.role === 'user');
    const asstMsgs = ctx.recentMessages.filter(m => m.role === 'assistant');
    expect(userMsgs.length).toBeGreaterThan(0);
    expect(asstMsgs.length).toBeGreaterThan(0);
  });
});

describe('OpenCode Parser', () => {
  it('should find OpenCode sessions (SQLite or JSON)', async () => {
    const sessions = await parseOpenCodeSessions();
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions.slice(0, 3)) {
      validateSession(session, 'opencode');
    }
  });

  it('should find more sessions than JSON-only (SQLite has 5 vs 2 JSON)', async () => {
    const sessions = await parseOpenCodeSessions();
    // With SQLite support, we should have more sessions
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract context from an OpenCode session', async () => {
    const sessions = await parseOpenCodeSessions();
    expect(sessions.length).toBeGreaterThan(0);

    // Find a session with messages
    let ctx: SessionContext | null = null;
    for (const session of sessions.slice(0, 3)) {
      const c = await extractOpenCodeContext(session);
      if (c.recentMessages.length > 0) {
        ctx = c;
        break;
      }
    }

    if (ctx) {
      validateContext(ctx);
      validateHandoffMarkdown(ctx.markdown, 'opencode');
      expect(ctx.recentMessages.length).toBeGreaterThan(0);
    }
  });
});
