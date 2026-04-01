#!/bin/bash
set -euo pipefail

########################################
# KTC TalentHub デモ動画 — v4
# 左右分割レイアウト + AIカット接合（ディゾルブ）
########################################

BASE="/Users/akiharu.hyuga/Documents/Talent_Management_AI/video-capture"
RAW="$BASE/output/raw"
CLIPS="$BASE/output/clips"
EDIT="$BASE/output/edit"
WORK="$BASE/output/work"
TS_DIR="$RAW"
FONT="/tmp/_hiragino_w7.ttc"

mkdir -p "$WORK" "$CLIPS"
ln -sf "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc" "$FONT"

ENC="-c:v libx264 -pix_fmt yuv420p -preset medium -crf 18 -r 30"

# ── テロップスタイル（左右分割レイアウト用）──
SC="fontfile='$FONT':fontcolor=#D4941A:fontsize=18"    # Scene番号
TT="fontfile='$FONT':fontcolor=#87CDE0:fontsize=20"    # Sceneタイトル
MN="fontfile='$FONT':fontcolor=#FFFFFF:fontsize=44"     # Main
SB="fontfile='$FONT':fontcolor=#48B6D3:fontsize=20"     # Sub

echo "============================================"
echo "v4: 左右分割 + AIカット接合（ディゾルブ）"
echo "============================================"

########################################
# ヘルパー: タイムスタンプ読み込み
########################################
read_ts() {
  local file="$1" key="$2"
  jq -r ".marks[] | select(.id==\"$key\") | .time" "$file"
}

########################################
# ヘルパー: AIカット接合（ディゾルブ）
# $1=入力動画 $2=STREAM_START $3=AI_DONE $4=SHOWCASE_END $5=出力ファイル
########################################
ai_cut_join() {
  local input="$1" ss="$2" done="$3" end="$4" output="$5"

  # セグメントA: ストリーミング冒頭（2秒前〜+5秒）
  local seg_a_start seg_a_end seg_a_dur
  seg_a_start=$(echo "$ss - 2" | bc)
  if (( $(echo "$seg_a_start < 0" | bc -l) )); then seg_a_start=0; fi
  seg_a_end=$(echo "$ss + 5" | bc)
  seg_a_dur=$(echo "$seg_a_end - $seg_a_start" | bc)

  # セグメントB: 完了直前〜ショーケース末尾
  local seg_b_start
  seg_b_start=$(echo "$done - 2" | bc)
  if (( $(echo "$seg_b_start < 0" | bc -l) )); then seg_b_start=0; fi

  ffmpeg -y -ss "$seg_a_start" -to "$seg_a_end" -i "$input" $ENC "$WORK/_seg_a.mp4" 2>/dev/null
  ffmpeg -y -ss "$seg_b_start" -to "$end" -i "$input" $ENC "$WORK/_seg_b.mp4" 2>/dev/null

  # ディゾルブ接合（0.4秒クロスフェード）
  local offset
  offset=$(echo "$seg_a_dur - 0.4" | bc)
  ffmpeg -y \
    -i "$WORK/_seg_a.mp4" -i "$WORK/_seg_b.mp4" \
    -filter_complex "xfade=transition=fade:duration=0.4:offset=$offset" \
    $ENC "$output" 2>/dev/null

  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$output")
  echo "  → $(basename "$output"): ${dur}s"
}

########################################
# ヘルパー: テロップ合成（左右分割レイアウト）
########################################
apply_telop() {
  local input="$1" output="$2" scene="$3" title="$4"
  local main1="$5" main2="$6" main3="$7" sub1="$8" sub2="$9"

  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$input")

  ffmpeg -y -f lavfi -i "color=c=#0E3C4E:s=1920x1080:d=$dur" -i "$input" \
    -filter_complex "\
[1:v]fps=30,scale=1466:824[cap];\
[0:v][cap]overlay=430:128[base];\
[base]\
drawtext=$SC:text='$scene':x=36:y=280,\
drawtext=$TT:text='$title':x=36:y=310,\
drawtext=$MN:text='$main1':x=36:y=400,\
drawtext=$MN:text='$main2':x=36:y=460,\
drawtext=$MN:text='$main3':x=36:y=520,\
drawtext=$SB:text='$sub1':x=36:y=650,\
drawtext=$SB:text='$sub2':x=36:y=680\
[out]" -map "[out]" -an $ENC "$output" 2>/dev/null

  echo "  → $(basename "$output"): ${dur}s"
}

echo ""
echo "Phase 1: AIカット接合..."

########################################
# Phase 1: AIカット接合クリップ生成
########################################

