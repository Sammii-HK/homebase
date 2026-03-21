#!/bin/bash
# heartbeat.sh — posts local service status to Homebase every 2 min via LaunchAgent
# Orbit + n8n are the active systems. Windmill decommissioned.

HOMEBASE_URL="${HOMEBASE_URL:-https://homebase.sammii.dev}"
HOMEBASE_SECRET="${HOMEBASE_SECRET:-}"
LIVE_METRICS="${LIVE_METRICS:-/Users/sammii/.claude/projects/-Users-sammii-development/memory/live-metrics.md}"

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
whisper=$(check whisper http://localhost:9000/health)

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
    metrics_field=",\"metrics\":{\"dau\":${dau},\"mau\":${mau},\"wau\":${wau},\"mrr\":${mrr},\"signups7d\":${signups7d}}"
  fi
fi

payload="{\"ts\":\"${ts}\",\"services\":{${n8n},${brandApi},${whisper}},\"docker\":\"${docker_status}\",\"launchAgents\":\"${agents}\"${metrics_field}}"

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
