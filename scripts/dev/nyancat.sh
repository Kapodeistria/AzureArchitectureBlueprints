#!/bin/bash

# Microsoft Copilot ASCII Animation
# A futuristic AI assistant animation with Microsoft Copilot branding

# Colors for digital effects and AI assistant
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

# Clear screen and hide cursor
clear
echo -e "\033[?25l"

# Get terminal width
COLS=$(tput cols 2>/dev/null || echo 80)

# Microsoft Copilot AI Assistant frames
COPILOT_FRAME1="
${BRIGHT_CYAN}    ◉ ◉    ${NC}
${BRIGHT_BLUE}   ╔═══╗   ${NC}
${BRIGHT_MAGENTA}   ║${BRIGHT_WHITE}AI${BRIGHT_MAGENTA}║   ${NC}
${BRIGHT_BLUE}   ╚═══╝   ${NC}
${BRIGHT_CYAN}  ▄█████▄  ${NC}"

COPILOT_FRAME2="
${BRIGHT_CYAN}    ◎ ◎    ${NC}
${BRIGHT_BLUE}   ╔═══╗   ${NC}
${BRIGHT_MAGENTA}   ║${BRIGHT_WHITE}AI${BRIGHT_MAGENTA}║   ${NC}
${BRIGHT_BLUE}   ╚═══╝   ${NC}
${BRIGHT_CYAN}  ▀█████▀  ${NC}"

# Microsoft Copilot logo
COPILOT_LOGO="
${BRIGHT_BLUE}🤖${BRIGHT_CYAN}✨${NC}
${BRIGHT_MAGENTA}AI${BRIGHT_BLUE}🔮${NC}"

# Function to draw digital data stream
draw_data_stream() {
    local length=$1
    local colors=("$BRIGHT_CYAN" "$BRIGHT_BLUE" "$BRIGHT_MAGENTA" "$BRIGHT_WHITE")
    local symbols=("▓" "▒" "░" "█" "⚡" "◈" "◉" "●")
    
    for ((i=0; i<length; i++)); do
        color_index=$((i % 4))
        symbol_index=$((i % 8))
        echo -ne "${colors[$color_index]}${symbols[$symbol_index]}${NC}"
    done
}

# Function to draw Microsoft Copilot AI trail
draw_copilot_trail() {
    local trail_length=$1
    
    # Microsoft Copilot branding
    echo -ne "${BRIGHT_BLUE}🤖 ${BRIGHT_CYAN}Copilot ${BRIGHT_MAGENTA}AI ${NC}"
    echo -ne "${BRIGHT_RED}██${BRIGHT_GREEN}██ ${BRIGHT_BLUE}██${BRIGHT_YELLOW}██ ${NC}"
    
    # Add AI-themed trailing pattern
    for ((i=0; i<trail_length; i++)); do
        case $((i % 10)) in
            0) echo -ne "${BRIGHT_CYAN}◉${NC}" ;;
            1) echo -ne "${BRIGHT_BLUE}◈${NC}" ;;  
            2) echo -ne "${BRIGHT_MAGENTA}⚡${NC}" ;;
            3) echo -ne "${BRIGHT_WHITE}✨${NC}" ;;
            4) echo -ne "${BRIGHT_CYAN}🔮${NC}" ;;
            5) echo -ne "${BRIGHT_BLUE}💎${NC}" ;;
            6) echo -ne "${BRIGHT_MAGENTA}⭐${NC}" ;;  
            7) echo -ne "${BRIGHT_WHITE}◆${NC}" ;;
            8) echo -ne "${BRIGHT_CYAN}▓${NC}" ;;
            9) echo -ne " " ;;
        esac
    done
}

# Animation loop (flying left with Microsoft Copilot AI trail)
animate() {
    local position=$((COLS - 50))  # Start from right
    local frame=1
    local direction=-1  # Flying left
    local data_stream_length=15
    local trail_length=8
    
    echo -e "${BOLD}${BRIGHT_CYAN}"
    echo "🏗️ Azure Architecture Blueprints 🏗️"
    echo -e "${NC}"
    echo ""
    
    for ((loop=0; loop<60; loop++)); do
        # Clear previous frame
        echo -e "\033[5A"
        
        # Calculate position (flying left, then restart from right)
        position=$((position + direction * 3))
        if ((position <= -20)); then
            position=$((COLS - 30))
        fi
        
        # Ensure position is not negative
        if ((position < 0)); then
            position=0
        fi
        
        # Print spaces for position
        printf "%*s" $position ""
        
        # Draw Microsoft Copilot trail FIRST (behind AI)
        draw_copilot_trail $trail_length
        echo ""
        
        # Move to AI assistant line and position
        printf "%*s" $((position + 30)) ""
        
        # Draw data stream behind AI assistant
        draw_data_stream $data_stream_length
        
        # Draw Copilot AI assistant (alternating frames)
        if ((frame == 1)); then
            echo -e "$COPILOT_FRAME1"
            frame=2
        else
            echo -e "$COPILOT_FRAME2"
            frame=1
        fi
        
        # Progress bar
        echo -ne "${BOLD}${BRIGHT_CYAN}Azure Blueprint Generator Loading: ${NC}"
        local progress=$((loop * 100 / 60))
        local bars=$((progress / 5))
        for ((i=0; i<bars; i++)); do
            echo -ne "${BRIGHT_MAGENTA}▓${NC}"
        done
        for ((i=bars; i<20; i++)); do
            echo -ne "${BRIGHT_BLUE}░${NC}"
        done
        echo -ne " ${progress}% ${BRIGHT_CYAN}🤖${NC}"
        echo ""
        
        # Delay for smooth animation
        sleep 0.15
    done
}

# Success message
show_success() {
    clear
    echo -e "${BOLD}${BRIGHT_CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                🏗️ BLUEPRINTS READY! 🏗️                 ║"
    echo "║                                                          ║"
    echo "║         Azure Architecture Blueprints Ready!            ║"
    echo "║                                                          ║"
    echo "║  Your Azure AI Foundry agents are deployed and ready    ║"
    echo "║  to generate professional blueprints! ✨               ║"
    echo "║                                                          ║"
    echo "║  Available commands:                                     ║"
    echo "║  • npm run quick        - Quick analysis                 ║"
    echo "║  • npm run deploy:agents - Deploy agents               ║"
    echo "║  • npm run delete       - Delete agents                 ║"
    echo "║  • npm run redeploy     - Redeploy agents              ║"
    echo "║                                                          ║"
    echo "║       Your blueprint generator is ready! 🚀             ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Azure Architecture Blueprints celebration
    echo -e "${BRIGHT_RED}██${BRIGHT_GREEN}██ ${BRIGHT_BLUE}██${BRIGHT_YELLOW}██ ${BRIGHT_CYAN}Azure ${BRIGHT_MAGENTA}Architecture ${BRIGHT_BLUE}Blueprints ${BRIGHT_GREEN}Ready!${NC}"
    echo ""
}

# Trap to restore cursor on exit
trap 'echo -e "\033[?25h"; exit' INT TERM EXIT

# Check if we should run animation or just show success
if [[ "$1" == "--quick" ]]; then
    show_success
else
    echo -e "${BOLD}${BRIGHT_CYAN}Starting Azure Architecture Blueprints Animation...${NC}"
    echo -e "${BRIGHT_MAGENTA}Press Ctrl+C to stop${NC}"
    echo ""
    sleep 1
    animate
    show_success
fi

# Restore cursor
echo -e "\033[?25h"