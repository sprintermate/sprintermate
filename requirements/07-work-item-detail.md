# 7. Work Item Detail Page

## 7.1 Content Sections

- [ ] **Title and metadata**: ID, type, status, assignee, sprint.
- [ ] **Description**: Full item description (rendered as HTML/Markdown).
- [ ] **Acceptance Criteria**: Displayed in a separate section.
- [ ] **Closure Notes**: Closing notes for the item.
- [ ] **Comments**: All comments listed in chronological order.
  - Comment content is used in AI similarity analysis.

---

## 7.2 AI Estimation Panel

- [ ] If an AI estimate exists for the item, it is shown in a **dedicated panel**.
- [ ] Panel contents (parsed from JSON):
  - Estimated story points (large, prominent display)
  - Confidence level badge (Low / Medium / High)
  - Short analysis description
  - Similar items list (ID, SP, similarity percentage, clickable link)

---

## 7.3 Voting Cards

- [ ] Fibonacci series cards: **1, 2, 3, 5, 8, 13, 21, 34, 55**
- [ ] The user selects a card; the selection is broadcast via WebSocket to everyone in the room (value is hidden).
- [ ] Users who have voted are shown in a name list (score hidden, only "voted" status visible).

---

## 7.4 Reveal Votes

- [ ] The **"Reveal Votes"** button is visible and usable only by the moderator.
- [ ] When clicked, all scores are revealed simultaneously via WebSocket.
- [ ] Results screen shows:
  1. **AI estimate** (first, with an AI badge)
  2. All participant votes (name + score)
  3. Average, median, highest, and lowest values
  4. Vote distribution bar chart
- [ ] The moderator selects / confirms the final score.
