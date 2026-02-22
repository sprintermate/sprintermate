# 5. Room Management & Real-Time Voting

## 5.1 Room Creation

- [ ] After selecting a sprint, the user clicks the **"Create Room"** button.
- [ ] A unique **room code** (6 characters) is generated for the room.
- [ ] The room code is displayed as a QR code; a copy button is provided for easy sharing.
- [ ] The room creator is automatically assigned the **moderator** role.

---

## 5.2 Inviting Participants

- [ ] Other participants can join using the room code or QR code.
- [ ] A participant enters their name to join the room.
- [ ] Users joining or leaving are broadcast in real time to all participants via **WebSocket**.

---

## 5.3 Background Agent Job (Triggered on Room Creation)

- [ ] When the room is created, an **asynchronous agent job** is started server-side.
- [ ] The job performs the following:
  - [ ] Fetches the **3 sprints preceding** the selected sprint from Azure DevOps.
  - [ ] Retrieves all work items from those sprints (title, description, acceptance criteria, closure notes, comments, assigned points).
  - [ ] Runs pattern analysis to answer **"why was this score given?"** for each item.
  - [ ] The analysis result is saved to the room state (`room.historicalAnalysis`).
- [ ] While the job is running, an "AI analysis in progress..." spinner is shown in the UI.
- [ ] When the job completes, a WebSocket notification is sent to all participants.

---

## 5.4 WebSocket Requirements

- [ ] Technology: `Socket.io` or Next.js native WebSocket support.
- [ ] Events:
  - `user:join` / `user:leave`
  - `vote:cast` / `vote:reveal`
  - `session:reset`
  - `agent:analysis_ready`
  - `ai:estimation_progress` (for batch-of-three estimation streaming)
