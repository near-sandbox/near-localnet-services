#!/bin/bash
##############################################################################
# redeploy-contract.sh - Reusable contract redeployment utility for NEAR localnet
#
# Layer 2 (NEAR Services) utility for deleting and redeploying contracts.
# Designed to run on the NEAR Base EC2 instance via SSM.
#
# Usage:
#   ./redeploy-contract.sh --contract-id v1.signer.localnet --wasm /path/to/contract.wasm [options]
#
# Options:
#   --contract-id      Contract account ID to redeploy (required)
#   --wasm             Path to WASM file (required)
#   --parent-account   Parent account (default: derived from contract-id)
#   --master-account   Master account with funds (default: localnet)
#   --initial-balance  Initial balance in NEAR (default: 50)
#   --mpc-init         Initialize as MPC signer contract (fetches MPC node data)
#   --skip-delete      Skip deletion step (deploy to new account only)
#   --dry-run          Show what would be done without executing
#
# Examples:
#   # Redeploy MPC signer contract
#   ./redeploy-contract.sh --contract-id v1.signer.localnet --wasm ./v1.signer.wasm --mpc-init
#
#   # Redeploy any contract
#   ./redeploy-contract.sh --contract-id mycontract.localnet --wasm ./mycontract.wasm
#
# Prerequisites:
#   - near-cli-rs installed and configured
#   - AWS CLI with access to Secrets Manager and SSM Parameter Store
#   - jq for JSON parsing
#
# Author: NEAR Localnet Simulator Team
# Layer: 2 (NEAR Services)
##############################################################################

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
NEAR_RPC="${NEAR_RPC_URL:-http://127.0.0.1:3030}"
AWS_REGION="${AWS_REGION:-us-east-1}"
MASTER_ACCOUNT="${MASTER_ACCOUNT:-localnet}"
INITIAL_BALANCE="${INITIAL_BALANCE:-50}"
MPC_STACK_NAME="${MPC_STACK_NAME:-MpcStandaloneStack}"
MPC_NODE_COUNT="${MPC_NODE_COUNT:-3}"
THRESHOLD="${THRESHOLD:-2}"

# Script state
CONTRACT_ID=""
WASM_PATH=""
PARENT_ACCOUNT=""
MPC_INIT=false
SKIP_DELETE=false
DRY_RUN=false

# ─── Parse Arguments ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --contract-id)
      CONTRACT_ID="$2"
      shift 2
      ;;
    --wasm)
      WASM_PATH="$2"
      shift 2
      ;;
    --parent-account)
      PARENT_ACCOUNT="$2"
      shift 2
      ;;
    --master-account)
      MASTER_ACCOUNT="$2"
      shift 2
      ;;
    --initial-balance)
      INITIAL_BALANCE="$2"
      shift 2
      ;;
    --mpc-init)
      MPC_INIT=true
      shift
      ;;
    --skip-delete)
      SKIP_DELETE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      head -50 "$0" | tail -45
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ─── Validation ──────────────────────────────────────────────────────────────
if [[ -z "$CONTRACT_ID" ]]; then
  echo "ERROR: --contract-id is required"
  exit 1
fi

if [[ -z "$WASM_PATH" ]]; then
  echo "ERROR: --wasm is required"
  exit 1
fi

if [[ ! -f "$WASM_PATH" ]]; then
  echo "ERROR: WASM file not found: $WASM_PATH"
  exit 1
fi

# Derive parent account if not specified (e.g., v1.signer.localnet -> signer.localnet)
if [[ -z "$PARENT_ACCOUNT" ]]; then
  # Remove first segment to get parent
  PARENT_ACCOUNT="${CONTRACT_ID#*.}"
  if [[ "$PARENT_ACCOUNT" == "$CONTRACT_ID" ]]; then
    PARENT_ACCOUNT="$MASTER_ACCOUNT"
  fi
fi

# ─── Helper Functions ────────────────────────────────────────────────────────

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

run_cmd() {
  if $DRY_RUN; then
    echo "[DRY-RUN] Would execute: $*"
  else
    log "Executing: $*"
    "$@"
  fi
}

# Get SSM parameter value
get_ssm_param() {
  local name="$1"
  aws ssm get-parameter --name "$name" --with-decryption --region "$AWS_REGION" \
    --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

# Check if account exists
account_exists() {
  local account_id="$1"
  local result
  result=$(curl -s -X POST "$NEAR_RPC" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$account_id\"},\"id\":\"1\"}")
  
  if echo "$result" | grep -q '"amount"'; then
    return 0
  else
    return 1
  fi
}

# Get MPC node data dynamically from CloudFormation and /public_data endpoints
get_mpc_node_data() {
  local node_index="$1"
  local ip account_id sign_pk
  
  # Get IP from CloudFormation
  ip=$(aws cloudformation describe-stacks --stack-name "$MPC_STACK_NAME" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'Node${node_index}PrivateIp')].OutputValue" --output text 2>/dev/null)
  
  # Get account ID from CloudFormation
  account_id=$(aws cloudformation describe-stacks --stack-name "$MPC_STACK_NAME" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?contains(OutputKey,'Node${node_index}AccountId')].OutputValue" --output text 2>/dev/null)
  
  # Fallback account ID if not in outputs
  if [[ -z "$account_id" || "$account_id" == "None" ]]; then
    account_id="mpc-node-${node_index}.localnet"
  fi
  
  # Get sign_pk from running MPC node
  sign_pk=$(curl -s --connect-timeout 5 "http://${ip}:8080/public_data" 2>/dev/null | jq -r '.near_signer_public_key // empty')
  
  if [[ -z "$sign_pk" ]]; then
    log "WARNING: Could not fetch sign_pk for node $node_index at $ip"
  fi
  
  echo "$ip|$account_id|$sign_pk"
}

