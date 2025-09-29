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

    # Microsoft logo (4-square flag)
    echo ""
    echo -e "        ${BRIGHT_RED}███${BRIGHT_GREEN}███${NC}         ${BOLD}${BRIGHT_CYAN}Azure Architecture Blueprints${NC}"
    echo -e "        ${BRIGHT_BLUE}███${BRIGHT_YELLOW}███${NC}         Running: ${BRIGHT_YELLOW}npm run ${command_name}${NC}"
    echo -e "        ${BRIGHT_MAGENTA}Microsoft${NC}"
    echo ""

    # Azure logo on right
    echo -e "                                                                ${BRIGHT_CYAN}     █████${NC}"
    echo -e "                                                                ${BRIGHT_CYAN}  ███${NC}   ${BRIGHT_BLUE}███${NC}"
    echo -e "                                                                ${BRIGHT_CYAN}███${NC}     ${BRIGHT_BLUE}███${NC}"
    echo -e "                                                                ${BRIGHT_CYAN}███████████${NC}"
    echo -e "                                                                ${BRIGHT_CYAN}███${NC}     ${BRIGHT_BLUE}███${NC}"
    echo -e "                                                                ${BRIGHT_CYAN}███${NC}     ${BRIGHT_BLUE}███${NC}"
    echo -e "                                                                   ${BRIGHT_BLUE}█████${NC}"
    echo ""

    # Progress animation
    for ((i=0; i<10; i++)); do
        echo -e "\033[1A"
        printf "        "
        for ((j=0; j<=i; j++)); do
            echo -ne "${BRIGHT_CYAN}█${NC}"
        done
        echo -ne " $((i * 10))%"
        echo ""
        sleep 0.3
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

    # Microsoft logo (multi-line) on left, Azure logo on right
    echo ""
    echo -e "${BRIGHT_RED}███${BRIGHT_GREEN}███${NC}    ${BRIGHT_CYAN}Azure Architecture Blueprints${NC}                           ${BRIGHT_CYAN}     █████${NC}"
    echo -e "${BRIGHT_BLUE}███${BRIGHT_YELLOW}███${NC}    ${BRIGHT_YELLOW}→${NC} ${BOLD}npm run ${command_name}${NC}                                    ${BRIGHT_CYAN}  ███${NC}   ${BRIGHT_BLUE}███${NC}"
    echo -e "${BRIGHT_MAGENTA}Microsoft${NC}                                                             ${BRIGHT_CYAN}███${NC}     ${BRIGHT_BLUE}███${NC}"
    echo ""
    echo -e "                                                                       ${BRIGHT_CYAN}███████████${NC}"
    echo -e "                                                                       ${BRIGHT_CYAN}███${NC}     ${BRIGHT_BLUE}███${NC}"
    echo -e "                                                                       ${BRIGHT_CYAN}███${NC}     ${BRIGHT_BLUE}███${NC}"
    echo -e "                                                                          ${BRIGHT_BLUE}█████${NC}"

    sleep 0.5
    echo ""
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
        ./scripts/dev/nyancat.sh
        exit 0
        ;;
    *)
        # Default micro animation
        micro_copilot "$1"
        ;;
esac

# Trap to restore cursor on exit
trap 'echo -e "\033[?25h"' EXIT