# UrbanEyes Chatbot: Role-Based Onboarding and Action Tools

This document defines the personas, onboarding flow, tool contracts, state machine, security model, analytics, and rollout phases for the in-app chatbot.

## Personas (finalized)

- Architectural Designer (tone: visual)
- Urban Strategist (tone: systems)
- City Official / Civic Authority (tone: formal)
- Project Developer (tone: commercial)
- Learner / Emerging Practitioner (tone: educational)
- Future: Investor / Capital Partner, Researcher / Academic Analyst, Community Advocate

See `services/chatbot/personas.ts` for attributes (priorities, default goals, preferred exports).

## Onboarding flow

Implemented as scripted steps in `services/chatbot/onboardingFlow.ts` and rendered in `components/Chatbot.tsx`:

1. Intro → role selection pills
2. Goal selection → persona-tailored buttons
3. Site Analysis checklist (when chosen)
4. Post-analysis actions: Export Excel, Download all cards, Export maps, Open concept planner

## State machine

Defined in `services/chatbot/state.ts` with phases:
`onboarding.init → onboarding.roleSelected → onboarding.goalSelected → analysis.pending → analysis.complete → concept.enabled → recommending.nextActions`

## Intents / NL commands

Simple regex detector in `services/chatbot/intents.ts` for:
- runSiteAnalysis, exportExcel, downloadAllCards, exportContextMaps, export3DModel
- openContextMaps, openQuantitative, openConceptPlanner

## Tool contracts

Placeholders in `services/chatbot/tools.ts` emit `CustomEvent('ue-tool', { detail: { name, args } })` for UI glue later:
- `runSiteAnalysis({ boundary?, projectType? })`
- `exportContextMaps({ layers?, formats?, framing? })`
- `exportQuantitativeExcel()`
- `bulkDownloadCards(format)`
- `export3DModel(includeContext)`

## Security & permissions

- Move model/API calls server-side; never expose private keys in client.
- Gate tool endpoints by auth; guests allowed with lower limits and watermarked exports.
- Rate limit per IP/user for expensive actions (analysis, cost estimation, PDF parsing).
- Validate payloads, enforce project ownership on server.

## Analytics

Event dispatcher in `services/chatbot/analytics.ts` (`CustomEvent('ue-analytics', ...)`).
Log: roleSelected, goalSelected, toolInvoked, toolCompleted, toolFailed, stepCompleted, chatAbandoned.

## Rollout phases

1. Phase 1 – Role & guided flow (this PR): scripted onboarding UI only.
2. Phase 2 – Wire two tools: `runSiteAnalysis`, `exportQuantitativeExcel` (server routes + UI events).
3. Phase 3 – Add map and 3D exports; proactive suggestions after analysis.
4. Phase 4 – Learning loop: analytics-driven prompt tuning and suggestions.
