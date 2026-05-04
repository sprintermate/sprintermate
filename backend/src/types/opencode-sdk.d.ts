// Minimal type stub for @opencode-ai/sdk (ESM-only package used via dynamic import())
// Full types available at dist/index.d.ts when moduleResolution is node16/bundler.
declare module '@opencode-ai/sdk' {
  export interface OpencodeServer {
    url: string;
    close(): void;
  }

  export interface MessagePart {
    type: string;
    text?: string;
  }

  export interface PromptResult {
    data?: {
      parts?: MessagePart[];
      info?: {
        error?: { name: string; message: string; retries?: number };
        structured_output?: unknown;
      };
    };
  }

  export interface EventStream {
    stream: AsyncIterable<{
      type: string;
      properties?: Record<string, unknown>;
    }>;
  }

  export interface OpencodeClient {
    session: {
      create(opts?: { body?: { title?: string } }): Promise<{ id: string }>;
      prompt(opts: {
        path: { id: string };
        body: {
          noReply?: boolean;
          parts: Array<{ type: 'text'; text: string }>;
          model?: { providerID: string; modelID: string };
          format?: unknown;
        };
      }): Promise<PromptResult>;
    };
    event: {
      subscribe(): Promise<EventStream>;
    };
    auth: {
      set(opts: { path: { id: string }; body: { type: 'api'; key: string } }): Promise<boolean>;
    };
  }

  export interface OpencodeInstance {
    client: OpencodeClient;
    server: OpencodeServer;
  }

  export function createOpencode(opts?: {
    hostname?: string;
    port?: number;
    signal?: AbortSignal;
    timeout?: number;
    config?: Record<string, unknown>;
  }): Promise<OpencodeInstance>;

  export function createOpencodeClient(opts?: { baseUrl?: string }): OpencodeClient;
}
