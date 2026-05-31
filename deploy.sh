#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
#  HanLingua Deploy Script
#  Builds Docker images and provides deployment commands for:
#    1. Backend (FastAPI)    → Railway / Render / Docker
#    2. Whisper AI           → HuggingFace Spaces / Docker
#    3. Frontend (Static)    → Vercel
# ============================================================================

# ── Colors for output ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# ── Configuration ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_IMAGE="hanlingua-backend"
WHISPER_IMAGE="hanlingua-whisper"
BACKEND_PORT="${BACKEND_PORT:-8000}"
WHISPER_PORT="${WHISPER_PORT:-7860}"

# ── Functions ───────────────────────────────────────────────────────

build_backend() {
    print_header "Building Backend Docker Image"
    docker build -t "$BACKEND_IMAGE" -f Dockerfile .
    print_step "Backend image built: $BACKEND_IMAGE"
}

build_whisper() {
    print_header "Building Whisper API Docker Image"
    docker build -t "$WHISPER_IMAGE" -f hf-whisper-api/Dockerfile ./hf-whisper-api/
    print_step "Whisper image built: $WHISPER_IMAGE"
}

run_backend() {
    print_header "Starting Backend Container"

    # Stop existing container if running
    docker rm -f "$BACKEND_IMAGE" 2>/dev/null || true

    if [ ! -f .env ]; then
        print_warn "No .env file found! Create one from .env.example first."
        print_info "cp .env.example .env  # then fill in your Supabase credentials"
        exit 1
    fi

    docker run -d \
        --name "$BACKEND_IMAGE" \
        --env-file .env \
        -p "$BACKEND_PORT:8000" \
        --restart unless-stopped \
        "$BACKEND_IMAGE"

    print_step "Backend running at http://localhost:$BACKEND_PORT"
    print_step "API available at  http://localhost:$BACKEND_PORT/api/daily-content"
}

run_whisper() {
    print_header "Starting Whisper API Container"

    # Stop existing container if running
    docker rm -f "$WHISPER_IMAGE" 2>/dev/null || true

    # Check for GPU support
    GPU_FLAG=""
    if command -v nvidia-smi &> /dev/null; then
        GPU_FLAG="--gpus all"
        print_step "NVIDIA GPU detected — enabling GPU acceleration"
    else
        print_warn "No GPU detected — Whisper will run on CPU (slower)"
    fi

    docker run -d \
        --name "$WHISPER_IMAGE" \
        $GPU_FLAG \
        -p "$WHISPER_PORT:7860" \
        -e WHISPER_API_KEY="${WHISPER_API_KEY:-}" \
        --restart unless-stopped \
        "$WHISPER_IMAGE"

    print_step "Whisper API running at http://localhost:$WHISPER_PORT"
    print_step "Health check:        http://localhost:$WHISPER_PORT/"
}

stop_all() {
    print_header "Stopping All Containers"
    docker rm -f "$BACKEND_IMAGE" 2>/dev/null && print_step "Backend stopped" || print_info "Backend was not running"
    docker rm -f "$WHISPER_IMAGE" 2>/dev/null && print_step "Whisper stopped" || print_info "Whisper was not running"
}

show_status() {
    print_header "Container Status"
    echo ""
    docker ps --filter "name=hanlingua" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers running"
    echo ""
}

show_logs() {
    local container="${1:-$BACKEND_IMAGE}"
    docker logs -f "$container"
}

init_db() {
    print_header "Initializing Database (Supabase)"

    if [ ! -f .env ]; then
        print_warn "No .env file found! Create one from .env.example first."
        exit 1
    fi

    # Source the .env file to get DATABASE_URL
    set -a
    source .env
    set +a

    if [ -z "${DATABASE_URL:-}" ]; then
        print_warn "DATABASE_URL not set in .env"
        exit 1
    fi

    print_info "Running init_db.py against: ${DATABASE_URL%%@*}@..."
    docker run --rm \
        --env-file .env \
        "$BACKEND_IMAGE" \
        python backend/init_db.py

    print_step "Database initialized successfully!"
}

deploy_vercel() {
    print_header "Deploying Frontend to Vercel"

    if ! command -v vercel &> /dev/null; then
        print_warn "Vercel CLI not found. Install with: npm i -g vercel"
        exit 1
    fi

    cd frontend
    print_info "Deploying frontend/ directory to Vercel..."
    vercel --prod
    cd ..
    print_step "Frontend deployed to Vercel!"
}

deploy_railway() {
    print_header "Deploying Backend to Railway"

    if ! command -v railway &> /dev/null; then
        print_warn "Railway CLI not found. Install with: npm i -g @railway/cli"
        print_info "Then run: railway login && railway init && railway up"
        exit 1
    fi

    railway up
    print_step "Backend deployed to Railway!"
}

show_help() {
    print_header "HanLingua Deploy Script"
    echo ""
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo -e "${YELLOW}Docker Commands (Local):${NC}"
    echo "  build-backend      Build the backend Docker image"
    echo "  build-whisper      Build the Whisper API Docker image"
    echo "  build-all          Build both images"
    echo "  run-backend        Start backend container"
    echo "  run-whisper        Start Whisper API container"
    echo "  run-all            Start both containers"
    echo "  stop               Stop all containers"
    echo "  status             Show container status"
    echo "  logs [container]   Show container logs"
    echo "  init-db            Initialize Supabase database"
    echo ""
    echo -e "${YELLOW}Cloud Deploy Commands:${NC}"
    echo "  deploy-vercel      Deploy frontend to Vercel"
    echo "  deploy-railway     Deploy backend to Railway"
    echo ""
    echo -e "${YELLOW}Environment Variables:${NC}"
    echo "  BACKEND_PORT       Backend port (default: 8000)"
    echo "  WHISPER_PORT       Whisper API port (default: 7860)"
    echo "  WHISPER_API_KEY    API key for Whisper endpoint protection"
    echo ""
    echo -e "${YELLOW}Quick Start:${NC}"
    echo "  1. cp .env.example .env     # Fill in Supabase credentials"
    echo "  2. ./deploy.sh build-all    # Build Docker images"
    echo "  3. ./deploy.sh init-db      # Initialize database"
    echo "  4. ./deploy.sh run-all      # Start everything locally"
    echo ""
}

# ── Main ────────────────────────────────────────────────────────────

case "${1:-help}" in
    build-backend)   build_backend ;;
    build-whisper)   build_whisper ;;
    build-all)       build_backend; build_whisper ;;
    run-backend)     run_backend ;;
    run-whisper)     run_whisper ;;
    run-all)         run_backend; run_whisper ;;
    stop)            stop_all ;;
    status)          show_status ;;
    logs)            show_logs "${2:-}" ;;
    init-db)         init_db ;;
    deploy-vercel)   deploy_vercel ;;
    deploy-railway)  deploy_railway ;;
    help|--help|-h)  show_help ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
