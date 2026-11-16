# reviewoie-loop

Turns PR auto-fix on a `hoiekim/*` pull request into a review loop with
[`reviewoie`](https://github.com/reviewoie), the automated code reviewer.

## When it fires

A Claude Code session turns on auto-fix for a PR by calling its
`subscribe_pr_activity` tool. When that call succeeds for a PR whose owner is
`hoiekim` (any repository), this plugin appends a note to the tool's result
that the model reads and the user doesn't see. Nothing happens for other
owners, for a failed subscription, or in a session without that tool.

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
