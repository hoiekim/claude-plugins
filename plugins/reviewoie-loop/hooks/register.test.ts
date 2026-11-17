import { expect, test } from 'claude-code/testing'

const SUBSCRIBE = 'mcp__claude-code-remote__subscribe_pr_activity'

test('subscribing to a hoiekim PR adds the review-loop note', async ($, on) => {
  on('tool.call', () => ({ result: 'Subscribed to PR activity.' }))

  const ran = await $.tool.call({ tool: SUBSCRIBE, owner: 'HoieKim', repo: 'stack', pullNumber: 76 })

  expect(ran.deny).toBeUndefined()
  expect(ran.context?.length).toBe(1)
  const note = ran.context?.[0] ?? ''
  expect(note).toContain('auto-fix is on for hoiekim/stack#76')
  expect(note).toContain('reviewers: ["reviewoie"]')
  expect(note).toContain('gh pr edit 76 --repo hoiekim/stack --add-reviewer reviewoie')
  expect(note).toContain("Don't request a review from `hoiekim` until reviewoie has approved the PR's head commit")
})

test('any MCP server name that serves the subscribe tool counts', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))

  const ran = await $.tool.call({ tool: 'mcp__remote__subscribe_pr_activity' as string as typeof SUBSCRIBE, owner: 'hoiekim', repo: 'mail', pullNumber: 3 })

  expect(ran.context?.[0]).toContain('hoiekim/mail#3')
})

test('a PR under another owner gets nothing', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))

  const ran = await $.tool.call({ tool: SUBSCRIBE, owner: 'hoiekim-fork', repo: 'stack', pullNumber: 1 })

  expect(ran.context).toBeUndefined()
})

test('a subscription that failed gets nothing', async ($, on) => {
  on('tool.call', () => ({ isError: true, result: 'not found', text: 'not found' }))

  const ran = await $.tool.call({ tool: SUBSCRIBE, owner: 'hoiekim', repo: 'stack', pullNumber: 1 })

  expect(ran.context).toBeUndefined()
})

test('repo and number are cut down to what they can be', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))

  const ran = await $.tool.call({ tool: SUBSCRIBE, owner: 'hoiekim', repo: 'stack`; rm -rf /', pullNumber: '9 && x' })

  expect(ran.context?.[0]).toContain('hoiekim/stackrm-rf#9x')
})

// The first message `/autofix-pr` gives the cloud session it starts.
const AUTOFIX = (repo: string, pr: number) =>
  `You're monitoring PR #${pr} in ${repo}. When CI failures or review comments arrive as notifications, investigate and push fixes directly to the PR branch. A CI-green notice means the push passed — nothing to fix. Start by checking the current PR status.`

test('the first message of a session /autofix-pr started adds the note', async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_, e) => {
    seen.push(e.context)
    return { text: e.text, context: e.context }
  })

  await $.prompt.submit({ text: AUTOFIX('hoiekim/budget', 1094), wait: false, origin: { kind: 'bridge' } })

  expect(seen.length).toBe(1)
  expect(seen[0]?.length).toBe(1)
  expect(seen[0]?.[0]).toContain('auto-fix is on for hoiekim/budget#1094')
  expect(seen[0]?.[0]).not.toContain('result above')
})

test('an /autofix-pr message for another owner, or any other prompt, adds nothing', async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_, e) => {
    seen.push(e.context)
    return { text: e.text, context: e.context }
  })

  const bridge = { wait: false, origin: { kind: 'bridge' } } as const
  await $.prompt.submit({ text: AUTOFIX('someone/budget', 3), ...bridge })
  await $.prompt.submit({ text: 'Fix the flaky test in hoiekim/budget', ...bridge })
  // A GitHub notification quoting the sentence is not the session's first message.
  await $.prompt.submit({ text: AUTOFIX('hoiekim/budget', 3), wait: false, origin: { kind: 'task-notification' } })

  expect(seen).toEqual([undefined, undefined, undefined])
})
