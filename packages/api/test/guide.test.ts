import { describe, expect, test } from 'bun:test'
import { apiHelp } from '../src/guide'

const origin = 'https://artifacts.amar.sh'

describe('apiHelp', () => {
  test('shows the upload curl first and asks for a token when none is sent', () => {
    const body = apiHelp(origin, 'missing')
    expect(body).toContain('No token sent.')
    expect(body).toContain(`"${origin}/api/upload?project=<project>&name=report.zip"`)
    expect(body.indexOf('## Upload with an API token')).toBeLessThan(body.indexOf('## Upload URLs'))
  })

  test('says a bad token is not valid', () => {
    expect(apiHelp(origin, 'invalid')).toContain('The token is not valid.')
  })

  test('lists the projects of a valid token', () => {
    const body = apiHelp(origin, { projects: [{ id: 'prj_1', name: 'web' }] })
    expect(body).toContain('The token is valid')
    expect(body).toContain('- `web` (prj_1)')
    expect(apiHelp(origin, { projects: [] })).toContain('There are no projects yet.')
  })

  test('puts the before and after upload on one line', () => {
    expect(apiHelp(origin, 'missing')).toContain(
      `11. curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" --data-binary @<change>.zip "${origin}/api/upload?project=<project>&name=<change>.zip"`,
    )
  })
})