# V01 — 3箇所のAI生成を接合
TS_V01="$TS_DIR/timestamps-v01.json"
if [ -f "$TS_V01" ]; then
  echo "[V01] S4: AI方向性提案..."
  ai_cut_join "$RAW/v01_policy_wizard.webm" \
    "$(read_ts "$TS_V01" V01S4_STREAM_START)" \
    "$(read_ts "$TS_V01" V01S4_AI_DONE)" \
    "$(read_ts "$TS_V01" V01S4_SHOWCASE_END)" \
    "$CLIPS/v01_s4_joined.mp4"

  echo "[V01] S5: AI草案..."
  ai_cut_join "$RAW/v01_policy_wizard.webm" \
    "$(read_ts "$TS_V01" V01S5_STREAM_START)" \
    "$(read_ts "$TS_V01" V01S5_AI_DONE)" \
    "$(read_ts "$TS_V01" V01S5_SHOWCASE_END)" \
    "$CLIPS/v01_s5_joined.mp4"

  echo "[V01] S6: AI壁打ち..."
  ai_cut_join "$RAW/v01_policy_wizard.webm" \
    "$(read_ts "$TS_V01" V01S6_STREAM_START)" \
    "$(read_ts "$TS_V01" V01S6_AI_DONE)" \
    "$(read_ts "$TS_V01" V01S6_SHOWCASE_END)" \
    "$CLIPS/v01_s6_joined.mp4"
else
  echo "⚠️ timestamps-v01.json が見つかりません。V01スキップ"
fi

# V02-V05
TS_V02="$TS_DIR/timestamps-v02-v05.json"
if [ -f "$TS_V02" ]; then
  echo "[V04] AI診断..."
  ai_cut_join "$RAW/goal-wizard-full.webm" \
    "$(read_ts "$TS_V02" V04_STREAM_START)" \
    "$(read_ts "$TS_V02" V04_AI_DONE)" \
    "$(read_ts "$TS_V02" V04_SHOWCASE_END)" \
    "$CLIPS/v04_joined.mp4"

  echo "[V05] AI目標生成..."
  ai_cut_join "$RAW/goal-wizard-full.webm" \
    "$(read_ts "$TS_V02" V05_STREAM_START)" \
    "$(read_ts "$TS_V02" V05_AI_DONE)" \
    "$(read_ts "$TS_V02" V05_SHOWCASE_END)" \
    "$CLIPS/v05_joined.mp4"

  echo "[V05R] 壁打ち再生成..."
  ai_cut_join "$RAW/goal-wizard-full.webm" \
    "$(read_ts "$TS_V02" V05R_STREAM_START)" \
    "$(read_ts "$TS_V02" V05R_AI_DONE)" \
    "$(read_ts "$TS_V02" V05R_SHOWCASE_END)" \
    "$CLIPS/v05r_joined.mp4"
else
  echo "⚠️ timestamps-v02-v05.json が見つかりません。V02-V05スキップ"
fi

# V06-V07
TS_V07="$TS_DIR/timestamps-v06-v07.json"
if [ -f "$TS_V07" ]; then
  echo "[V07] AIヒアリング質問..."
  ai_cut_join "$RAW/oneonone-wizard-full.webm" \
    "$(read_ts "$TS_V07" V07_STREAM_START)" \
    "$(read_ts "$TS_V07" V07_AI_DONE)" \
    "$(read_ts "$TS_V07" V07_SHOWCASE_END)" \
    "$CLIPS/v07_joined.mp4"
else
  echo "⚠️ timestamps-v06-v07.json が見つかりません。V07スキップ"
fi

# V08-V09
TS_V09="$TS_DIR/timestamps-v08-v09.json"
if [ -f "$TS_V09" ]; then
  echo "[V09] AI評価ドラフト..."
  ai_cut_join "$RAW/review-wizard-full.webm" \
    "$(read_ts "$TS_V09" V09_STREAM_START)" \
    "$(read_ts "$TS_V09" V09_AI_DONE)" \
    "$(read_ts "$TS_V09" V09_SHOWCASE_END)" \
    "$CLIPS/v09_joined.mp4"
else
  echo "⚠️ timestamps-v08-v09.json が見つかりません。V09スキップ"
fi

########################################
# Phase 2: 入力操作クリップ（1.5倍速化）
########################################
echo ""
echo "Phase 2: 入力操作クリップ（1.5倍速）..."

if [ -f "$TS_V02" ]; then
  V02_S=$(read_ts "$TS_V02" V02_START)
  V02_E=$(read_ts "$TS_V02" V02_END)
  ffmpeg -y -ss "$V02_S" -to "$V02_E" -i "$RAW/goal-wizard-full.webm" \
    $ENC "$CLIPS/v02_input.mp4" 2>/dev/null
  echo "  → v02_input.mp4"

  V03_S=$(read_ts "$TS_V02" V03_START)
  V03_E=$(read_ts "$TS_V02" V03_END)
  ffmpeg -y -ss "$V03_S" -to "$V03_E" -i "$RAW/goal-wizard-full.webm" \
    -vf "setpts=PTS/1.5,fps=30" $ENC "$CLIPS/v03_fast.mp4" 2>/dev/null
  echo "  → v03_fast.mp4 (1.5x)"
