import type { Register } from 'claude-code'

// The PR owner this applies to, and the GitHub user whose approval ends the loop.
const OWNER = 'hoiekim'
const REVIEWER = 'reviewoie'
// After this many reviews without an approval, hand the PR back to the person.
const MAX_ROUNDS = 6

// Auto-fix turns on several ways, and each is matched:
// - In a cloud session the model calls the PR-activity subscription tool,
//   served by whichever MCP server the host names (claude-code-remote in
//   cloud sessions), so the tool is matched by its suffix.
// - `/autofix-pr` in a local session starts a new cloud session with this
//   first message (unless given a prompt of its own) and subscribes it
//   server-side, so that session never calls the tool.
// - The app's auto-fix toggle subscribes server-side too. Every way ends with
//   the server's `subscription.created` event reaching the session, as a
//   notification its ReadNotifications tool reads or as a turn of its own.
const SUBSCRIBE = /^mcp__.+__subscribe_pr_activity$/
const OWNER_ARG = new RegExp(`^${OWNER}$`, 'i')
const AUTOFIX_PROMPT = new RegExp(`You're monitoring PR #(\\d+) in ${OWNER}/([\\w.-]+)\\.`, 'i')
// Text relayed from GitHub or written by another session can quote that sentence.
const RELAYED = ['peer', 'peer-send-message', 'task-notification']
// The server writes the envelope's attributes with bare quotes; text a third
// party wrote sits JSON-escaped in an event's data line, so it can't match.
const SUBSCRIBED_EVENT = /<event source="github" kind="subscription\.created" from="system"[^>]*>[\s\S]*?\n\s*(\{[^\n]*\})\s*<\/event>/g
const MENTIONS_SUBSCRIBED = /kind="subscription\.created" from="system"/
const PR_REF = new RegExp(`^${OWNER}/([\\w.-]+)#(\\d+)$`, 'i')

// The tool's arguments are model-written; keep only what a repo or number can be.
const slug = (value: unknown) => String(value ?? '').replace(/[^\w.-]/g, '')

// One turn-on can raise two of the signals above (a subscribe call, then the
// event it causes), so a PR gets the note once per half hour.
const REPEAT_AFTER_MS = 30 * 60 * 1000
const notedAt = new Map<string, number>()
const isFresh = (repo: string, pr: string) => {
  const key = `${repo}#${pr}`.toLowerCase()
  const last = notedAt.get(key)
  const now = Date.now()
  notedAt.set(key, now)
  return last === undefined || now - last > REPEAT_AFTER_MS
}

// The PRs of OWNER that `subscription.created` events in a delivery name.
const subscribedPRs = (text: string) => {
  const found: { repo: string; pr: string }[] = []
  for (const [, data] of text.matchAll(SUBSCRIBED_EVENT)) {
    let ref: unknown
    try {
      ref = (JSON.parse(data ?? '') as { pr?: unknown }).pr
    } catch {
      continue
    }
    const [, repo, pr] = PR_REF.exec(String(ref)) ?? []
    if (repo && pr) found.push({ repo, pr })
  }
  return found
}

const instructions = (repo: string, pr: string, caveat = '') => {
  const ref = `${OWNER}/${repo}#${pr}`
  const request = `request a review from \`${REVIEWER}\`: the GitHub \`update_pull_request\` tool with \`reviewers: ["${REVIEWER}"]\`, or \`gh pr edit ${pr} --repo ${OWNER}/${repo} --add-reviewer ${REVIEWER}\` where you have \`gh\`. Requesting again after ${REVIEWER} has reviewed re-requests it`

  return `reviewoie-loop: auto-fix is on for ${ref}. On top of the auto-fix rules, drive this PR through review by GitHub user \`${REVIEWER}\` (an automated code reviewer) until it approves.${caveat}

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
    if (!repo || !pr || !isFresh(repo, pr)) return ran

    const caveat = ' If the result above says another Claude agent is already watching this PR, this session gets no events for it: do none of this.'
    return { ...ran, context: [...(ran.context ?? []), instructions(repo, pr, caveat)] }
  }).catch(($, e, next) => next(e))

  on('prompt.submit', { text: AUTOFIX_PROMPT }, ($, e, next) => {
    const [, pr, repo] = AUTOFIX_PROMPT.exec(e.text) ?? []
    if (!pr || !repo || e.command || RELAYED.includes(e.origin?.kind)) return next(e)
    if (!isFresh(slug(repo), pr)) return next(e)

    const note = instructions(slug(repo), pr)
    return next({ ...e, context: [...(e.context ?? []), note] })
  }).catch(($, e, next) => next(e))

  // The event read as a queued notification.
  on('tool.call', { tool: 'ReadNotifications' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError || !ran.text) return ran

    const notes = subscribedPRs(ran.text)
      .filter(({ repo, pr }) => isFresh(repo, pr))
      .map(({ repo, pr }) => instructions(repo, pr))
    return notes.length ? { ...ran, context: [...(ran.context ?? []), ...notes] } : ran
  }).catch(($, e, next) => next(e))

  // The event delivered as a turn of its own (the session was idle).
  on('prompt.submit', { text: MENTIONS_SUBSCRIBED }, ($, e, next) => {
    const notes = subscribedPRs(e.text)
      .filter(({ repo, pr }) => isFresh(repo, pr))
      .map(({ repo, pr }) => instructions(repo, pr))
    return next(notes.length ? { ...e, context: [...(e.context ?? []), ...notes] } : e)
  }).catch(($, e, next) => next(e))
}
