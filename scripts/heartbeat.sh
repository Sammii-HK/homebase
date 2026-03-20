#!/bin/bash
# heartbeat.sh — posts local service status to Homebase every 2 min via LaunchAgent
# Orbit + n8n are the active systems. Windmill decommissioned.

HOMEBASE_URL="${HOMEBASE_URL:-https://homebase.sammii.dev}"
HOMEBASE_SECRET="${HOMEBASE_SECRET:-}"

check() {
  local name=$1 url=$2
  if curl -sf --max-time 3 "$url" > /dev/null 2>&1; then
    echo "\"$name\":{\"status\":\"ok\"}"
  else
    echo "\"$name\":{\"status\":\"down\"}"
  fi
}

# Active local services
orbit=$(check orbit http://localhost:3001/health)
n8n=$(check n8n http://localhost:5678/healthz)
brandApi=$(check brandApi http://localhost:3020/health)
whisper=$(check whisper http://localhost:9000/health)

# Docker containers (comma-separated name:status)
docker_status=$(docker ps --format '{{.Names}}:{{.Status}}' 2>/dev/null | tr '\n' ',' | sed 's/,$//')

# LaunchAgents (comma-separated label:pid)
agents=$(launchctl list 2>/dev/null | grep sammii | awk '{print $3":"$1}' | tr '\n' ',' | sed 's/,$//')

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)

payload="{\"ts\":\"${ts}\",\"services\":{${orbit},${n8n},${brandApi},${whisper}},\"docker\":\"${docker_status}\",\"launchAgents\":\"${agents}\"}"

curl -sf -X POST "${HOMEBASE_URL}/api/heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${HOMEBASE_SECRET}" \
  -d "$payload" > /dev/null 2>&1
