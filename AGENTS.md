# DISTYNC agent instructions

## Project
DISTYNC is a web-based disaster relief management system for selected LGU offices in Malvar, Batangas.

## Stack
- client: React
- server: Node.js + Express
- analytics: Python
- database: PostgreSQL
- cloud/auth: Supabase + Google Auth
- offline browser storage: IndexedDB

## Folder structure
- client/
- server/
- analytics/
- database/
- docs/
- .github/

## Architecture rules
- Follow repository/service/route separation in the backend.
- Do not invent new folders outside the approved structure.
- Do not introduce an ORM unless explicitly requested.
- Use PostgreSQL with existing schema and seed structure.
- Use async/await.
- Keep business rules in services, SQL in repositories, route handlers thin.
- Do not change database schema unless explicitly asked.
- Do not invent columns or tables not present in the schema.
- Prefer minimal, incremental changes.

## Coding rules
- Reuse existing naming conventions.
- Add error handling.
- Do not break existing routes.
- Keep code beginner-friendly and readable.
- Comment only when needed for clarity.

## Testing rules
- For backend changes, say how to test with sample endpoint calls.
- For frontend changes, say what route/page to open and expected behavior.
- For DB changes, provide SQL verification steps.

## Done means
A task is done only when:
1. files are created/updated in the correct folders
2. imports are correct
3. no invented schema fields are used
4. the feature has clear manual test steps