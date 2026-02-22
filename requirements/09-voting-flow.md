# 9. Voting Flow

End-to-end sequence for a single work item estimation session:

```
Moderator creates a room
        │
        ▼
Participants join the room (WebSocket)
        │
        ▼
Moderator selects / opens a work item from the list
        │
        ▼
[Optional] Moderator triggers "Estimate with AI"
        │
        ▼
Participants cast their votes using Fibonacci cards
        │
        ▼
Moderator clicks "Reveal Votes"
        │
        ▼
Results are revealed (AI estimate shown first)
        │
        ▼
Moderator confirms the final score
        │
        ▼
"Reset" starts a new round for the next work item
```
