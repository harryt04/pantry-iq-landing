Go ahead and take in this context as needed (cache this understanding if possible for the next agent): 

/Users/harry/Documents/git/pantry-iq/AGENTS.md
/Users/harry/Documents/git/pantry-iq/docs/vision.md
/Users/harry/Documents/git/pantry-iq/docs/tech-stack.md
/Users/harry/Documents/git/pantry-iq/docs/architecture-and-data-model.md
/Users/harry/Documents/git/pantry-iq/docs/INDEX.md


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