fi

if [ -f "$TS_V07" ]; then
  V06_S=$(read_ts "$TS_V07" V06_START)
  V06_E=$(read_ts "$TS_V07" V06_END)
  ffmpeg -y -ss "$V06_S" -to "$V06_E" -i "$RAW/oneonone-wizard-full.webm" \
    -vf "setpts=PTS/1.5,fps=30" $ENC "$CLIPS/v06_fast.mp4" 2>/dev/null
  echo "  → v06_fast.mp4 (1.5x)"
fi

if [ -f "$TS_V09" ]; then
  V08_S=$(read_ts "$TS_V09" V08_START)
  V08_E=$(read_ts "$TS_V09" V08_END)
  ffmpeg -y -ss "$V08_S" -to "$V08_E" -i "$RAW/review-wizard-full.webm" \
    -vf "setpts=PTS/1.5,fps=30" $ENC "$CLIPS/v08_fast.mp4" 2>/dev/null
  echo "  → v08_fast.mp4 (1.5x)"
fi

########################################
# Phase 3: V10 クリップ
########################################
echo ""
echo "Phase 3: V10 マトリクス..."

ffmpeg -y -i "$RAW/v10_matrix.webm" -vframes 1 "$WORK/v10_frame.png" 2>/dev/null
ffmpeg -y -loop 1 -i "$WORK/v10_frame.png" -t 3 \
  -vf "fps=30,scale=1920:1080" -an $ENC "$CLIPS/v10_loading.mp4" 2>/dev/null
echo "  → v10_loading.mp4 (3s)"

if [ -f "$TS_DIR/timestamps-v10.json" ]; then
  V10_S=$(read_ts "$TS_DIR/timestamps-v10.json" V10_START)
  V10_E=$(read_ts "$TS_DIR/timestamps-v10.json" V10_END)
  ffmpeg -y -ss "$V10_S" -to "$V10_E" -i "$RAW/v10_matrix.webm" \
    $ENC "$CLIPS/v10_data.mp4" 2>/dev/null
  echo "  → v10_data.mp4"
else
  ffmpeg -y -i "$RAW/v10_matrix.webm" $ENC "$CLIPS/v10_data.mp4" 2>/dev/null
fi

########################################
# Phase 4: 左右分割テロップ合成
########################################
echo ""
echo "Phase 4: テロップ合成..."

# V01 S4
[ -f "$CLIPS/v01_s4_joined.mp4" ] && \
apply_telop "$CLIPS/v01_s4_joined.mp4" "$WORK/02a_v01s4.mp4" \
  "SCENE 02" "組織方針ウィザード" \
  "すべては、" "組織方針から" "始まる。" \
  "AIが方向性を提案" "組織の羅針盤づくりを支援"

# V01 S5
[ -f "$CLIPS/v01_s5_joined.mp4" ] && \
apply_telop "$CLIPS/v01_s5_joined.mp4" "$WORK/02b_v01s5.mp4" \
  "SCENE 02" "組織方針ウィザード" \
  "すべては、" "組織方針から" "始まる。" \
  "方向性をもとに" "AIが草案を自動生成"

# V01 S6
[ -f "$CLIPS/v01_s6_joined.mp4" ] && \
apply_telop "$CLIPS/v01_s6_joined.mp4" "$WORK/02c_v01s6.mp4" \
  "SCENE 02" "組織方針ウィザード" \
  "すべては、" "組織方針から" "始まる。" \
  "壁打ちで精緻化し" "チーム全員の羅針盤になる"

# V02
[ -f "$CLIPS/v02_input.mp4" ] && \
apply_telop "$CLIPS/v02_input.mp4" "$WORK/04_v02.mp4" \
  "SCENE 03" "目標設定ウィザード" \
  "組織方針が" "個人の目標に" "変わる" \
  "組織方針・評価基準" "プロフィールを自動読込"

# V03 (1.5x)
[ -f "$CLIPS/v03_fast.mp4" ] && \
apply_telop "$CLIPS/v03_fast.mp4" "$WORK/05_v03.mp4" \
  "SCENE 03" "目標設定ウィザード" \
  "組織方針が" "個人の目標に" "変わる" \
  "あとはマネージャーの" "期待を入力するだけ"

