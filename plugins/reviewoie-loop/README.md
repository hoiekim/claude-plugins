# reviewoie-loop

Turns PR auto-fix on a `hoiekim/*` pull request into a review loop with
[`reviewoie`](https://github.com/reviewoie), the automated code reviewer.

## When it fires

Auto-fix turns on in one of two ways, and the plugin catches both for a PR
whose owner is `hoiekim` (any repository):

- **In a cloud session**, Claude calls its `subscribe_pr_activity` tool (you
  asked it to watch or auto-fix the PR). When that call succeeds, the plugin
  appends a note to the tool's result.
- **From a local session**, `/autofix-pr` starts a new cloud session for the
  PR and subscribes it without a tool call. Its first message begins
  "You're monitoring PR #N in hoiekim/<repo>."; the plugin attaches the note
  to that message. (If you give `/autofix-pr` a prompt of your own, that
  sentence isn't there and the plugin stays out of it.)

The model reads the note and the user doesn't see it. Nothing happens for
other owners or for a failed subscription, and the same sentence relayed
from GitHub or another session is ignored. The plugin has to be installed
where the auto-fix session runs, which for both ways is a cloud session.

## What the note tells the session

1. Check the PR first: if `reviewoie`'s latest review approves the head,
   stop; if a review from `reviewoie` is already requested, wait; otherwise
   request one.
2. Wait for the review (usually 10 to 60 minutes) by ending the turn: it
   arrives as a PR event. As a fallback, schedule one check-in about 90
   minutes out, and re-request once if nothing came.
3. On `APPROVED`: stop, push nothing more, and report any findings the
   approving review still lists.
4. On any other review: fix the findings in one round, explain on the PR only
   the ones it declines, push, wait for CI, re-request `reviewoie`, and wait
   again.
5. Hand the PR back to the user when a finding returns after two fixes, or
   after 6 reviews without an approval.

The session's own auto-fix rules still win where they forbid something
(approving, merging, pushing to a PR it didn't open).

## Changing it

The owner, the reviewer and the round cap are constants at the top of
`hooks/register.ts`. Run the tests with `claude plugin test plugins/reviewoie-loop`.

`plugin.json` has no `version` on purpose: Claude Code then versions the
plugin by the commit that last changed its folder, so every push to `main`
is an update, with nothing to bump. Installs pick it up on their own where
the `hoiekim` marketplace has auto-update on; new cloud sessions install
whatever `main` holds when their container is built.
