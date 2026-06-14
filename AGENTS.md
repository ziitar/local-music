# AGENTS.md - Agentic Coding Guidelines

This file provides guidelines for AI agents operating in this repository.

## Project Overview

- **Type**: PostgreSQL + Deno + React + TypeScript + Vite web application
- **Tech Stack**: PostgreSQL, Deno, React 19, TypeScript 5.9, Vite 7.2
  (rolldown-vite), ESLint 9

---

## Commands

### Development

```bash
npm run dev          # Start dev server with HMR
npm run preview      # Preview production build
```

### Building

```bash
npm run build        # Type-check with tsc, then build with Vite
```

### Linting

```bash
npm run lint         # Run ESLint on all files
```

### Type Checking

```bash
npx tsc -b           # Build project references (type-check)
```

### Testing

**No tests currently configured.** To add tests, consider Vitest:

```bash
npm install -D vitest @vitejs/plugin-react
npx vitest run src/components/MyComponent.test.tsx
```

---

## Code Style Guidelines

### General Principles

- Write clean, readable code; keep functions small and focused
- Use meaningful variable and function names

### TypeScript

#### Types

- Explicit types for function params/returns when not obvious
- Prefer interfaces for objects, types for unions/intersections
- Avoid `any` or `unknown` without justification

```typescript
interface User { id: string; name: string; email: string; }
function getUser(id: string): Promise<User> { ... }
```

#### Generics

- Use for reusable utilities; name params: `T`, `K`, `V` or `TUser`

### React

#### Components

- Functional components with hooks only
- `.tsx` for components with JSX, `.ts` for pure TypeScript
- Place in `src/components/`, use PascalCase

```typescript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}
export function Button({ onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

#### Hooks

- Follow React 19 rules (not in loops/conditions/nested functions)
- Use `useCallback`/`useMemo` only when needed
- Custom hooks: prefix with `use`

#### State

- Use `useState` for local state
- Consider Context for shared state

### Imports

Order: 1) External libs, 2) Internal modules, 3) CSS/assets

```typescript
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { UserCard } from "./UserCard";
import "./Button.css";
```

No path aliases - use relative imports.

### Naming

| Type       | Convention        | Example       |
| ---------- | ----------------- | ------------- |
| Components | PascalCase        | `UserProfile` |
| Hooks      | camelCase + `use` | `useAuth`     |
| Functions  | camelCase         | `getUserData` |
| Variables  | camelCase         | `userList`    |
| Interfaces | PascalCase        | `UserProps`   |
| Constants  | UPPER_SNAKE       | `MAX_RETRY`   |

### Formatting

- 2 spaces indentation, single quotes, trailing commas, semicolons

### Error Handling

```typescript
try {
  const data = await fetchUser(id);
} catch (error) {
  if (error instanceof ApiError) {
    setError(error.message);
  } else {
    console.error("Unexpected error:", error);
    setError("Failed to load user");
  }
}
```

### File Organization

```
api/  # backend API client
├── app.ts        # deno app entry file with @oak/oak
├── routes.ts     # API routes
config/  # config files
├── config.json    # database config and other config
dbs/  # database files
src/
├── components/    # Reusable UI components
├── hooks/        # Custom React hooks
├── services/     # API clients
├── utils/        # Utility functions
├── types/        # Shared TypeScript types
├── App.tsx       # Root component
├── main.tsx      # Entry point
└── index.css    # Global styles
```

### ESLint

Uses ESLint 9 with `@eslint/js`, `typescript-eslint`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Run `npm run lint`
before committing.

---

## Common Tasks

### Adding a Component

1. Create file in `src/components/`
2. Use functional component with TypeScript props
3. Add CSS file if needed
4. Import in parent

### Running the App

```bash
npm install && npm run dev  # http://localhost:5173
```

---

## Notes

- Vite + React 19 using rolldown-vite
- No test framework set up
- Database uses `postgres` (in `api/`)