# ─── Main Script ─────────────────────────────────────────────────────────────

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║  Contract Redeployment Utility - Layer 2 (NEAR Services)               ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
log "Configuration:"
echo "  Contract ID:     $CONTRACT_ID"
echo "  WASM Path:       $WASM_PATH"
echo "  Parent Account:  $PARENT_ACCOUNT"
echo "  Master Account:  $MASTER_ACCOUNT"
echo "  Initial Balance: $INITIAL_BALANCE NEAR"
echo "  MPC Init:        $MPC_INIT"
echo "  Skip Delete:     $SKIP_DELETE"
echo "  Dry Run:         $DRY_RUN"
echo ""

# Get master account private key from SSM
log "Fetching master account key from SSM..."
MASTER_KEY=$(get_ssm_param "/near-localnet/localnet-account-key")
if [[ -z "$MASTER_KEY" ]]; then
  echo "ERROR: Master account key not found in SSM: /near-localnet/localnet-account-key"
  exit 1
fi
log "✅ Master account key retrieved"

# ─── Step 1: Delete existing contract (if exists and not skipped) ────────────
if ! $SKIP_DELETE; then
  log "Step 1: Checking if contract account exists..."
  if account_exists "$CONTRACT_ID"; then
    log "Contract $CONTRACT_ID exists. Deleting..."
    run_cmd near account delete-account "$CONTRACT_ID" \
      beneficiary "$PARENT_ACCOUNT" \
      network-config custom \
      rpc-url "$NEAR_RPC" \
      sign-with-plaintext-private-key "$MASTER_KEY" \
      send
    log "✅ Contract deleted"
    sleep 2
  else
    log "Contract $CONTRACT_ID does not exist. Skipping delete."
  fi
else
  log "Step 1: Skipping delete (--skip-delete specified)"
fi

# ─── Step 2: Ensure parent account exists and has funds ──────────────────────
log "Step 2: Checking parent account $PARENT_ACCOUNT..."
if ! account_exists "$PARENT_ACCOUNT"; then
  log "Creating parent account $PARENT_ACCOUNT..."
  run_cmd near account create-account "$PARENT_ACCOUNT" \
    fund-myself "$MASTER_ACCOUNT" '100 NEAR' \
    network-config custom \
    rpc-url "$NEAR_RPC" \
    sign-with-plaintext-private-key "$MASTER_KEY" \
    send
  log "✅ Parent account created"
  sleep 2
else
  log "✅ Parent account exists"
fi

# ─── Step 3: Create contract account ─────────────────────────────────────────
log "Step 3: Creating contract account $CONTRACT_ID..."
run_cmd near account create-account "$CONTRACT_ID" \
  fund-myself "$PARENT_ACCOUNT" "${INITIAL_BALANCE} NEAR" \
  network-config custom \
  rpc-url "$NEAR_RPC" \
  sign-with-plaintext-private-key "$MASTER_KEY" \
  send
log "✅ Contract account created"
sleep 2

# ─── Step 4: Deploy WASM ─────────────────────────────────────────────────────
log "Step 4: Deploying WASM to $CONTRACT_ID..."
run_cmd near contract deploy "$CONTRACT_ID" \
  use-file "$WASM_PATH" \
  without-init-call \
  network-config custom \
  rpc-url "$NEAR_RPC" \
  sign-with-plaintext-private-key "$MASTER_KEY" \
  send
log "✅ WASM deployed"
sleep 2

