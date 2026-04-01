/**
 * 全録画スクリプトを順次実行するオーケストレーター
 *
 * Usage:
 *   npx ts-node scripts/capture-all.ts           # 全スクリプト実行
 *   npx ts-node scripts/capture-all.ts --from capture-v06-v07-oo  # 途中から再開
 */
import { execSync, spawn, ChildProcess } from 'child_process'
import path from 'path'
import { checkApiKey, waitForServer } from './helpers/browser'

const PROJECT_ROOT = path.join(__dirname, '../..')
const WEB_DEMO_DIR = path.join(PROJECT_ROOT, 'web-demo')

const STEPS = [
  { name: 'setup-demo-data', label: 'デモデータ準備' },
  { name: 'capture-v01-policy', label: 'V01: 組織方針ウィザード' },
  { name: 'capture-v02-v05-goal', label: 'V02-V05: 目標設定ウィザード' },
  { name: 'capture-v06-v07-oo', label: 'V06-V07: 1on1ウィザード' },
  { name: 'capture-v08-v09-review', label: 'V08-V09: 評価ウィザード' },
  { name: 'capture-v10-matrix', label: 'V10: チームマトリクス' },
]

function parseArgs(): { fromStep: string | null } {
  const args = process.argv.slice(2)
  const fromIdx = args.indexOf('--from')
  if (fromIdx !== -1 && args[fromIdx + 1]) {
    return { fromStep: args[fromIdx + 1] }
  }
  return { fromStep: null }
}

async function startDevServer(): Promise<ChildProcess> {
  console.log('🚀 Next.js devサーバーを起動中...')

  execSync('rm -rf .next', { cwd: WEB_DEMO_DIR, stdio: 'pipe' })

  const server = spawn('npm', ['run', 'dev'], {
    cwd: WEB_DEMO_DIR,
    stdio: 'pipe',
    env: { ...process.env },
  })

  server.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString()
    if (msg.includes('Error')) console.error(`[server] ${msg.trim()}`)
  })

  await waitForServer('http://localhost:3000', 60000)
  console.log('✅ devサーバー起動完了\n')
  return server
}

async function main() {
  const { fromStep } = parseArgs()

  console.log('========================================')
  console.log(' KTC TalentHub デモ動画 自動録画')
  if (fromStep) console.log(` (--from ${fromStep})`)
  console.log('========================================\n')

  checkApiKey()

  let server: ChildProcess | null = null
  try {
    server = await startDevServer()

    let skipping = fromStep !== null

    for (const step of STEPS) {
      // setup-demo-data は常に実行（クリーンアップのため）
      if (skipping && step.name !== 'setup-demo-data') {
        if (step.name === fromStep) {
          skipping = false
        } else {
          console.log(`⏭ スキップ: ${step.label}`)
          continue
        }
      }

      console.log(`\n▶ ${step.label} 開始`)
      console.log('─'.repeat(40))
      try {
        execSync(`npx ts-node scripts/${step.name}.ts`, {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit',
          timeout: 300000,
        })
        console.log(`✅ ${step.label} 完了`)
      } catch (err) {
        console.error(`❌ ${step.label} 失敗`)
        console.error(err)
        throw new Error(`${step.label} でエラーが発生したため停止します`)
      }
    }

    console.log('\n========================================')
    console.log(' 全録画スクリプト完了')
    console.log('========================================')
    console.log('\n📁 出力先: output/raw/')
    console.log('📋 タイムスタンプ: output/raw/timestamps-*.json')
    console.log('\n次のステップ:')
    console.log('  1. クリップ分割: bash scripts/split-and-convert.ts')
    console.log('  2. 動画合成: bash scripts/compose-full-video-v4.sh')

  } finally {
    if (server) {
      server.kill('SIGTERM')
      console.log('\n🛑 devサーバー終了')
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
