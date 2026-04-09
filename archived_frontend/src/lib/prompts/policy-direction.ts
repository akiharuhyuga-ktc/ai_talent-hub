export function buildContinuousDirectionSystemPrompt(): string {
  return `あなたは組織マネジメントの専門コンサルタントです。
以下の情報をもとに、新年度の方針立案の「方向性」を提案してください。
草案の全文ではなく、方針の骨格を継続・強化・新設・廃止の4分類で提示することが目的です。

【出力ルール】
・継続／強化／新設／廃止の4分類で箇条書きにすること
・各項目に根拠（どのインプットから導いたか）を1行で添えること
・全文の草案は絶対に出力しないこと
・マネージャーが「これは違う」と言いやすい粒度にすること
・重点テーマは3〜4個に絞り込むこと
・出力は日本語で行うこと`
}

export function buildContinuousDirectionUserMessage(params: {
  prevContent: string
  whatWorked: string
  whatDidntWork: string
  leftBehind: string
  envChanges: string
  techChanges: string
  focusThemes: string
}): string {
  return `## 前年度方針
${params.prevContent}

## 前年度振り返り
・うまくいったこと：${params.whatWorked}
・うまくいかなかったこと：${params.whatDidntWork}
・やり残したこと：${params.leftBehind}

## 来期の環境変化・重点テーマ
・組織・チームの状況変化：${params.envChanges}
・技術・ビジネス環境の変化：${params.techChanges}
・来期に特に強化したいテーマ：${params.focusThemes}

上記をもとに、新年度方針の方向性を提案してください。`
}

export function buildInitialDirectionSystemPrompt(): string {
  return `あなたは組織マネジメントの専門コンサルタントです。
以下の組織情報をもとに、新年度の方針立案の「骨格」を提案してください。
これが初めての方針策定のため、前年度の踏襲ではなくこのチームに最適な骨格を一から設計してください。

【出力ルール】
・ミッション／重点テーマ／行動指針の3構造で出力すること
・各項目に根拠を1行で添えること
・全文の草案は出力しないこと
・重点テーマは3〜4個に絞り込み、網羅主義を避けること
・出力は日本語で行うこと`
}

export function buildInitialDirectionUserMessage(params: {
  teamInfo: string
  techDomains: string
  challenges: string
  strengths: string
  mission: string
  themes: string
  upperOrgPolicy: string
}): string {
  const parts = [
    '## 組織の現状',
    `・チーム情報：${params.teamInfo}`,
    `・主要な技術・業務領域：${params.techDomains}`,
    `・現在の課題：${params.challenges}`,
    `・チームの強み：${params.strengths}`,
    `・来期のミッション：${params.mission}`,
    `・取り組みたいテーマ：${params.themes}`,
  ]

  if (params.upperOrgPolicy) {
    parts.push('', '## 上位組織の方針（参考）', params.upperOrgPolicy)
  }

  parts.push('', '上記をもとに、組織方針の骨格を提案してください。')
  return parts.join('\n')
}
