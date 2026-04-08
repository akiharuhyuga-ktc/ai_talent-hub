import path from 'path'

export const DATA_ROOT = path.join(
  '/Users/akiharu.hyuga/Documents/Talent_Management_AI',
  'talent-management'
)

export const MEMBERS_DIR = path.join(DATA_ROOT, 'members')
export const SHARED_DIR = path.join(DATA_ROOT, 'shared')

export const SHARED_DOCS = {
  policy: path.join(SHARED_DIR, 'department-policy.md'),
  criteria: path.join(SHARED_DIR, 'evaluation-criteria.md'),
  guidelines: path.join(SHARED_DIR, 'guidelines.md'),
}
