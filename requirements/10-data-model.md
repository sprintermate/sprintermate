# 10. Data Model

TypeScript interfaces for all core domain objects.

---

### ADOUser (Session)

```typescript
interface ADOUser {
  id: string                // Azure DevOps user ID
  displayName: string
  emailAddress: string
  sessionId: string         // Stored server-side in Redis
  organizations: string[]   // List of accessible organizations
}
```

---

### ADOSession (Redis)

```typescript
interface ADOSession {
  sessionId: string
  userId: string
  encryptedAccessToken: string   // AES-256-GCM encrypted
  encryptedRefreshToken: string  // AES-256-GCM encrypted
  expiresAt: Date
  authMethod: 'oauth' | 'pat'
}
```

---

### Project

```typescript
interface Project {
  id: string
  name: string              // e.g. "VDF-FinanceWare"
  organization: string      // e.g. "dtalm"
  team: string              // e.g. "Ninja Turtles Team"
  adoUrl: string            // Original URL entered by the user
  authMethod: 'oauth' | 'pat'
  encryptedPat?: string     // Only present when authMethod === 'pat'
  referencePoints: ReferencePoint[]
  createdAt: Date
}
```

---

### ReferencePoint (Calibration)

```typescript
interface ReferencePoint {
  title: string
  storyPoints: number       // Fibonacci series value
}
```

---

### Room

```typescript
interface Room {
  id: string
  code: string              // 6 characters
  projectId: string
  sprintId: string
  moderatorId: string
  participants: Participant[]
  historicalAnalysis?: SprintAnalysis
  currentWorkItemId?: string
  votes: Vote[]
  status: 'waiting' | 'voting' | 'revealed'
  createdAt: Date
}
```

---

### AIPrediction

```typescript
interface AIPrediction {
  workItemId: string
  storyPoints: number
  confidenceLevel: 'Low' | 'Medium' | 'High'
  analysis: string
  similarItems: SimilarItem[]
  generatedAt: Date
}
```
