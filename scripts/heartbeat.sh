#!/bin/bash
# heartbeat.sh — posts local service status to Homebase every 2 min via LaunchAgent
# Orbit + n8n are the active systems. Windmill decommissioned.

HOMEBASE_URL="${HOMEBASE_URL:-https://homebase.sammii.dev}"
HOMEBASE_SECRET="${HOMEBASE_SECRET:-}"
LIVE_METRICS="${LIVE_METRICS:-/Users/sammii/.claude/projects/-Users-sammii-development/memory/live-metrics.md}"
SPELLCAST_API_URL="${SPELLCAST_API_URL:-https://api.spellcast.sammii.dev}"
SPELLCAST_CRON_SECRET="${SPELLCAST_CRON_SECRET:-}"

check() {
  local name=$1 url=$2
  if curl -sf --max-time 3 "$url" > /dev/null 2>&1; then
    echo "\"$name\":{\"status\":\"ok\"}"
  else
    echo "\"$name\":{\"status\":\"down\"}"
  fi
}

# Local Mac services only (cloud services like Orbit are checked via their public URLs)
n8n=$(check n8n http://localhost:5678/healthz)
brandApi=$(check brandApi http://localhost:9002/health)
whisper=$(check whisper http://localhost:9001/health)

# Docker containers (comma-separated name:status)
docker_status=$(docker ps --format '{{.Names}}:{{.Status}}' 2>/dev/null | tr '\n' ',' | sed 's/,$//')

# LaunchAgents (comma-separated label:pid)
agents=$(launchctl list 2>/dev/null | grep sammii | awk '{print $3":"$1}' | tr '\n' ',' | sed 's/,$//')

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Parse live-metrics.md for Lunary metrics (written daily at 07:00 by snapshot script)
metrics_field=""
if [ -f "$LIVE_METRICS" ]; then
  dau=$(grep -o '\*\*Product DAU\*\*: \*\*[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | grep -o '[0-9,]*' | tail -1 | tr -d ',')
  mau=$(grep -o '\*\*Product MAU\*\*: \*\*[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | grep -o '[0-9,]*' | tail -1 | tr -d ',')
  wau=$(grep -o '\*\*Product WAU\*\*: \*\*[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | grep -o '[0-9,]*' | tail -1 | tr -d ',')
  mrr=$(grep -o '\*\*MRR\*\*: \*\*£[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | grep -o '[0-9,]*' | tail -1 | tr -d ',')
  signups7d=$(grep -o '\*\*Signups (7d)\*\*: \*\*[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | grep -o '[0-9,]*' | tail -1 | tr -d ',')

  # Only include metrics field if we got at least one value
  if [ -n "$dau" ] || [ -n "$mau" ] || [ -n "$mrr" ]; then
    dau="${dau:-0}"
    mau="${mau:-0}"
    wau="${wau:-0}"
    mrr="${mrr:-0}"
    signups7d="${signups7d:-0}"

    # SEO 7d metrics from live-metrics.md (avoids Cloudflare blocking Hetzner server)
    seo_impressions=$(grep -o 'Total impressions: \*\*[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | head -1 | grep -o '[0-9,]*' | tr -d ',')
    seo_clicks=$(grep -o 'Total clicks: \*\*[0-9,]*\*\*' "$LIVE_METRICS" 2>/dev/null | head -1 | grep -o '[0-9,]*' | tr -d ',')
    seo_position=$(grep -o 'Average position: \*\*[0-9.]*\*\*' "$LIVE_METRICS" 2>/dev/null | head -1 | grep -o '[0-9.]*')
    seo_daily_avg=$(grep -o '\*\*[0-9,]*\*\* impressions/day' "$LIVE_METRICS" 2>/dev/null | head -1 | grep -o '[0-9,]*' | tr -d ',')
    seo_ctr_raw=$(grep -o 'Average CTR: \*\*[0-9.]*%\*\*' "$LIVE_METRICS" 2>/dev/null | head -1 | grep -o '[0-9.]*')
    seo_ctr=$(echo "${seo_ctr_raw:-0} / 100" | bc -l 2>/dev/null || echo "0")
    seo_impressions="${seo_impressions:-0}"
    seo_clicks="${seo_clicks:-0}"
    seo_position="${seo_position:-0}"
    seo_daily_avg="${seo_daily_avg:-0}"

    metrics_field=",\"metrics\":{\"dau\":${dau},\"mau\":${mau},\"wau\":${wau},\"mrr\":${mrr},\"signups7d\":${signups7d},\"seoImpressions7d\":${seo_impressions},\"seoClicks7d\":${seo_clicks},\"seoCtr7d\":${seo_ctr},\"seoPosition7d\":${seo_position},\"seoDailyAvg\":${seo_daily_avg}}"
  fi
fi

# Disk usage (Mac system disk)
disk_pct=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}' 2>/dev/null)
disk_used=$(df -h / | awk 'NR==2 {print $3}' 2>/dev/null)
disk_avail=$(df -h / | awk 'NR==2 {print $4}' 2>/dev/null)
disk_field=""
if [ -n "$disk_pct" ]; then
  disk_field=",\"disk\":{\"pct\":${disk_pct},\"used\":\"${disk_used}\",\"avail\":\"${disk_avail}\"}"
fi

# Open tasks from Claude memory (top 8 non-done)
TASKS_FILE="/Users/sammii/.claude/projects/-Users-sammii-development/memory/tasks.json"
tasks_field=""
if command -v python3 > /dev/null 2>&1 && [ -f "$TASKS_FILE" ]; then
  tasks_json=$(python3 - "$TASKS_FILE" <<'PYEOF'
import sys, json
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
    tasks = d.get("tasks", [])
    open_tasks = [
        {"id": t.get("id",""), "title": t.get("title","")[:80], "status": t.get("status","ready"), "project": t.get("project","")}
        for t in tasks
        if isinstance(t, dict) and t.get("status") not in ("done","completed","cancelled")
    ][:8]
    print(json.dumps(open_tasks))
except Exception:
    print("[]")
PYEOF
)
  if [ -n "$tasks_json" ] && [ "$tasks_json" != "[]" ] && [ "$tasks_json" != "null" ]; then
    tasks_field=",\"tasks\":${tasks_json}"
  fi
fi

payload="{\"ts\":\"${ts}\",\"services\":{${n8n},${brandApi},${whisper}},\"docker\":\"${docker_status}\",\"launchAgents\":\"${agents}\"${metrics_field}${disk_field}${tasks_field}}"

curl -sf -X POST "${HOMEBASE_URL}/api/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HOMEBASE_SECRET}" \
  -d "$payload" > /dev/null 2>&1

# --- Cast queue polling ---
# Check for pending cast jobs and trigger apply.sh locally for each one
cast_response=$(curl -sf --max-time 5 \
  -H "Authorization: Bearer ${HOMEBASE_SECRET}" \
  "${HOMEBASE_URL}/api/cast/queue" 2>/dev/null)

if [ -n "$cast_response" ]; then
  # Extract job ids, urls and company names using basic shell parsing
  # Requires jq if available, otherwise skip gracefully
  if command -v jq > /dev/null 2>&1; then
    echo "$cast_response" | jq -c '.jobs[]?' 2>/dev/null | while IFS= read -r job; do
      job_id=$(echo "$job" | jq -r '.id // empty')
      job_url=$(echo "$job" | jq -r '.url // empty')
      job_company=$(echo "$job" | jq -r '.company // empty')

      if [ -n "$job_id" ] && [ -n "$job_url" ]; then
        # Mark as running first to prevent duplicate picks
        curl -sf -X POST \
          -H "Authorization: Bearer ${HOMEBASE_SECRET}" \
          "${HOMEBASE_URL}/api/cast/queue/${job_id}/start" > /dev/null 2>&1

        # Trigger apply.sh locally in background
        if [ -f "$HOME/development/cast/apply.sh" ]; then
          if [ -n "$job_company" ]; then
            cd "$HOME/development/cast" && bash apply.sh "$job_url" "$job_company" --no-review > /tmp/cast-${job_id}.log 2>&1 &
          else
            cd "$HOME/development/cast" && bash apply.sh "$job_url" --no-review > /tmp/cast-${job_id}.log 2>&1 &
          fi
        fi
      fi
    done
  fi
fi

# --- Morning briefing push notification ---
# Only fires between 07:00 and 07:10 UTC to avoid duplicate sends
current_hour=$(date -u +%H)
current_min=$(date -u +%M)
if [ "$current_hour" = "07" ] && [ "$current_min" -lt 10 ]; then
  briefing_result=$(curl -sf --max-time 10 \
    -H "Authorization: Bearer ${HOMEBASE_SECRET}" \
    "${HOMEBASE_URL}/api/push/briefing" 2>&1)
  if [ $? -eq 0 ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [briefing-push] ok: ${briefing_result}" >> /tmp/briefing-push.log
  else
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [briefing-push] failed: ${briefing_result}" >> /tmp/briefing-push.log
  fi
fi

# --- Engagement opportunity push ---
# Runs every heartbeat — pushes when high-relevance (>0.7) unread engagement arrives
curl -sf "${HOMEBASE_URL}/api/push/engagement" \
  -H "Authorization: Bearer ${HOMEBASE_SECRET}" > /dev/null 2>&1

# --- Meta follower snapshot (daily at 06:00 UTC) ---
# Snapshots Instagram follower counts into Spellcast DB for +7d trend display
SPELLCAST_URL="${SPELLCAST_API_URL:-https://api.spellcast.sammii.dev}"
if [ "$current_hour" = "06" ] && [ "$current_min" -lt 10 ]; then
  curl -sf -X POST "${SPELLCAST_URL}/api/meta/sync" \
    -H "Authorization: Bearer ${SPELLCAST_CRON_SECRET:-}" > /dev/null 2>&1
fi

# --- Smart Docker prune (when disk > 85%) ---
# Only prunes unused images, never touches running containers or volumes
disk_pct=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}' 2>/dev/null)
if [ -n "$disk_pct" ] && [ "$disk_pct" -gt 85 ]; then
  docker image prune -af >> /tmp/docker-prune.log 2>&1
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [disk-prune] triggered at ${disk_pct}%" >> /tmp/docker-prune.log
fi
