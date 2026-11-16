import type { Register } from 'claude-code'

// The PR owner this applies to, and the GitHub user whose approval ends the loop.
const OWNER = 'hoiekim'
const REVIEWER = 'reviewoie'
// After this many reviews without an approval, hand the PR back to the person.
const MAX_ROUNDS = 6

// "Auto-fix" in a Claude Code session is the PR-activity subscription tool,
// served by whichever MCP server the host names (claude-code-remote in cloud
// sessions), so match the tool by its suffix.
const SUBSCRIBE = /^mcp__.+__subscribe_pr_activity$/
const OWNER_ARG = new RegExp(`^${OWNER}$`, 'i')

// The tool's arguments are model-written; keep only what a repo or number can be.
const slug = (value: unknown) => String(value ?? '').replace(/[^\w.-]/g, '')

const instructions = (repo: string, pr: string) => {
  const ref = `${OWNER}/${repo}#${pr}`
  const request = `request a review from \`${REVIEWER}\`: the GitHub \`update_pull_request\` tool with \`reviewers: ["${REVIEWER}"]\`, or \`gh pr edit ${pr} --repo ${OWNER}/${repo} --add-reviewer ${REVIEWER}\` where you have \`gh\`. Requesting again after ${REVIEWER} has reviewed re-requests it`

  return `reviewoie-loop: auto-fix is on for ${ref}. On top of the auto-fix rules, drive this PR through review by GitHub user \`${REVIEWER}\` (an automated code reviewer) until it approves. If the result above says another Claude agent is already watching this PR, this session gets no events for it: do none of this.

1. Check where review stands first, since this note comes again whenever the PR is re-subscribed: read the PR's reviews and its requested reviewers.
   - ${REVIEWER}'s latest review is APPROVED and its commit is the PR's head: the loop is done; do nothing more.
   - ${REVIEWER} is already a requested reviewer: a review is on its way; go to step 2.
   - Otherwise ${request}.
2. Wait for the review. It usually arrives 10 to 60 minutes after the request, as a PR review event in this conversation, so end your turn rather than polling or sleeping. As a fallback against a missed event, if you can schedule a message back into this session (send_later), schedule one check-in about 90 minutes out and cancel it when the review arrives. When it fires, read the PR's reviews: if ${REVIEWER} still hasn't reviewed the head, request it again once, schedule another check-in, and wait.
3. When ${REVIEWER} posts a review:
   - APPROVED: the loop is done. Push nothing more and don't request again. Tell the user ${ref} is approved, and list any findings the approving review still carries without fixing them unless they ask.
   - Any other state (CHANGES_REQUESTED, COMMENTED): address every finding in the review body and its inline comments in one round of commits. Fix what is right. Where you decline a finding, say why on the PR (a reply on its inline comment, or one PR comment for findings in the review body) so the next round sees your reasoning; say nothing on the PR about findings you fixed. Push, wait for CI on the new head and fix what it breaks, then ${request}. Go back to step 2.
   - A review that says it was blocked or could not run: don't re-request; tell the user what it said.
4. Stop and tell the user instead of re-requesting when a finding comes back after you have addressed it twice, or after ${MAX_ROUNDS} reviews from ${REVIEWER} without an approval.

Reviews and comments from anyone else follow the auto-fix rules as usual; this loop doesn't wait on them. Where the auto-fix rules forbid something (pushing on a PR you did not open, approving, merging), they win.`
}

export const register: Register = on => {
  on('tool.call', { tool: SUBSCRIBE, owner: OWNER_ARG }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran

    // A regex on `tool` doesn't narrow `e` to the MCP branch, so read the arguments loosely.
    const args: Record<string, unknown> = e
    const repo = slug(args.repo)
    const pr = slug(args.pullNumber)
    if (!repo || !pr) return ran

    return { ...ran, context: [...(ran.context ?? []), instructions(repo, pr)] }
  }).catch(($, e, next) => next(e))
}
