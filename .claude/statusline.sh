#!/bin/bash
# Claude Code Statusline v12 — stdin rate_limits + Braille Dots 8段階バー
set -f

# --- カラーパレット（7色 + セマンティック4色） ---
R=$'\033[0m'
B=$'\033[1m'
# Tier 1: 値（全ての数値に統一使用）
cVAL=$'\033[38;5;255m'    # 白 — %, 時間, コスト, 行数
# Tier 2: アクセント（視覚的な主役）
cPRI=$'\033[38;5;111m'    # 青 — モデル名
cPATH=$'\033[38;5;116m'   # シアン — git path
# Tier 3: 控えめ
cLBL=$'\033[38;5;245m'    # 灰 — ラベル, 区切り
cMUT=$'\033[38;5;242m'    # 暗灰 — メタ (version, date)
# セマンティック（バー + 使用率の段階色）
cGOOD=$'\033[38;5;114m'   # 緑 — <50%、+行
cWARN=$'\033[38;5;179m'   # 黄 — >=50%
cALRT=$'\033[38;5;173m'   # 橙 — >=70%、dirty
cCRIT=$'\033[38;5;167m'   # 赤 — >=90%、-行
SEP="${cLBL}│${R}"

# Braille Dots: 各セルが 8段階（0=空 ... 7=全充填）
BRAILLE=(' ' '⣀' '⣄' '⣤' '⣦' '⣶' '⣷' '⣿')

# ============================================================
# ユーティリティ関数
# ============================================================

# Braille Dots バー生成（8段階/セル × width = 高解像度）
# $1=パーセンテージ(0-100)  $2=幅（デフォルト8）
# 結果: _BAR（フォーマット済み文字列）, _BAR_C（色コード）
_bar() {
  local pct=$1 w=${2:-8}
  [ "$pct" -lt 0 ] 2>/dev/null && pct=0
  [ "$pct" -gt 100 ] 2>/dev/null && pct=100
  if   [ "$pct" -ge 90 ]; then _BAR_C=$cCRIT
  elif [ "$pct" -ge 70 ]; then _BAR_C=$cALRT
  elif [ "$pct" -ge 50 ]; then _BAR_C=$cWARN
  else _BAR_C=$cGOOD; fi
  local bar="" i seg_s seg_e frac
  for (( i=0; i<w; i++ )); do
    seg_s=$(( i * 100 / w ))
    seg_e=$(( (i+1) * 100 / w ))
    if [ "$pct" -ge "$seg_e" ]; then
      bar+="${BRAILLE[7]}"
    elif [ "$pct" -le "$seg_s" ]; then
      bar+="${BRAILLE[0]}"
    else
      frac=$(( (pct - seg_s) * 7 / (seg_e - seg_s) ))
      [ "$frac" -gt 7 ] && frac=7
      bar+="${BRAILLE[$frac]}"
    fi
  done
  _BAR="${cLBL}[${_BAR_C}${bar}${cLBL}]${R}"
}

# 秒を人間が読みやすい形式に変換（グローバル変数 _DURATION に格納）
# $1=秒数  $2=compact (省略可: "1"で分以下の秒を省略)
_fmt_duration() {
  local sec=$1 compact=${2:-0}
  if [ "$sec" -ge 86400 ]; then
    _DURATION="$(( sec / 86400 ))d$(( (sec % 86400) / 3600 ))h"
  elif [ "$sec" -ge 3600 ]; then
    _DURATION="$(( sec / 3600 ))h$(( (sec % 3600) / 60 ))m"
  elif [ "$sec" -ge 60 ]; then
    if [ "$compact" = 1 ]; then
      _DURATION="$(( sec / 60 ))m"
    else
      _DURATION="$(( sec / 60 ))m$(( sec % 60 ))s"
    fi
  else
    _DURATION="${sec}s"
  fi
}

# ファイルの mtime を epoch 秒で取得（Linux/macOS 両対応）
_file_mtime() {
  stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0
}

