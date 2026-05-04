import path from 'path';
import { childLogger } from '../utils/logger';
import type { AnalysisInput } from './analysisAgent';
import type { OpencodeInstance, OpencodeClient } from '@opencode-ai/sdk';
const log = childLogger('opencodeService');

// ─── Singleton State ──────────────────────────────────────────────────────────

let _instance: OpencodeInstance | null = null;
let _initPromise: Promise<OpencodeInstance> | null = null;

// Project root so OpenCode can find AGENTS.md
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

async function getOpencodeInstance(): Promise<OpencodeInstance> {
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    log.info('Starting OpenCode server (project root: %s)', PROJECT_ROOT);
    // Dynamic import — only available when @opencode-ai/sdk is installed
    const { createOpencode } = await import('@opencode-ai/sdk');
    const inst = await (createOpencode as (opts?: Record<string, unknown>) => Promise<OpencodeInstance>)({
      hostname: '127.0.0.1',
      port: 4096,
      timeout: 15_000,
    });
    _instance = inst;
    log.info('OpenCode server ready at %s', inst.server.url);
    return inst;
  })();

  return _initPromise;
}

// ─── Build the system context string ─────────────────────────────────────────

function buildSystemContext(input: AnalysisInput, agentMarkdown?: string): string {
  const language = input.locale === 'tr' ? 'Turkish' : 'English';
  const lines: string[] = [];

  if (agentMarkdown) {
    // Use the user's custom agent definition verbatim
    lines.push(agentMarkdown);
    lines.push('');
    lines.push(`Write ALL output in ${language}. Produce only the Markdown document — no preamble.`);
  } else {
    lines.push(`You are a Senior Business Analyst. Write ALL output in ${language}.`);
    lines.push('Follow the output format defined in AGENTS.md exactly. Produce only the Markdown document — no preamble.');
  }

  if (input.repoContext) {
    lines.push('\n--- REPO CONTEXT ---');
    lines.push(input.repoContext.slice(0, 20_000));
  }

  return lines.join('\n');
}

// ─── Build the user prompt ────────────────────────────────────────────────────

function buildUserPrompt(input: AnalysisInput): string {
  const lines: string[] = [];

  lines.push('## User Request');
  lines.push(input.userMessage);

  if (input.pdfText) {
    lines.push('\n## Attached Document (PDF)');
    lines.push(input.pdfText.slice(0, 15_000));
  }

  lines.push('\nPlease produce the structured analysis Markdown document now.');
  return lines.join('\n');
}

// ─── Collect streamed text parts ─────────────────────────────────────────────

async function collectStreamedOutput(client: OpencodeClient, sessionId: string): Promise<string> {
  const chunks: string[] = [];
  const deadline = Date.now() + 120_000; // 2 minute safety timeout

  try {
    const sub = await client.event.subscribe();
    for await (const event of sub.stream) {
      if (Date.now() > deadline) {
        log.warn('OpenCode stream deadline exceeded for session %s', sessionId);
        break;
      }

      const props = event.properties as Record<string, unknown> | undefined;

      // Collect assistant message part text
      if (
        event.type === 'message.part' &&
        props?.sessionID === sessionId &&
        typeof props?.content === 'string'
      ) {
        chunks.push(props.content as string);
      }

      // Stop when the AI response is complete
      if (
        (event.type === 'message.completed' || event.type === 'session.idle') &&
        props?.sessionID === sessionId
      ) {
        break;
      }

      // Stop on error
      if (event.type === 'session.error' && props?.sessionID === sessionId) {
        throw new Error(`OpenCode session error: ${String(props?.message ?? 'unknown')}`);
      }
    }
  } catch (err: unknown) {
    // If event stream itself fails, try to fetch messages directly
    log.warn('Event stream failed, falling back to message fetch: %s', (err as Error).message);
  }

  return chunks.join('');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a business analysis using the local OpenCode server.
 * Returns a Markdown string matching the AGENTS.md output format.
 */
export async function runAnalysisWithOpenCode(input: AnalysisInput, agentMarkdown?: string): Promise<string> {
  const { client } = await getOpencodeInstance();

  // 1. Create a fresh session
  const session = await client.session.create({ body: { title: 'Business Analysis' } });
  log.info('OpenCode session created: %s', session.id);

  // 2. Inject system context without triggering a response
  await client.session.prompt({
    path: { id: session.id },
    body: {
      noReply: true,
      parts: [{ type: 'text', text: buildSystemContext(input, agentMarkdown) }],
    },
  });

  // 3. Start collecting events BEFORE sending the actual prompt
  const collectPromise = collectStreamedOutput(client, session.id);

  // 4. Send the user prompt — AI will respond
  const result = await client.session.prompt({
    path: { id: session.id },
    body: {
      parts: [{ type: 'text', text: buildUserPrompt(input) }],
    },
  });

  // 5. Try to get text directly from prompt result first (sync response)
  let md = '';
  if (result?.data?.parts) {
    for (const part of result.data.parts) {
      if (part.type === 'text' && part.text) {
        md += part.text;
      }
    }
  }

  // 6. Fall back to streamed output if direct result was empty
  if (!md.trim()) {
    md = await collectPromise;
  }

  if (!md.trim()) {
    throw new Error('OpenCode returned an empty response. Check provider configuration.');
  }

  // Strip code fences if the model wrapped the output
  const fenceMatch = md.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    md = fenceMatch[1].trim();
  }

  log.info('OpenCode analysis complete for session %s (%d chars)', session.id, md.length);
  return md;
}

/**
 * Gracefully shut down the OpenCode server (call on process exit).
 */
export function closeOpencodeServer(): void {
  if (_instance) {
    try {
      _instance.server.close();
      log.info('OpenCode server closed');
    } catch {
      // ignore
    }
    _instance = null;
    _initPromise = null;
  }
}
