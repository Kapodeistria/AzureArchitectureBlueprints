#!/bin/bash
# Service Bus Queue Health Check
# Usage: ./sb-health.sh [namespace] [queue-name]

set -e

NAMESPACE="${1:-${SERVICE_BUS_NAMESPACE}}"
QUEUE_NAME="${2:-casestudy-jobs}"
STATUS_QUEUE="${3:-casestudy-status}"

if [ -z "$NAMESPACE" ]; then
  echo "Error: Service Bus namespace required"
  echo "Usage: $0 <namespace> [job-queue-name] [status-queue-name]"
  echo "   or: SERVICE_BUS_NAMESPACE=<namespace> $0"
  exit 1
fi

echo "=== Service Bus Queue Health Check ==="
echo "Namespace: $NAMESPACE"
echo ""

check_queue() {
  local queue="$1"
  echo "Queue: $queue"

  DETAILS=$(az servicebus queue show \
    --namespace-name "$NAMESPACE" \
    --name "$queue" \
    --query "{active:countDetails.activeMessageCount, deadLetter:countDetails.deadLetterMessageCount, scheduled:countDetails.scheduledMessageCount, transfer:countDetails.transferMessageCount, size:sizeInBytes, maxSize:maxSizeInMegabytes}" \
    -o json 2>/dev/null)

  if [ $? -eq 0 ]; then
    echo "$DETAILS" | jq -r 'to_entries | .[] | "  \(.key): \(.value)"'

    ACTIVE=$(echo "$DETAILS" | jq -r '.active')
    DLQ=$(echo "$DETAILS" | jq -r '.deadLetter')

    if [ "$DLQ" -gt 0 ]; then
      echo "  ⚠️  WARNING: Dead letter queue has $DLQ messages"
    fi

    if [ "$ACTIVE" -gt 0 ]; then
      echo "  📬 $ACTIVE messages waiting to be processed"
    else
      echo "  ✅ Queue is empty"
    fi
  else
    echo "  ❌ Failed to retrieve queue details"
  fi
  echo ""
}

check_queue "$QUEUE_NAME"
check_queue "$STATUS_QUEUE"

echo "=== Summary ==="
echo "To watch queue in real-time:"
echo "  watch -n 5 \"$0 $NAMESPACE $QUEUE_NAME $STATUS_QUEUE\""
echo ""
echo "To peek messages:"
echo "  az servicebus queue message peek --namespace-name $NAMESPACE --queue-name $QUEUE_NAME --max-count 5"
echo ""
echo "To drain dead letter queue:"
echo "  az servicebus queue message receive --namespace-name $NAMESPACE --queue-name $QUEUE_NAME --receive-mode PeekLock"