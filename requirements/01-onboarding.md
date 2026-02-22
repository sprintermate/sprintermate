# 1. Onboarding – Initial Setup

## 1.1 Azure DevOps URL Entry

- [ ] When the application is **launched for the first time** (or when no project has been configured), an onboarding screen is displayed.
- [ ] The user is prompted to enter an Azure DevOps sprint board URL.
  **Example format:**
  ```
  https://dev.azure.com/dtalm/VDF-FinanceWare/_sprints/backlog/Ninja%20Turtles%20Team/VDF-FinanceWare/Ninja%20Turtles%20Iteration/2026%20Ninja%20Turtles%20Sprints/Sprint_109
  ```
- [ ] The following values are automatically parsed from the URL:
  - `organization`: `dtalm`
  - `project`: `VDF-FinanceWare`
  - `team`: `Ninja Turtles Team`
  - `sprint`: `Sprint_109`
- [ ] The parsed values are shown to the user as a preview; the project is created only after the user confirms.

---

## 1.2 Reference Scoring (Calibration)

- [ ] After the URL is confirmed, a list of **sample work item titles** (pre-loaded or manually entered by the user) is displayed.
- [ ] The user assigns manual scores to these items using the **Fibonacci series** (1, 2, 3, 5, 8, 13, 21, 34, 55).
- [ ] These scores are saved as **reference points** and serve as the baseline for all subsequent AI estimations.
- [ ] Reference points can be updated later via the settings screen.
