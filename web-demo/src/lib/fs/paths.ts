import path from 'path'

const PROJECT_ROOT = '/Users/akiharu.hyuga/Documents/Talent_Management_AI'

export const DATA_ROOT = path.join(PROJECT_ROOT, 'talent-management')
export const MEMBERS_DIR = path.join(PROJECT_ROOT, 'data', 'members')
export const SHARED_DIR = path.join(DATA_ROOT, 'shared')

export const SHARED_DOCS = {
  policy: path.join(SHARED_DIR, 'department-policy.md'),
  criteria: path.join(SHARED_DIR, 'evaluation-criteria.md'),
  guidelines: path.join(SHARED_DIR, 'guidelines.md'),
}
