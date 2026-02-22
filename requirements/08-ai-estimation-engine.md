# 8. AI Estimation Engine

## 8.1 Estimation Inputs

When making an estimate, the AI takes the following into account:

- [ ] **Onboarding reference points** (calibration scores manually assigned by the user)
- [ ] **Work items from the previous 3 sprints**, their assigned scores, and descriptions
- [ ] For the target work item: title, description, acceptance criteria, closure notes, comments
- [ ] Similarity analysis: comparison against content, comments, and descriptions of prior items

---

## 8.2 Similarity Analysis

- [ ] The following fields are analyzed to find similar items:
  - Title similarity (keyword matching + semantic similarity)
  - Description / acceptance criteria content
  - **Comments and closure notes** (critical for technical detail)
  - Affected layers (NDAL, VCBL, UI, etc. — extracted from description and tags)
  - Work type (new feature, bug fix, refactoring, etc.)

---

## 8.3 Output Format

The AI estimation output **must** adhere to the following JSON format:

```json
{
  "ai_prediction": {
    "story_points": 21,
    "confidence_level": "Low | Medium | High",
    "analysis": "Brief explanation of why this score was given.",
    "similar_items": [
      {
        "work_item_id": "#250987",
        "story_points": 21,
        "similarity_percentage": 92
      }
    ]
  }
}
```

---

## 8.4 Estimation Rules

- [ ] Points are given **only** from the Fibonacci series: `1, 2, 3, 5, 8, 13, 21, 34, 55`
- [ ] A value outside the Fibonacci series is never returned.
- [ ] `confidence_level` values: `"Low"`, `"Medium"`, `"High"`
- [ ] `analysis` is at most 3–4 sentences.
- [ ] `similar_items` contains at least 1 and at most 5 items.
- [ ] If the estimated `story_points` > 13, the analysis field also includes a story splitting suggestion.
