# reviewoie-loop

Turns PR auto-fix on a `hoiekim/*` pull request into a review loop with
[`reviewoie`](https://github.com/reviewoie), the automated code reviewer.

## When it fires

Auto-fix turns on in several ways, and the plugin catches each for a PR whose
owner is `hoiekim` (any repository):

- **The auto-fix toggle in the Claude app** subscribes the PR on the server.
  The session learns of it from a `subscription.created` event, read through
  its notifications tool or delivered as a turn of its own; the plugin
  attaches the note there. Every other way below sends this event too.
- **Asking a cloud session to watch or auto-fix a PR** makes Claude call its
  `subscribe_pr_activity` tool; the plugin appends the note to that call's
  result.
- **`/autofix-pr` from a local session** starts a new cloud session whose first
  message begins "You're monitoring PR #N in hoiekim/<repo>."; the plugin
  attaches the note to that message.

A PR gets the note once per half hour however many of these arrive. The model
reads the note and the user doesn't see it. Nothing happens for other owners
or for a failed subscription, and the same text quoted by GitHub comments or
another session is ignored. The plugin has to be installed where the auto-fix
session runs, which is always a cloud session.

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
