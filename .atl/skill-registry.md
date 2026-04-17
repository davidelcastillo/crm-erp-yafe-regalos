# Skill Registry - Stark Commerce OS

## Project Skills (Project-level)

Located in: `./skills/` and `.agents/skills/`

| Skill Name | Location | Trigger |
|------------|----------|---------|
| mobile-android-design | skills/mobile-android-design | Mobile UI patterns |
| supabase-postgres-best-practices | skills/supabase-postgres-best-practices | Database optimization |
| webapp-testing | skills/webapp-testing | Testing strategy |

## Global Skills (User-level)

Located in: `~/.config/opencode/skills/`

| Skill Name | Location | Trigger |
|------------|----------|---------|
| sdd-init | sdd-init | Initialize SDD context |
| sdd-explore | sdd-explore | Explore codebase |
| sdd-propose | sdd-propose | Create proposals |
| sdd-spec | sdd-spec | Write specifications |
| sdd-design | sdd-design | Technical design |
| sdd-tasks | sdd-tasks | Task breakdown |
| sdd-apply | sdd-apply | Implementation |
| sdd-verify | sdd-verify | Verification |
| sdd-archive | sdd-archive | Archive completed |
| sdd-onboard | sdd-onboard | Onboarding |
| nextjs | nextjs | Next.js specific |
| next-best-practices | next-best-practices | Next.js patterns |
| supabase | supabase | Supabase integration |
| context7-mcp | context7-mcp | Documentation lookup |
| skill-registry | skill-registry | Registry management |

## Project Conventions

### Testing
- Framework: Jest
- Location: Co-located (*.test.ts, *.test.tsx)
- Command: `npm test`

### Linting
- Framework: ESLint + Next.js config
- Command: `npm run lint`

### Type Checking
- Framework: TypeScript
- Integrated in Next.js build

## Notes
- SDD initialized with engram persistence
- Strict TDD Mode: disabled
- All prompts follow AGENTS.md specification