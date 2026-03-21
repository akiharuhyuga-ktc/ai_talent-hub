import fs from 'fs'
import { SHARED_DOCS } from './paths'

export function loadSharedDocs(): {
  policy: string
  criteria: string
  guidelines: string
} {
  const read = (p: string) => {
    try { return fs.readFileSync(p, 'utf-8') } catch { return '' }
  }
  return {
    policy: read(SHARED_DOCS.policy),
    criteria: read(SHARED_DOCS.criteria),
    guidelines: read(SHARED_DOCS.guidelines),
  }
}