# V04
[ -f "$CLIPS/v04_joined.mp4" ] && \
apply_telop "$CLIPS/v04_joined.mp4" "$WORK/06_v04.mp4" \
  "SCENE 03" "目標設定ウィザード" \
  "組織方針が" "個人の目標に" "変わる" \
  "組織方針に紐づいた" "その人だけの診断"

# V05
[ -f "$CLIPS/v05_joined.mp4" ] && \
apply_telop "$CLIPS/v05_joined.mp4" "$WORK/07_v05.mp4" \
  "SCENE 03" "目標設定ウィザード" \
  "組織方針が" "個人の目標に" "変わる" \
  "目標案を自動提案" "最終判断はマネージャーが行う"

# V05R (壁打ち)
[ -f "$CLIPS/v05r_joined.mp4" ] && \
apply_telop "$CLIPS/v05r_joined.mp4" "$WORK/07b_v05r.mp4" \
  "SCENE 03" "目標設定ウィザード" \
  "組織方針が" "個人の目標に" "変わる" \
  "フィードバックで" "AIが目標を再構成"

# V06 (1.5x)
[ -f "$CLIPS/v06_fast.mp4" ] && \
apply_telop "$CLIPS/v06_fast.mp4" "$WORK/09_v06.mp4" \
  "SCENE 04" "月次 1on1" \
  "目標があれば" "1on1の質が" "変わる" \
  "目標の進捗を毎月追跡" "遅延・停滞を早期に発見"

# V07
[ -f "$CLIPS/v07_joined.mp4" ] && \
apply_telop "$CLIPS/v07_joined.mp4" "$WORK/10_v07.mp4" \
  "SCENE 04" "月次 1on1" \
  "目標があれば" "1on1の質が" "変わる" \
  "進捗とコンディションから" "AIが質問を自動生成"

# V08 (1.5x)
[ -f "$CLIPS/v08_fast.mp4" ] && \
apply_telop "$CLIPS/v08_fast.mp4" "$WORK/12_v08.mp4" \
  "SCENE 05" "評価ウィザード" \
  "記録が積み重なれば" "評価に根拠が" "生まれる" \
  "1on1記録・目標進捗が" "自動集約される"

# V09
[ -f "$CLIPS/v09_joined.mp4" ] && \
apply_telop "$CLIPS/v09_joined.mp4" "$WORK/13_v09.mp4" \
  "SCENE 05" "評価ウィザード" \
  "記録が積み重なれば" "評価に根拠が" "生まれる" \
  "エビデンスに基づく" "評価ドラフトをAI生成"

# V10 loading
[ -f "$CLIPS/v10_loading.mp4" ] && \
apply_telop "$CLIPS/v10_loading.mp4" "$WORK/14a_v10.mp4" \
  "SCENE 06" "チームマトリクス" \
  "組織方針から始まった" "サイクルが、評価を経て" "次期方針へつながる" \
  "チーム全員の実施状況を" "一目で把握できる"

# V10 data
[ -f "$CLIPS/v10_data.mp4" ] && \
apply_telop "$CLIPS/v10_data.mp4" "$WORK/14b_v10.mp4" \
  "SCENE 06" "チームマトリクス" \
  "組織方針から始まった" "サイクルが、評価を経て" "次期方針へつながる" \
  "チーム全員の実施状況を" "一目で把握できる"

########################################
# Phase 5: 全シーン結合
########################################
echo ""
echo "Phase 5: 全シーン結合..."

cat > "$WORK/concat_list.txt" << EOF
file '$EDIT/e01_opening.mp4'
file '$WORK/02a_v01s4.mp4'
file '$WORK/02b_v01s5.mp4'
file '$WORK/02c_v01s6.mp4'
file '$EDIT/e02_connect_goal.mp4'
file '$WORK/04_v02.mp4'
file '$WORK/05_v03.mp4'
file '$WORK/06_v04.mp4'
file '$WORK/07_v05.mp4'
file '$WORK/07b_v05r.mp4'
file '$EDIT/e03_connect_oneonone.mp4'
file '$WORK/09_v06.mp4'
file '$WORK/10_v07.mp4'
file '$EDIT/e04_connect_review.mp4'
file '$WORK/12_v08.mp4'
file '$WORK/13_v09.mp4'
file '$WORK/14a_v10.mp4'
file '$WORK/14b_v10.mp4'
file '$EDIT/e05_cycle.mp4'
file '$EDIT/e06_closing_text.mp4'
file '$EDIT/e07_endcard.mp4'
EOF

OUTPUT="$EDIT/ktc_talenthub_demo_v2.mp4"
ffmpeg -y -f concat -safe 0 -i "$WORK/concat_list.txt" \
  $ENC "$OUTPUT" 2>&1 | tail -3

DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT")
echo ""
echo "============================================"
echo "出力: $OUTPUT"
echo "総尺: ${DURATION}s"
echo "============================================"
