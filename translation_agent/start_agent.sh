#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LiveKit Translation Agent (Upgraded)  ${NC}"
echo -e "${BLUE}  Using GPT Realtime + GPT-4o          ${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check if running in dev or production mode
MODE=${1:-dev}

if [ "$MODE" == "dev" ]; then
    echo -e "${YELLOW}Starting in DEVELOPMENT mode...${NC}"
    echo -e "${GREEN}Agent will connect to: $(grep LIVEKIT_URL .env | cut -d'=' -f2)${NC}"
    echo
    echo -e "${GREEN}Features:${NC}"
    echo "  • Real-time STT with GPT Realtime API"
    echo "  • Integrated VAD and punctuation"
    echo "  • High-quality translation with GPT-4o"
    echo "  • Performance monitoring"
    echo "  • 10 supported languages"
    echo
    echo -e "${YELLOW}Starting agent...${NC}"
    python main.py dev
elif [ "$MODE" == "start" ] || [ "$MODE" == "production" ]; then
    echo -e "${RED}Starting in PRODUCTION mode...${NC}"
    echo -e "${GREEN}Agent will connect to: $(grep LIVEKIT_URL .env | cut -d'=' -f2)${NC}"
    echo
    echo -e "${YELLOW}Starting agent...${NC}"
    python main.py start
else
    echo -e "${RED}Usage: ./start_agent.sh [dev|start|production]${NC}"
    echo "  dev        - Development mode (default)"
    echo "  start      - Production mode"
    echo "  production - Production mode (alias)"
    exit 1
fi