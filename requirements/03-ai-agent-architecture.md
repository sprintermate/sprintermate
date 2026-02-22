# 3. AI Agent Architecture

## 3.1 Abstraction Layer (Interface)

- [ ] All AI estimation operations are performed through the **`AIAgentProvider` interface**.
- [ ] The interface exposes the following methods:

```typescript
interface AIAgentProvider {
  estimateWorkItem(item: WorkItemContext, history: HistoricalData): Promise<AIPrediction>
  analyzeSprintHistory(sprints: Sprint[]): Promise<SprintAnalysis>
  findSimilarItems(item: WorkItemContext, pool: WorkItem[]): Promise<SimilarItem[]>
}
```

- [ ] **First implementation**: GitHub Copilot SDK (`CopilotAgentProvider`)
- [ ] Future implementations that can be added: OpenAI, Azure OpenAI, Anthropic, etc.
- [ ] The active provider is selectable via an environment variable or the settings screen.

---

## 3.2 GitHub Copilot SDK Integration

- [ ] The `@github/copilot-sdk` package is installed.
- [ ] Reference: [https://github.com/github/copilot-sdk](https://github.com/github/copilot-sdk)
- [ ] Authentication is configured using a GitHub token.
- [ ] Estimation prompts are managed in a dedicated `prompts/` directory.