# ─── Step 5: Initialize contract ─────────────────────────────────────────────
if $MPC_INIT; then
  log "Step 5: Initializing MPC signer contract..."
  
  # Fetch current MPC node data
  log "Fetching current MPC node data..."
  PARTICIPANTS_JSON="[]"
  
  for i in $(seq 0 $((MPC_NODE_COUNT-1))); do
    NODE_DATA=$(get_mpc_node_data $i)
    NODE_IP=$(echo "$NODE_DATA" | cut -d'|' -f1)
    NODE_ACCOUNT=$(echo "$NODE_DATA" | cut -d'|' -f2)
    NODE_SIGN_PK=$(echo "$NODE_DATA" | cut -d'|' -f3)
    
    log "  Node $i: IP=$NODE_IP, Account=$NODE_ACCOUNT, sign_pk=${NODE_SIGN_PK:0:20}..."
    
    if [[ -z "$NODE_SIGN_PK" ]]; then
      echo "ERROR: Could not get sign_pk for MPC node $i. Is the node running?"
      exit 1
    fi
    
    PARTICIPANT=$(jq -n \
      --arg account "$NODE_ACCOUNT" \
      --arg url "http://${NODE_IP}:8080" \
      --arg sign_pk "$NODE_SIGN_PK" \
      '[$account, ($ARGS.positional[0] | tonumber), {"url": $url, "sign_pk": $sign_pk}]' \
      --args "$i")
    
    PARTICIPANTS_JSON=$(echo "$PARTICIPANTS_JSON" | jq ". + [$PARTICIPANT]")
  done
  
  # Build init args
  INIT_ARGS=$(jq -n \
    --argjson participants "$PARTICIPANTS_JSON" \
    --argjson threshold "$THRESHOLD" \
    --argjson next_id "$MPC_NODE_COUNT" \
    '{
      "participants": {
        "next_id": $next_id,
        "participants": $participants
      },
      "threshold": $threshold
    }')
  
  log "Init args: $(echo "$INIT_ARGS" | jq -c .)"
  
  run_cmd near contract call-function as-transaction "$CONTRACT_ID" init \
    json-args "$INIT_ARGS" \
    prepaid-gas '100.0 Tgas' \
    attached-deposit '0 NEAR' \
    sign-as "$CONTRACT_ID" \
    network-config custom \
    rpc-url "$NEAR_RPC" \
    sign-with-plaintext-private-key "$MASTER_KEY" \
    send
  
  log "✅ MPC contract initialized"
  sleep 2
  
  # ─── Step 6: Vote to add domain 0 (Secp256k1) ────────────────────────────────
  log "Step 6: Voting to add domain 0 (Secp256k1)..."
  
  DOMAIN_ARGS='{"domains": [{"id": 0, "scheme": "Secp256k1"}]}'
  
  for i in $(seq 0 $((MPC_NODE_COUNT-1))); do
    MPC_ACCOUNT="mpc-node-${i}.localnet"
    log "  MPC node $i ($MPC_ACCOUNT) voting..."
    
    # Get MPC node's private key from SSM
    MPC_KEY=$(get_ssm_param "/near-localnet/mpc-node-${i}-account-sk")
    if [[ -z "$MPC_KEY" ]]; then
      log "WARNING: MPC node $i key not in SSM, trying Secrets Manager..."
      MPC_KEY=$(aws secretsmanager get-secret-value \
        --secret-id "mpc-node-${i}-mpc_account_sk" \
        --region "$AWS_REGION" \
        --query "SecretString" --output text 2>/dev/null || echo "")
    fi
    
    if [[ -z "$MPC_KEY" ]]; then
      echo "ERROR: Could not get private key for MPC node $i"
      exit 1
    fi
    
    run_cmd near contract call-function as-transaction "$CONTRACT_ID" vote_add_domains \
      json-args "$DOMAIN_ARGS" \
      prepaid-gas '100.0 Tgas' \
      attached-deposit '0 NEAR' \
      sign-as "$MPC_ACCOUNT" \
      network-config custom \
      rpc-url "$NEAR_RPC" \
      sign-with-plaintext-private-key "$MPC_KEY" \
      send
    
    log "  ✅ Node $i voted"
    sleep 1
  done
  
  log "✅ All MPC nodes voted to add domain 0"
else
  log "Step 5: Skipping MPC initialization (use --mpc-init to enable)"
fi

# ─── Step 7: Verify contract state ───────────────────────────────────────────
log "Step 7: Verifying contract state..."
sleep 3

RESULT=$(curl -s -X POST "$NEAR_RPC" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"query\",\"params\":{\"request_type\":\"call_function\",\"finality\":\"final\",\"account_id\":\"$CONTRACT_ID\",\"method_name\":\"state\",\"args_base64\":\"e30=\"},\"id\":\"1\"}")

if echo "$RESULT" | grep -q '"result"'; then
  STATE=$(echo "$RESULT" | jq -r '.result.result' | python3 -c "import sys; data=[int(x) for x in sys.stdin.read().strip()[1:-1].split(',')]; print(''.join(chr(b) for b in data))" 2>/dev/null || echo "")
  
  if [[ -n "$STATE" ]]; then
    log "Contract state:"
    echo "$STATE" | python3 -m json.tool 2>/dev/null || echo "$STATE"
    
    if echo "$STATE" | grep -q '"Running"'; then
      log "✅ Contract is in RUNNING state - ready for signing!"
    elif echo "$STATE" | grep -q '"Initializing"'; then
      log "⏳ Contract is INITIALIZING - waiting for key generation..."
      log "   Key generation typically takes ~10 minutes."
    else
      log "⚠️  Contract in unexpected state. Check logs."
    fi
  else
    log "Could not parse contract state"
  fi
else
  log "Could not query contract state: $RESULT"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║  Contract Redeployment Complete!                                       ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
log "Next steps:"
echo "  1. Monitor MPC node logs: docker logs mpc-node --tail 20"
echo "  2. Check contract state: near contract call-function ... state"
echo "  3. Once Running, test signing with test-parity.ts"
