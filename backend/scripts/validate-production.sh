#!/bin/bash

# ByteLecture Backend Production Validation Script
# This script validates that the production deployment is working correctly

set -e

echo "🔍 Validating ByteLecture Backend Production Deployment..."

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TIMEOUT=30

echo "📍 Testing endpoint: $BASE_URL"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test functions
test_endpoint() {
    local endpoint="$1"
    local expected_status="${2:-200}"
    local description="$3"
    
    echo -n "🧪 Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL$endpoint" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $response, expected $expected_status)"
        return 1
    fi
}

test_json_response() {
    local endpoint="$1"
    local json_key="$2"
    local description="$3"
    
    echo -n "🧪 Testing $description... "
    
    response=$(curl -s --max-time $TIMEOUT "$BASE_URL$endpoint" || echo '{}')
    
    if echo "$response" | grep -q "\"$json_key\""; then
        echo -e "${GREEN}✅ PASS${NC} (found '$json_key' in response)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (missing '$json_key' in response)"
        echo "   Response: $response"
        return 1
    fi
}

# System dependency checks
check_dependencies() {
    echo ""
    echo "🔧 Checking system dependencies..."
    
    local all_deps_ok=true
    
    # Check Node.js
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        echo -e "${GREEN}✅ Node.js${NC} $node_version"
    else
        echo -e "${RED}❌ Node.js not found${NC}"
        all_deps_ok=false
    fi
    
    # Check yt-dlp
    if command -v yt-dlp &> /dev/null; then
        ytdlp_version=$(yt-dlp --version)
        echo -e "${GREEN}✅ yt-dlp${NC} $ytdlp_version"
    else
        echo -e "${RED}❌ yt-dlp not found${NC}"
        all_deps_ok=false
    fi
    
    # Check ffmpeg
    if command -v ffmpeg &> /dev/null; then
        ffmpeg_version=$(ffmpeg -version | head -1 | cut -d' ' -f3)
        echo -e "${GREEN}✅ ffmpeg${NC} $ffmpeg_version"
    else
        echo -e "${RED}❌ ffmpeg not found${NC}"
        all_deps_ok=false
    fi
    
    if [ "$all_deps_ok" = false ]; then
        echo -e "${RED}❌ Some dependencies are missing. Audio processing may not work.${NC}"
        return 1
    fi
    
    return 0
}

# Main validation tests
run_api_tests() {
    echo ""
    echo "🌐 Running API endpoint tests..."
    
    local failed_tests=0
    
    # Basic health check
    test_endpoint "/api/health" "200" "Basic health check" || ((failed_tests++))
    
    # YouTube health check (audio processing)
    test_json_response "/api/youtube/health" "ytDlpAvailable" "YouTube/Audio processing health" || ((failed_tests++))
    
    # Auth endpoints (should return 401 without token)
    test_endpoint "/api/audio/transcribe" "401" "Audio transcribe endpoint (auth required)" || ((failed_tests++))
    test_endpoint "/api/youtube/process" "401" "YouTube process endpoint (auth required)" || ((failed_tests++))
    test_endpoint "/api/pdf/upload" "401" "PDF upload endpoint (auth required)" || ((failed_tests++))
    
    # Summary endpoints
    test_endpoint "/api/summary/health" "200" "Summary service health" || ((failed_tests++))
    
    return $failed_tests
}

# Environment validation
check_environment() {
    echo ""
    echo "⚙️ Checking environment configuration..."
    
    local env_issues=0
    
    # Check if .env exists
    if [ -f .env ]; then
        echo -e "${GREEN}✅ .env file found${NC}"
        
        # Check critical environment variables
        local required_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "OPENAI_API_KEY")
        
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" .env && ! grep -q "^${var}=your_" .env; then
                echo -e "${GREEN}✅ $var${NC} configured"
            else
                echo -e "${RED}❌ $var${NC} not configured or using placeholder value"
                ((env_issues++))
            fi
        done
        
        # Check optional but recommended variables
        local optional_vars=("YOUTUBE_API_KEY" "YT_CHUNK_MINUTES" "SUMMARY_MAX_TOKENS")
        
        for var in "${optional_vars[@]}"; do
            if grep -q "^${var}=" .env; then
                echo -e "${YELLOW}⚠️ $var${NC} configured (optional)"
            else
                echo -e "${YELLOW}⚠️ $var${NC} not configured (optional, will use defaults)"
            fi
        done
        
    else
        echo -e "${RED}❌ .env file not found${NC}"
        echo "   Create one by copying .env.production.example"
        ((env_issues++))
    fi
    
    return $env_issues
}

# Performance test
test_performance() {
    echo ""
    echo "⚡ Running basic performance test..."
    
    start_time=$(date +%s)
    
    # Test response time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$BASE_URL/api/health" || echo "999")
    
    end_time=$(date +%s)
    
    if (( $(echo "$response_time < 2.0" | bc -l) )); then
        echo -e "${GREEN}✅ Response time${NC}: ${response_time}s (good)"
    elif (( $(echo "$response_time < 5.0" | bc -l) )); then
        echo -e "${YELLOW}⚠️ Response time${NC}: ${response_time}s (acceptable)"
    else
        echo -e "${RED}❌ Response time${NC}: ${response_time}s (slow)"
    fi
}

# Disk space check
check_disk_space() {
    echo ""
    echo "💾 Checking disk space..."
    
    if [ -d "temp" ]; then
        temp_usage=$(du -sh temp 2>/dev/null | cut -f1 || echo "0")
        echo -e "${GREEN}✅ Temp directory${NC}: $temp_usage used"
    else
        echo -e "${YELLOW}⚠️ Temp directory${NC}: not found (will be created on first use)"
    fi
    
    # Check available space
    available_space=$(df -h . | awk 'NR==2{print $4}')
    echo -e "${GREEN}✅ Available space${NC}: $available_space"
}

# Main execution
main() {
    echo "🚀 ByteLecture Backend Production Validation"
    echo "=============================================="
    
    local total_issues=0
    
    # Run all checks
    check_dependencies || ((total_issues++))
    check_environment || ((total_issues += $?))
    run_api_tests || ((total_issues += $?))
    test_performance
    check_disk_space
    
    echo ""
    echo "=============================================="
    
    if [ $total_issues -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Production deployment is ready.${NC}"
        echo ""
        echo "📊 Next steps:"
        echo "   - Monitor logs: docker-compose logs -f (Docker) or pm2 logs (PM2)"
        echo "   - Test with a real video: POST /api/youtube/process"
        echo "   - Set up monitoring and alerts"
        echo "   - Configure backups for your database"
        exit 0
    else
        echo -e "${RED}❌ Found $total_issues issue(s). Please fix before going to production.${NC}"
        echo ""
        echo "🔧 Common fixes:"
        echo "   - Install missing dependencies: ./scripts/setup-production.sh"
        echo "   - Configure environment: cp .env.production.example .env"
        echo "   - Restart the application: docker-compose restart or pm2 restart"
        exit 1
    fi
}

# Check if bc is available for float comparison
if ! command -v bc &> /dev/null; then
    echo "Installing bc for numeric comparisons..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y bc
    elif command -v yum &> /dev/null; then
        sudo yum install -y bc
    fi
fi

# Run the validation
main "$@" 