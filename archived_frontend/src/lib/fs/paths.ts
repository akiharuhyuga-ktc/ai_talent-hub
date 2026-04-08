import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = process.env.TALENT_DATA_ROOT
  ?? path.resolve(process.cwd(), '..')

export const DATA_ROOT = path.join(PROJECT_ROOT, 'talent-management')
export const MEMBERS_DIR = path.join(PROJECT_ROOT, 'data', 'members')
export const DEMO_MEMBERS_DIR = path.join(PROJECT_ROOT, 'data', 'demo-members')
export const SHARED_DIR = path.join(DATA_ROOT, 'shared')

export const DEMO_MODE_FILE = path.join(PROJECT_ROOT, 'data', '.demo-mode.json')

export const SHARED_DOCS = {
  policy: path.join(SHARED_DIR, 'department-policy.md'),
  criteria: path.join(SHARED_DIR, 'evaluation-criteria.md'),
  guidelines: path.join(SHARED_DIR, 'guidelines.md'),
}

export function isDemoMode(): boolean {
  try {
    const raw = fs.readFileSync(DEMO_MODE_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return data.enabled === true
  } catch {
    return false
  }
}

export function getMembersDir(): string {
  return isDemoMode() ? DEMO_MEMBERS_DIR : MEMBERS_DIR
}
