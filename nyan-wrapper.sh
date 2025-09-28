#!/bin/bash

# Microsoft Copilot Wrapper for NPM Commands
# Adds Microsoft Copilot AI animation before executing npm commands

# Colors
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
MAGENTA='\033[35m'
CYAN='\033[36m'
WHITE='\033[37m'
BRIGHT_RED='\033[91m'
BRIGHT_GREEN='\033[92m'
BRIGHT_YELLOW='\033[93m'
BRIGHT_BLUE='\033[94m'
BRIGHT_MAGENTA='\033[95m'
BRIGHT_CYAN='\033[96m'
NC='\033[0m'
BOLD='\033[1m'

# Get terminal dimensions
COLS=$(tput cols 2>/dev/null || echo 80)
ROWS=$(tput lines 2>/dev/null || echo 24)

# Quick copilot animation (3 seconds)
quick_copilot() {
    local command_name=$1
    
    # Clear screen and hide cursor
    clear
    echo -e "\033[?25l"
    
    echo -e "${BOLD}${BRIGHT_CYAN}🏗️ Azure Architecture Blueprints${NC}"
    echo -e "${BRIGHT_CYAN}Running: ${BRIGHT_YELLOW}npm run ${command_name}${NC}"
    echo ""
    
    # Quick animation (15 frames, ~3 seconds)
    for ((i=0; i<15; i++)); do
        local pos=$((COLS - 40 - i * 3))
        if ((pos < 0)); then pos=0; fi
        
        # Clear animation area
        echo -e "\033[3A"
        
        # Microsoft flag trail
        printf "%*s" $pos ""
        echo -e "${BRIGHT_RED}██${BRIGHT_GREEN}██ ${BRIGHT_BLUE}██${BRIGHT_YELLOW}██ ${BRIGHT_CYAN}Microsoft${NC}"
        
        # Copilot AI with data stream
        printf "%*s" $((pos + 15)) ""
        # Rainbow trail
        echo -ne "${BRIGHT_RED}█${BRIGHT_YELLOW}█${BRIGHT_GREEN}█${BRIGHT_CYAN}█${BRIGHT_BLUE}█${BRIGHT_MAGENTA}█ ${NC}"
        # AI Assistant
        if ((i % 2 == 0)); then
            echo -e "${BRIGHT_CYAN}◉ ◉ ${BRIGHT_BLUE}╔═══╗ ${BRIGHT_MAGENTA}║${BRIGHT_WHITE}AI${BRIGHT_MAGENTA}║ ${BRIGHT_BLUE}╚═══╝${NC}"
        else
            echo -e "${BRIGHT_CYAN}◎ ◎ ${BRIGHT_BLUE}╔═══╗ ${BRIGHT_MAGENTA}║${BRIGHT_WHITE}AI${BRIGHT_MAGENTA}║ ${BRIGHT_BLUE}╚═══╝${NC}"
        fi
        
        # Progress
        printf "%*s" $pos ""
        echo -e "${BRIGHT_MAGENTA}🏗️ Loading Azure Blueprint tools... $((i * 100 / 15))%${NC}"
        
        sleep 0.2
    done
    
    # Final success message
    echo ""
    echo -e "${BOLD}${BRIGHT_GREEN}✅ Ready! Executing ${BRIGHT_YELLOW}npm run ${command_name}${NC}${BOLD}${BRIGHT_GREEN}...${NC}"
    echo -e "${BRIGHT_CYAN}─────────────────────────────────────────${NC}"
    echo ""
    
    # Restore cursor
    echo -e "\033[?25h"
    sleep 0.5
}

# Micro copilot (1 second) for quick commands
micro_copilot() {
    local command_name=$1
    
    echo -e "${BRIGHT_CYAN}🏗️${NC} ${BRIGHT_MAGENTA}Azure Architecture Blueprints${NC} ${BRIGHT_YELLOW}→${NC} ${BOLD}npm run ${command_name}${NC}"
    
    # Single frame animation
    echo -ne "${BRIGHT_RED}██${BRIGHT_GREEN}██${BRIGHT_BLUE}██${BRIGHT_YELLOW}██${NC} "
    echo -ne "${BRIGHT_RED}█${BRIGHT_YELLOW}█${BRIGHT_GREEN}█${BRIGHT_CYAN}█${BRIGHT_BLUE}█${NC} "
    echo -e "${BRIGHT_CYAN}◎ ◎ ${BRIGHT_BLUE}║${BRIGHT_WHITE}AI${BRIGHT_BLUE}║${NC} ${BRIGHT_MAGENTA}🤖 Loading...${NC}"
    
    sleep 0.5
    echo -e "${BRIGHT_GREEN}✅ Ready!${NC}"
    echo ""
}

# Choose animation based on command
case "$1" in
    "quick"|"analyze"|"interactive")
        micro_copilot "$1"
        ;;
    "deploy:agents"|"deploy:foundry"|"deploy:simple"|"redeploy")
        quick_copilot "$1"
        ;;
    "test"|"status"|"config:validate")
        micro_copilot "$1"
        ;;
    "copilot"|"assistant"|"ai"|"ready")
        # Full animation
        ./nyancat.sh
        exit 0
        ;;
    *)
        # Default micro animation
        micro_copilot "$1"
        ;;
esac

# Trap to restore cursor on exit
trap 'echo -e "\033[?25h"' EXIT