# Scrum Poker – Requirements

> **Platform**: Next.js 14 App Router (built on top of the existing project)
> **Real-time communication**: WebSocket
> **AI Agent**: GitHub Copilot SDK (abstracted via interface)
> **Data source**: Azure DevOps REST API

This file is an index. Each requirement area is documented separately in the `requirements/` folder so that they can be implemented independently.

---

## Requirements Index

| # | Document | Description |
|---|----------|-------------|
| 1 | [Onboarding](./requirements/01-onboarding.md) | Initial setup: ADO URL parsing and reference scoring calibration |
| 2 | [Authentication](./requirements/02-authentication.md) | OAuth 2.0 flow, token management, session handling, PAT support |
| 3 | [AI Agent Architecture](./requirements/03-ai-agent-architecture.md) | Provider interface abstraction and GitHub Copilot SDK integration |
| 4 | [Project & Sprint Management](./requirements/04-project-sprint-management.md) | Home page project list and sprint selection screen |
| 5 | [Room Management](./requirements/05-room-management.md) | Room creation, participant joining, background AI job, WebSocket events |
| 6 | [Work Item Listing](./requirements/06-work-item-listing.md) | Sprint work item table and bulk AI estimation |
| 7 | [Work Item Detail](./requirements/07-work-item-detail.md) | Detail page, AI estimation panel, voting cards, reveal results |
| 8 | [AI Estimation Engine](./requirements/08-ai-estimation-engine.md) | Inputs, similarity analysis, output format and estimation rules |
| 9 | [Voting Flow](./requirements/09-voting-flow.md) | End-to-end voting sequence diagram |
| 10 | [Data Model](./requirements/10-data-model.md) | TypeScript interfaces for all domain objects |
| 11 | [Technical Constraints](./requirements/11-technical-constraints.md) | Open items, technology stack, and security requirements |

---

*Last updated: February 2026*
