#!/usr/bin/env bash
set -euo pipefail

# Deploy this app to Google Cloud Run using Cloud Build.
# Prerequisites:
#  - gcloud CLI installed and authenticated
#  - Cloud Run and Cloud Build APIs enabled
#  - If using GCS, ensure a suitable service account has storage access

SERVICE_NAME="sharepaste"
REGION="us-central1"
IMAGE_TAG="gcr.io/share-board-474109/${SERVICE_NAME}:$(date +%Y%m%d-%H%M%S)"

echo "Building image: ${IMAGE_TAG}"
gcloud builds submit --tag "${IMAGE_TAG}" .

DEPLOY_ARGS=(
  --platform=managed
  --region="${REGION}"
  --allow-unauthenticated
  --image="${IMAGE_TAG}"
  --set-env-vars=NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1
)

# If you have an env file `.env.deploy`, support YAML or dotenv
if [[ -f ".env.deploy" ]]; then
  echo "Found .env.deploy; attempting to load environment variables"
  if grep -Eq '^[A-Za-z_][A-Za-z0-9_]*\s*:' .env.deploy; then
    echo "Detected YAML map format; passing via --env-vars-file"
    DEPLOY_ARGS+=( --env-vars-file=.env.deploy )
  else
    echo "Detected dotenv (KEY=VALUE) format; converting to --set-env-vars"
    # Build a comma-separated list of KEY=VALUE ignoring comments and blanks
    ENV_VARS=$(awk -F'=' 'BEGIN{OFS="="} /^[[:space:]]*#/ {next} /^[[:space:]]*$/ {next} {key=$1; sub(/^[[:space:]]+|[[:space:]]+$/,"",key); $1=""; val=$0; sub(/^=/,"",val); sub(/^[[:space:]]+|[[:space:]]+$/,"",val); gsub(/,/ ,"\\,", val); printf("%s=%s,", key, val)}' .env.deploy | sed 's/,$//')
    if [[ -n "${ENV_VARS}" ]]; then
      DEPLOY_ARGS+=( --set-env-vars "${ENV_VARS}" )
    else
      echo "Warning: .env.deploy parsed to empty env var list; skipping."
    fi
  fi
fi

echo "Deploying service: ${SERVICE_NAME} to region ${REGION}"
gcloud run deploy "${SERVICE_NAME}" "${DEPLOY_ARGS[@]}"

echo "Deployment complete. You can fetch the URL with: gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'"
