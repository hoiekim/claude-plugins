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
})

test('any MCP server name that serves the subscribe tool counts', async ($, on) => {
  on('tool.call', () => ({ result: 'ok' }))

  const ran = await $.tool.call({ tool: 'mcp__remote__subscribe_pr_activity', owner: 'hoiekim', repo: 'mail', pullNumber: 3 })

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
