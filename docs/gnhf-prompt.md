## Persistent project context

Before starting work, read `AGENTS.md`. It is the durable project context and
operating contract for this repository. Do not rely on hidden memory from
previous agents.

Then read `docs/INDEX.md`. Use its ownership table and reading order to identify
which authoritative document applies to the task. Read only the relevant
sections of that document unless the task genuinely spans multiple categories;
do not load the entire documentation corpus by default.

Treat `AGENTS.md` as project-level routing and guardrails. Treat the
authoritative documents identified by `docs/INDEX.md` as the source of truth for
product, architecture, brand, and technology decisions. If a prior context
checkpoint is available and the `/context-restore` skill exists, restore it for
session history, but verify its decisions against the current repository docs.

For additional context, consult only the authoritative document identified by
`docs/INDEX.md` as relevant to the task. Read multiple documents only when the
task crosses ownership boundaries.


Then, please see /Users/harry/Documents/git/pantry-iq/docs/testing-backlog.md and identify a test or feature that you would like to implement that hasn't been implemented yet.

For your test/feature, please: 

1. Create a plan to implement the test/feature in the spirit of what you understand the vision for the feature to be. If you can't create such a plan, or the feature you picked to work on is blocked by another test/feature that hasn't been built yet, find another feature to work on instead. 
2. Implement your plan and then validate that it works as you expected by running the app and logging in with the test account credentials you can find at .env.local 
3. Update AGENTS.md or other instructions files as needed if your changes warrant it. 
4. Run `npm run prettify` to format your changes
5. Confirm `npm run ci` passes
  - Fix any issues and repeat this steps 5 and 6 until you've fixed all issues introduced by your implementation in this session. The expectation is that `npm run ci` should pass without warnings or errors. 
8. Mark the feature that you created as implemented 
9. This session is complete! ^_^
