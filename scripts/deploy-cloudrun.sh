#!/usr/bin/env bash
set -euo pipefail

# Deploy this app to Google Cloud Run using Cloud Build.
# Prerequisites:
#  - gcloud CLI installed and authenticated
#  - Cloud Run and Cloud Build APIs enabled
#  - If using GCS, ensure a suitable service account has storage access

SERVICE_NAME="share-paste"
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

# If you have an env file `.env.deploy`, pass it to Cloud Run
if [[ -f ".env.deploy" ]]; then
  echo "Using environment variables from .env.deploy"
  DEPLOY_ARGS+=( --env-vars-file=.env.deploy )
fi

echo "Deploying service: ${SERVICE_NAME} to region ${REGION}"
gcloud run deploy "${SERVICE_NAME}" "${DEPLOY_ARGS[@]}"

echo "Deployment complete. You can fetch the URL with: gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'"

