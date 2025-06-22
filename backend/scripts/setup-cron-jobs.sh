#!/bin/bash

# ByteLecture - Setup Cron Jobs for Usage Reset
# This script helps set up automated daily usage reset

echo "🔧 ByteLecture - Setting up automated usage reset cron jobs"
echo "=================================================="

# Check if required environment variables are set
if [ -z "$CRON_SECRET_TOKEN" ]; then
    echo "❌ ERROR: CRON_SECRET_TOKEN environment variable is not set"
    echo "Please set a secure token for cron job authentication:"
    echo "export CRON_SECRET_TOKEN='your-secure-random-token-here'"
    exit 1
fi

if [ -z "$API_BASE_URL" ]; then
    echo "❌ ERROR: API_BASE_URL environment variable is not set"
    echo "Please set your API base URL:"
    echo "export API_BASE_URL='https://your-api-domain.com'"
    exit 1
fi

echo "✅ Environment variables configured"
echo "API Base URL: $API_BASE_URL"
echo "Cron Token: ${CRON_SECRET_TOKEN:0:8}..."

# Create cron job entries
DAILY_RESET_JOB="0 0 * * * curl -X POST -H \"Authorization: Bearer $CRON_SECRET_TOKEN\" \"$API_BASE_URL/api/cron/reset-daily-usage\" >> /var/log/bytelecture-cron.log 2>&1"
WEEKLY_CLEANUP_JOB="0 2 * * 0 curl -X POST -H \"Authorization: Bearer $CRON_SECRET_TOKEN\" \"$API_BASE_URL/api/cron/cleanup-error-logs\" >> /var/log/bytelecture-cron.log 2>&1"

echo ""
echo "📅 Recommended Cron Jobs:"
echo "========================"
echo ""
echo "1. Daily Usage Reset (runs at midnight every day):"
echo "$DAILY_RESET_JOB"
echo ""
echo "2. Weekly Error Log Cleanup (runs at 2 AM every Sunday):"
echo "$WEEKLY_CLEANUP_JOB"
echo ""

# Offer to add to crontab
read -p "Do you want to add these cron jobs to your system crontab? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Adding cron jobs to system crontab..."
    
    # Create temporary cron file
    TEMP_CRON=$(mktemp)
    
    # Get existing crontab
    crontab -l 2>/dev/null > "$TEMP_CRON" || true
    
    # Add our cron jobs
    echo "" >> "$TEMP_CRON"
    echo "# ByteLecture - Daily usage reset (midnight)" >> "$TEMP_CRON"
    echo "$DAILY_RESET_JOB" >> "$TEMP_CRON"
    echo "" >> "$TEMP_CRON"
    echo "# ByteLecture - Weekly error log cleanup (Sunday 2 AM)" >> "$TEMP_CRON"
    echo "$WEEKLY_CLEANUP_JOB" >> "$TEMP_CRON"
    
    # Install new crontab
    crontab "$TEMP_CRON"
    
    # Clean up
    rm "$TEMP_CRON"
    
    echo "✅ Cron jobs added successfully!"
    echo ""
    echo "📋 Current crontab:"
    crontab -l
else
    echo "⏭️  Skipping crontab installation."
    echo "You can manually add these jobs later using 'crontab -e'"
fi

echo ""
echo "📝 Additional Setup Notes:"
echo "=========================="
echo "1. Ensure your API server is running and accessible"
echo "2. Create log directory: sudo mkdir -p /var/log && sudo touch /var/log/bytelecture-cron.log"
echo "3. Set proper permissions: sudo chmod 664 /var/log/bytelecture-cron.log"
echo "4. Test the endpoints manually first:"
echo "   curl -X POST -H \"Authorization: Bearer \$CRON_SECRET_TOKEN\" \"$API_BASE_URL/api/cron/reset-daily-usage\""
echo ""
echo "🔍 Monitor cron logs with:"
echo "   tail -f /var/log/bytelecture-cron.log"
echo ""
echo "✅ Setup complete!" 