# Stale-While-Revalidate キャッシュ読み込み + バックグラウンド更新
# 引数: $1=キャッシュファイルパス  $2=TTL秒  $3=更新コマンド
# 結果: グローバル変数 _CACHE_DATA に格納
_swr_cache() {
  local cache_file=$1 ttl=$2 refresh_cmd=$3
  local mod
  mod=$(_file_mtime "$cache_file")
  _CACHE_DATA=$(<"$cache_file" 2>/dev/null) || true
  if [ $(( NOW - mod )) -gt "$ttl" ]; then
    ( eval "$refresh_cmd" ) </dev/null >/dev/null 2>&1 &
    disown 2>/dev/null
  fi
}

# 数値サニタイズ（非数値文字を除去、空ならデフォルト0。サブプロセス回避）
_sanitize_int() {
  local _v="${1%%[!0-9]*}"
  _SINT="${_v:-0}"
}

# ============================================================
# stdin パース（1回の jq で全フィールド抽出、rate_limits 含む）
# ============================================================

input=$(cat)
[ -z "$input" ] && { printf '%s\n' "Claude"; exit 0; }

{
  read -r MODEL
  read -r PCT
  read -r COST
  read -r LINES_ADD
  read -r LINES_DEL
  read -r CUR_VERSION
  read -r WT_NAME
  read -r WT_BRANCH
  read -r CWD
  read -r DURATION_MS
  read -r RL5_PCT
  read -r RL5_RESET
  read -r RL7_PCT
  read -r RL7_RESET
} <<< "$(
  printf '%s' "$input" | jq -r '
    (.model.display_name // "Unknown"),
    ((.context_window.used_percentage // 0) | floor | tostring),
    (.cost.total_cost_usd // 0 | tostring),
    (.cost.total_lines_added // 0 | tostring),
    (.cost.total_lines_removed // 0 | tostring),
    (.version // ""),
    (.worktree.name // ""),
    (.worktree.branch // ""),
    (.cwd // ""),
    (.cost.total_duration_ms // 0 | tostring),
    ((.rate_limits.five_hour.used_percentage // 0) | floor | tostring),
    (.rate_limits.five_hour.resets_at // 0 | tostring),
    ((.rate_limits.seven_day.used_percentage // 0) | floor | tostring),
    (.rate_limits.seven_day.resets_at // 0 | tostring)
  ' 2>/dev/null
)"
[ -z "$MODEL" ] && { printf '%s\n' "Claude (parse error)"; exit 0; }

# モデル名短縮
MODEL="${MODEL/ context)/\)}"

# 数値サニタイズ
_sanitize_int "$PCT"; PCT="$_SINT"
_sanitize_int "$LINES_ADD"; LINES_ADD="$_SINT"
_sanitize_int "$LINES_DEL"; LINES_DEL="$_SINT"
_sanitize_int "$DURATION_MS"; DURATION_MS="$_SINT"
_sanitize_int "$RL5_PCT"; RL5_PCT="$_SINT"
_sanitize_int "$RL5_RESET"; RL5_RESET="$_SINT"
_sanitize_int "$RL7_PCT"; RL7_PCT="$_SINT"
_sanitize_int "$RL7_RESET"; RL7_RESET="$_SINT"
case "$COST" in *[!0-9.]*) COST="0" ;; esac
[ -z "$COST" ] && COST="0"

# ============================================================
# データ準備
# ============================================================

# タイムスタンプ（全キャッシュ判定の基準）
printf -v NOW '%(%s)T' -1 2>/dev/null || NOW=$(date +%s)

# プロジェクト別キャッシュプレフィックス（CWD のハッシュで衝突回避）
_CWD_HASH=$(printf '%s' "$CWD" | md5 -q 2>/dev/null || printf '%s' "$CWD" | md5sum 2>/dev/null | cut -d' ' -f1)
_CWD_HASH="${_CWD_HASH:0:8}"
_CACHE_PFX="/tmp/claude-statusline-${_CWD_HASH}"

# --- Context バー ---
_bar "$PCT" 8
CTX_BAR="$_BAR"
CTX_ICON=""
if   [ "$PCT" -ge 90 ]; then CTX_ICON=" 💀"
elif [ "$PCT" -ge 70 ]; then CTX_ICON=" 🔥"
elif [ "$PCT" -ge 50 ]; then CTX_ICON=" ⚠️"
fi

# --- セッション時間 ---
SESSION_TIME="0s"
if [ "$DURATION_MS" -gt 0 ] 2>/dev/null; then
  _fmt_duration $(( DURATION_MS / 1000 ))
  SESSION_TIME="$_DURATION"
fi

# --- Git（SWR: 5秒キャッシュ） ---
_git_cache="${_CACHE_PFX}-git"
_swr_cache "$_git_cache" 5 '
  _t() { if command -v timeout >/dev/null 2>&1; then timeout "$@"; else shift; "$@"; fi; }
  _b=$(_t 2 git branch --show-current 2>/dev/null)
  _d=""; _t 2 git diff-index --quiet HEAD 2>/dev/null || _d="*"
  _a=0; _be=0
  [ -n "$_b" ] && read -r _a _be <<< "$(_t 2 git rev-list --left-right --count "HEAD...@{upstream}" 2>/dev/null)"
  printf "%s\n%s\n%s\n%s\n" "$_b" "$_d" "${_a:-0}" "${_be:-0}" > "'"$_git_cache"'.tmp" && mv "'"$_git_cache"'.tmp" "'"$_git_cache"'"
'
{ read -r BRANCH; read -r GIT_DIRTY; read -r GIT_AHEAD; read -r GIT_BEHIND; } <<< "$_CACHE_DATA"
[ -n "$WT_BRANCH" ] && BRANCH="$WT_BRANCH"

# ブランチ表示の組み立て
BC=$cVAL
case "$BRANCH" in
  feat/*|feature/*)       BC=$cPRI ;;
  fix/*|bugfix/*|hotfix/*) BC=$cALRT ;;
  chore/*)                BC=$cLBL ;;
  docs/*)                 BC=$cGOOD ;;
  refactor/*)             BC=$cWARN ;;
esac
BS="$BRANCH"
[ ${#BS} -gt 35 ] && BS="${BS:0:32}..."

GS=""
[ "$GIT_DIRTY" = "*" ] && GS="${cALRT}*${R}"
[ "${GIT_AHEAD:-0}" -gt 0 ] 2>/dev/null && GS="${GS}${cGOOD}↑${GIT_AHEAD}${R}"
[ "${GIT_BEHIND:-0}" -gt 0 ] 2>/dev/null && GS="${GS}${cCRIT}↓${GIT_BEHIND}${R}"

DIRNAME="${CWD##*/}"
PD=""
if [ -n "$DIRNAME" ]; then
  PD="${cPATH}${DIRNAME}${R}"
  [ -n "$BRANCH" ] && PD="${PD} ${cLBL}(${R}${BC}⎇ ${BS}${R}${GS}${cLBL})${R}"
fi
WT=""
[ -n "$WT_NAME" ] && WT="  ${cLBL}[wt:${R}${cVAL}${WT_NAME}${R}${cLBL}]${R}"

# --- Effort（SWR: 60秒キャッシュ） ---
EFFORT="${CLAUDE_CODE_EFFORT_LEVEL:-}"
if [ -z "$EFFORT" ]; then
  _swr_cache "${_CACHE_PFX}-effort" 60 \
    'jq -r ".effortLevel // empty" ~/.claude/settings.json > "'"${_CACHE_PFX}-effort"'.tmp" 2>/dev/null && mv "'"${_CACHE_PFX}-effort"'.tmp" "'"${_CACHE_PFX}-effort"'"'
  EFFORT="${_CACHE_DATA:-default}"
fi

# --- Version（SWR: 3600秒キャッシュ） ---
VD=""
if [ -n "$CUR_VERSION" ]; then
  _swr_cache "${_CACHE_PFX}-latest-ver" 3600 \
    'npm view @anthropic-ai/claude-code version > "'"${_CACHE_PFX}-latest-ver"'.tmp" 2>/dev/null && mv "'"${_CACHE_PFX}-latest-ver"'.tmp" "'"${_CACHE_PFX}-latest-ver"'"'
  if [ -n "$_CACHE_DATA" ] && [ "$_CACHE_DATA" != "$CUR_VERSION" ]; then
    VD="${cMUT}v${CUR_VERSION} → v${_CACHE_DATA}${R}"
  else
    VD="${cMUT}v${CUR_VERSION}${R}"
  fi
fi

# --- コスト ---
printf -v COST_FMT '%.2f' "$COST" 2>/dev/null || COST_FMT="0.00"

# --- Rate Limit（stdin から直接取得 — API 呼び出し不要） ---
# $1=使用率%  $2=リセット時刻(epoch秒)
_rl_segment() {
  local pct=${1:-0} reset_epoch=${2:-0}
  _bar "$pct" 8
  _RL_SEGMENT="$_BAR ${cVAL}${B}${pct}%${R}"
  if [ "$reset_epoch" -gt 0 ] 2>/dev/null && [ "$reset_epoch" -gt "$NOW" ] 2>/dev/null; then
    _fmt_duration $(( reset_epoch - NOW )) 1
    _RL_SEGMENT="${_RL_SEGMENT} ${cMUT}⟳${_DURATION}${R}"
  fi
}

RL_LINE=""
if [ "$RL5_RESET" -gt 0 ] 2>/dev/null; then
  _rl_segment "$RL5_PCT" "$RL5_RESET"
  RL_LINE="${cLBL}5h${R} ${_RL_SEGMENT}"
  if [ "$RL7_RESET" -gt 0 ] 2>/dev/null; then
    _rl_segment "$RL7_PCT" "$RL7_RESET"
    RL_LINE="${RL_LINE} ${SEP} ${cLBL}7d${R} ${_RL_SEGMENT}"
  fi
fi

# ============================================================
# 出力（4行）
# ============================================================

# Line 1: モデル設定 + コンテキスト使用率
printf '%s\n' "${cPRI}${B}${MODEL}${R} ${SEP} ${cLBL}effort:${R}${cVAL}${EFFORT}${R} ${SEP} ${cLBL}ctx${R} ${CTX_BAR} ${cVAL}${B}${PCT}%${R}${CTX_ICON}"

# Line 2: レートリミット（データがある場合のみ）
[ -n "$RL_LINE" ] && printf '%s\n' "$RL_LINE"

# Line 3: 作業コンテキスト（git パス + ブランチ）
[ -n "$PD" ] && printf '%s\n' "${PD}${WT}"

# Line 4: セッション統計 + バージョン + 日時
TZ=Asia/Tokyo printf -v JST '%(%m/%d %H:%M)T' -1 2>/dev/null || JST=$(TZ=Asia/Tokyo date '+%m/%d %H:%M' 2>/dev/null)
L4="${cLBL}⏱${R} ${cVAL}${SESSION_TIME}${R} ${SEP} ${cVAL}\$${COST_FMT}${R} ${SEP} ${cGOOD}+${LINES_ADD}${R}${cLBL}/${R}${cCRIT}-${LINES_DEL}${R}"
[ -n "$VD" ] && L4="${L4} ${SEP} ${VD}"
[ -n "$JST" ] && L4="${L4} ${SEP} ${cMUT}${JST}${R}"
printf '%s\n' "$L4"

# デバッグログ（STATUSLINE_DEBUG=1 のときのみ出力）
if [ "${STATUSLINE_DEBUG:-}" = 1 ]; then
  printf -v _ts '%(%H:%M:%S)T' -1 2>/dev/null
  printf '[%s] ok\n' "${_ts:-?}" >> /tmp/claude-statusline-debug.log 2>/dev/null
fi

exit 0
