import { spawn } from 'child_process';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { Schema } from '@google/generative-ai';
import OpenAI from 'openai';
import type { AdoWorkItem } from './azDevops';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIEstimateResult {
  'story-point': number;
  reason: string;
  'similar-items': string[];
}

export interface ReferenceScoreItem {
  title: string;
  description: string | null;
  story_points: number;
}

export interface PreviousSprintItem {
  id: number;
  title: string;
  description: string;
  storyPoints: number;
  adoUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip HTML tags to produce plain text suitable for AI prompts. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Extract JSON object from AI response text (handles markdown code fences). */
export function extractJSON(raw: string): AIEstimateResult {
  // Remove markdown code fences if present
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // Find the first { ... } block
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in AI response: ${raw.slice(0, 200)}`);
  }
  cleaned = cleaned.slice(start, end + 1);

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const storyPoint = Number(parsed['story-point'] ?? parsed['story_point'] ?? parsed['storyPoint'] ?? 0);
  const reason = String(parsed['reason'] ?? '');
  const similarItems = Array.isArray(parsed['similar-items'])
    ? (parsed['similar-items'] as unknown[]).map(String)
    : [];

  if (!Number.isFinite(storyPoint) || storyPoint <= 0) {
    throw new Error(`Invalid story-point value in AI response: ${storyPoint}`);
  }

  return { 'story-point': storyPoint, reason, 'similar-items': similarItems };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildEstimationPrompt(
  workItem: AdoWorkItem,
  referenceScores: ReferenceScoreItem[],
  previousSprintItems: PreviousSprintItem[],
  locale?: string,
): string {
  const lines: string[] = [];

  lines.push(
    'You are an expert agile story point estimator using the Fibonacci scale: 1, 2, 3, 5, 8, 13, 21, 34, 55.',
    '',
  );

  if (referenceScores.length > 0) {
    lines.push('## Reference Work Items (calibration anchors)');
    for (const r of referenceScores) {
      const desc = r.description ? ` — ${r.description.slice(0, 200)}` : '';
      lines.push(`- "${r.title}"${desc} → ${r.story_points} story points`);
    }
    lines.push('');
  }

  if (previousSprintItems.length > 0) {
    lines.push('## Previous Sprint Work Items (for context)');
    for (const item of previousSprintItems) {
      const desc = item.description ? stripHtml(item.description).slice(0, 300) : 'No description';
      lines.push(`- "${item.title}" → ${item.storyPoints} story points`);
      lines.push(`  URL: ${item.adoUrl}`);
      lines.push(`  Description: ${desc}`);
    }
    lines.push('');
  }

  lines.push('## Work Item to Estimate');
  lines.push(`Title: ${workItem.title}`);
  lines.push(`Type: ${workItem.workItemType}`);
  lines.push(`State: ${workItem.state}`);
  lines.push(`Description: ${workItem.description ? stripHtml(workItem.description).slice(0, 800) : 'No description'}`);
  if (workItem.acceptanceCriteria) {
    lines.push(`Acceptance Criteria: ${stripHtml(workItem.acceptanceCriteria).slice(0, 800)}`);
  }
  lines.push('');
  const language = locale === 'tr' ? 'Turkish' : 'English';
  lines.push(
    'Based on the reference items and previous sprint context, estimate the story points for this work item.',
    `Write the "reason" field in ${language}.`,
    'Respond ONLY with a valid JSON object — no explanation text outside the JSON:',
    '{"story-point": <Fibonacci number>, "reason": "<brief explanation with similarities>", "similar-items": ["<url1>", "<url2>"]}',
  );

  return lines.join('\n');
}

// ─── CLI Providers ────────────────────────────────────────────────────────────

/**
 * Spawns a CLI command and returns its output.
 * - Captures both stdout and stderr; falls back to stderr when stdout is empty
 *   (some tools write to stderr when they detect no TTY).
 * - Optionally pipes `stdinData` into the process so tools that read from stdin
 *   work correctly in non-interactive mode.
 */
function callCLI(
  command: string,
  args: string[],
  options: { stdinData?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { stdinData, timeoutMs = 60000 } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    // Pipe prompt via stdin if provided, then close stdin to signal EOF
    if (stdinData !== undefined) {
      proc.stdin.write(stdinData, () => proc.stdin.end());
    }

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`CLI command timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      // Use stdout if available, fall back to stderr (tools often write to
      // stderr when not running in an interactive terminal)
      const output = (stdout.trim() || stderr.trim());
      if (code !== 0) {
        // Reject on any non-zero exit — output may contain the Windows/shell error text
        reject(new Error(output || `"${command}" exited with code ${code} and produced no output`));
      } else if (!output) {
        reject(new Error(`"${command}" produced no output (exit code 0)`));
      } else {
        resolve(output);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      const hint = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? ` — make sure "${command}" is installed and the backend was started from a terminal where it is on PATH`
        : '';
      reject(new Error(`Failed to start "${command}": ${err.message}${hint}`));
    });
  });
}

async function callClaudeCLI(prompt: string): Promise<string> {
  // Claude CLI non-interactive mode: pipe prompt via stdin to avoid multi-line arg issues
  return callCLI('claude', ['--print'], { stdinData: prompt });
}

async function callCopilotCLI(prompt: string): Promise<string> {
  // Pipe prompt via stdin to avoid Windows cmd.exe argument length limits
  return callCLI('copilot', [], { stdinData: prompt });
}

async function callCodexCLI(prompt: string): Promise<string> {
  // Codex CLI: pipe prompt via stdin for non-interactive mode
  return callCLI('codex', [], { stdinData: prompt });
}

// ─── API Providers ────────────────────────────────────────────────────────────

const estimateSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    'story-point': {
      type: SchemaType.NUMBER,
      description: 'Fibonacci story point estimate (1, 2, 3, 5, 8, 13, 21, 34, or 55)',
    },
    reason: {
      type: SchemaType.STRING,
      description: 'Brief explanation of the estimate with similarities to reference items',
    },
    'similar-items': {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'URLs of similar work items from the previous sprint context',
    },
  },
  required: ['story-point', 'reason', 'similar-items'],
};

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: estimateSchema,
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

async function callChatGPT(prompt: string, apiKey: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 1024,
  });
  const text = response.choices[0]?.message?.content ?? '';
  if (!text) throw new Error('ChatGPT returned empty response');
  return text;
}

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

export async function callAI(
  provider: string,
  apiKey: string | null,
  prompt: string,
): Promise<string> {
  switch (provider) {
    case 'claude':
      return callClaudeCLI(prompt);
    case 'copilot':
      return callCopilotCLI(prompt);
    case 'codex':
      return callCodexCLI(prompt);
    case 'gemini':
      if (!apiKey) throw new Error('Gemini requires an API key');
      return callGemini(prompt, apiKey);
    case 'chatgpt':
      if (!apiKey) throw new Error('ChatGPT requires an API key');
      return callChatGPT(prompt, apiKey);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/** Simple connectivity test — verify the AI provider responds with anything. */
export async function testAIConnection(
  provider: string,
  apiKey: string | null,
): Promise<void> {
  // CLI tools (copilot, claude, codex) have their own output style and won't
  // reliably return structured JSON for a test prompt, so we just verify that
  // we get a non-empty response back without an error.
  const testPrompt = 'Say hello in one sentence.';
  const raw = await callAI(provider, apiKey, testPrompt);
  if (!raw.trim()) {
    throw new Error('AI returned an empty response');
  }
}
