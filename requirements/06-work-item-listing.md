# 6. Sprint & Work Item Listing

## 6.1 Work Item Table (Within a Sprint)

- [ ] Work items are listed in **table format**:

| Column | Description |
|--------|-------------|
| **#** | Order number |
| **ID** | Work item ID (clickable link) |
| **Title** | Work item title |
| **Status** | State (Active, Resolved, Closed, etc.) |

- [ ] The table is sortable by ID, Title, and Status columns.
- [ ] A search/filter bar is displayed above the table.

---

## 6.2 AI Bulk Estimate Button

- [ ] A "🤖 Estimate with AI" button is located in the **top-right corner** of the table header.
- [ ] When clicked:
  - [ ] All items in the table are sent to the AI **three at a time** (for rate limiting / context management).
  - [ ] The table updates in real time as each batch completes.
  - [ ] A progress bar is shown during the process: "12/36 items estimated..."
  - [ ] Rows with completed estimates display the AI score as a badge.
