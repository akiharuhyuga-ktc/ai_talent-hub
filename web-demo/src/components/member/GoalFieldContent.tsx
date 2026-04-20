'use client'

interface Section {
  label: string
  content: string
}

function parseGoalFieldContent(raw: string): { mainText: string; sections: Section[] } {
  const parts = raw.split(/^└\s*/m)
  const mainText = parts[0].trim()
  const sections = parts.slice(1).map(part => {
    const colonIdx = part.search(/[：:]/)
    if (colonIdx >= 0) {
      return {
        label: part.slice(0, colonIdx).trim(),
        content: part.slice(colonIdx + 1).replace(/^\s*\n/, '').trim(),
      }
    }
    return { label: '', content: part.trim() }
  }).filter(s => s.content)
  return { mainText, sections }
}

function normalizeText(text: string): string {
  // 行頭以外の（1）（2）等の前に改行を挿入
  return text.replace(/([^\n])([（(][1-9][）)])/g, '$1\n$2')
}

function Paragraphs({ text, className = '' }: { text: string; className?: string }) {
  const normalized = normalizeText(text)
  return (
    <>
      {normalized.split(/\n{2,}/).filter(Boolean).map((block, i) => {
        const lines = block.split('\n').filter(Boolean)
        if (lines.length > 1) {
          return (
            <ul key={i} className={`space-y-1.5 list-none pl-0 last:mb-0 ${className}`}>
              {lines.map((line, j) => (
                <li key={j} className="leading-relaxed">{line.trim()}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className={`leading-relaxed last:mb-0 ${className}`}>
            {block.trim()}
          </p>
        )
      })}
    </>
  )
}

interface GoalFieldContentProps {
  content: string
}

const SECTION_LABEL_COLORS: Record<string, string> = {
  '達成した姿': 'border-blue-300 text-blue-700',
  '検証方法': 'border-emerald-300 text-emerald-700',
  '中間確認': 'border-amber-300 text-amber-700',
  '根拠': 'border-purple-300 text-purple-700',
}

function getSectionColor(label: string): string {
  for (const [key, cls] of Object.entries(SECTION_LABEL_COLORS)) {
    if (label.includes(key)) return cls
  }
  return 'border-gray-300 text-gray-600'
}

export function GoalFieldContent({ content }: GoalFieldContentProps) {
  const { mainText, sections } = parseGoalFieldContent(content)

  return (
    <div>
      {mainText && (
        <div className="mb-6">
          <div className="space-y-3 text-gray-800 text-2xl leading-relaxed">
            <Paragraphs text={mainText} className="mb-3" />
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-5">
          {sections.map((section, i) => {
            const colorCls = getSectionColor(section.label)
            return (
              <div key={i} className={`border-l-[3px] pl-4 ${colorCls.split(' ')[0]}`}>
                <p className={`text-2xl font-bold mb-2 ${colorCls.split(' ')[1]}`}>
                  {section.label}
                </p>
                <div className="space-y-2 text-2xl text-gray-600 leading-relaxed">
                  <Paragraphs text={section.content} className="mb-2" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
