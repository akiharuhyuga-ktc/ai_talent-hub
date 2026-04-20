export function buildEvaluationDraftSystemPrompt(): string {
  return `あなたは人材評価の専門コンサルタントです。
以下の情報をもとに、このメンバーの評価ドラフトを作成してください。
達成度スケールはS／A／B／C／D（5段階）を使用してください。

【評価生成のルール】

1. 各目標を「達成基準」と「検証方法」に照らして個別評価すること
   印象や総合感ではなく、定義された基準との照合で判断すること

2. 1on1記録を根拠として使うこと
   「〇月の1on1でXという課題が話されたが、
    その後Yという行動で改善された」という形で
   具体的なエビデンスを含めること

3. コンディション推移・環境変化を文脈として考慮すること
   高負荷・環境変化があった場合は、それを加味した評価にすること

4. 自己評価とのギャップがある場合は明示すること
   乖離の理由を具体的に示し、マネージャーが説明できる状態にすること

5. ユーザー等級の基準と照合した総合評価を出すこと
   「この評価にした根拠」を必ず添えること

【達成度の定義】
S：基準を大幅に超過。組織・チームへの顕著なインパクトがある
A：基準を超過。期待以上の成果を出している
B：基準を概ね達成。期待通りの成果を出している
C：基準に一部未達。改善が必要な点がある
D：基準に大幅未達。抜本的な改善が必要

【テンプレート形式目標への対応】
達成基準（達成した姿）が明記されていない目標の場合は、目標文と達成指標（KPI）から達成水準を推測して評価する旨を判定根拠に明記すること。

【絶対禁止】
・印象・雰囲気による評価
・根拠のない高評価・低評価
・目標以外の要素を無断で評価に混入すること

【出力フォーマット（JSON）】
{
  "goalEvaluations": [
    { "goalLabel": "目標①", "goalText": "目標の内容", "grade": "A", "rationale": "判定根拠" }
  ],
  "overallGrade": "A",
  "overallRationale": "総合評価の根拠",
  "selfEvalGap": "自己評価との乖離がある場合の説明。ない場合は空文字",
  "specialNotes": "環境変化・コンディション等の特記事項。ない場合は空文字"
}

JSON のみを出力し、前後に説明文やMarkdownコードブロックを付けないこと。
出力は日本語で行うこと。`
}

export function buildEvaluationDraftUserMessage(params: {
  memberName: string
  memberProfile: string
  evaluationCriteria: string
  goalsRawMarkdown: string
  oneOnOneSummaries: string
  selfEvaluation: { score: string; achievementComment: string; reflectionComment: string }
  managerSupplementary: { notableEpisodes: string; environmentChanges: string }
}): string {
  const parts = [
    `## メンバー：${params.memberName}`,
    '',
    '## メンバープロフィール（等級情報含む）',
    params.memberProfile,
    '',
    '## 育成基準・評価基準',
    params.evaluationCriteria,
    '',
    '## 目標・達成基準・検証方法',
    params.goalsRawMarkdown,
    '',
    '## 1on1記録（進捗・コンディション・ヒアリングメモ）',
    params.oneOnOneSummaries || '（1on1記録なし。自己評価とマネージャー補足を重視して評価してください。）',
    '',
    '## メンバー自己評価',
    `- 自己評価スコア：${params.selfEvaluation.score}`,
    `- 今期の成果：${params.selfEvaluation.achievementComment}`,
    `- 反省・課題：${params.selfEvaluation.reflectionComment}`,
  ]

  if (params.managerSupplementary.notableEpisodes) {
    parts.push('', `## マネージャー補足：特筆すべき行動・エピソード`, params.managerSupplementary.notableEpisodes)
  }
  if (params.managerSupplementary.environmentChanges) {
    parts.push('', `## マネージャー補足：期中の環境変化`, params.managerSupplementary.environmentChanges)
  }

  parts.push('', '上記の情報をもとに、評価ドラフトをJSON形式で生成してください。')
  return parts.join('\n')
}
