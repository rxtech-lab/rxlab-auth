# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
bun dev      # Start development server (http://localhost:3000)
bun build    # Production build
bun lint     # Run ESLint
```

## Testing

### Unit Tests
```bash
bun test     # Run unit tests
```

### E2E Tests
```bash
bunx playwright test              # Run all E2E tests
bunx playwright test --ui         # Interactive UI mode
bunx playwright test e2e/admin    # Run admin tests only
bunx playwright test --debug      # Debug mode
```

### Testing Patterns
- E2E tests are in `e2e/` directory using Playwright
- Use `data-testid` attributes for reliable element selection
- Test helpers are in `e2e/fixtures/test-helpers.ts`
- Tests verify DB state by navigating to edit pages after creation

## Architecture

This is a Next.js 16 authentication app using the App Router with React 19.

### Tech Stack

- **Database**: Drizzle ORM with libsql (SQLite)
- **UI Components**: shadcn/ui with base-vega style, built on @base-ui/react primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming

### Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/ui/` - shadcn/ui components (use `bunx shadcn add <component>` to add new ones)
- `lib/` - Utility functions including `cn()` for class merging

### Patterns

- Prefer server actions over REST API for CRUD operations
- UI components use class-variance-authority (cva) for variant styling
- Import paths use `@/` alias (e.g., `@/components`, `@/lib/utils`)
- Prefer server component, and server actions other than client side components
- Split large component into smaller one
- Write unit tests for logic and functions always!

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
