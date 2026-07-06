# Repository Guidelines

## Project Structure & Module Organization
The frontend is located in the `frontend/` folder. This is a Vite, React, and TypeScript front-end. `frontend/src/main.tsx` bootstraps React, `frontend/src/App.tsx` wires Ant Design theming and providers, and `frontend/src/app/routes.tsx` owns route definitions. Route views live in `frontend/src/pages`, shell layouts in `frontend/src/layouts`, reusable UI in `frontend/src/components/common`, mock data in `frontend/src/data`, shared domain types in `frontend/src/types`, and helpers in `frontend/src/utils`. Static browser assets belong in `frontend/public`; imported React assets belong in `frontend/src/assets`. Treat `frontend/dist` and `frontend/node_modules` as generated output.

## Build, Test, and Development Commands
All commands should be executed from within the `frontend/` directory:
- `npm install`: install dependencies from `frontend/package-lock.json`.
- `npm run dev`: start the Vite dev server with hot reload.
- `npm run build`: run TypeScript project checks, then create the production bundle in `frontend/dist`.
- `npm run lint`: run Oxlint using `frontend/.oxlintrc.json`.
- `npm run preview`: serve the built app locally after `npm run build`.

## Coding Style & Naming Conventions
Use TypeScript ES modules and React function components. Follow the existing two-space indentation style in JSX and keep imports grouped by external libraries, then local modules. Name components and pages in PascalCase, such as `LoanDetailPage.tsx` and `StatisticCard.tsx`; use camelCase for utility functions and variables. Keep route paths kebab-case, for example `/app/create-loan`. Prefer shared interfaces in `frontend/src/types/index.ts`, reusable visual pieces in `frontend/src/components/common`, and Ant Design components plus existing CSS variables/theme tokens for UI consistency.

## Testing Guidelines
There is no test runner configured yet. Until one is added, validate changes with `npm run lint` and `npm run build` inside the `frontend/` directory. When introducing tests, add the test script to `frontend/package.json`, co-locate tests as `*.test.ts` or `*.test.tsx` beside the implementation, and focus on route behavior, data formatting, state transitions, and critical UI interactions.

## Commit & Pull Request Guidelines
This checkout does not include Git history, so no project-specific commit convention can be inferred. Use concise imperative subjects such as `Add liquidation detail view` or `Fix loan health formatting`. Pull requests should include a short purpose statement, linked issue or task when available, screenshots for UI changes, and the exact validation commands run. Note any intentional mock-data changes or untested paths.

## Security & Configuration Tips
Do not commit secrets, wallet keys, or environment-specific credentials. Keep mock financial and oracle data in `frontend/src/data` clearly separated from production integrations. Review build artifacts before release, but do not hand-edit generated files in `frontend/dist`.
