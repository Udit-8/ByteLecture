#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPlanLimits() {
  console.log('🔍 Checking plan_limits table structure...');
  
  try {
    // Get current plan limits
    const { data: planLimits, error: planError } = await supabase
      .from('plan_limits')
      .select('*');
    
    if (planError) {
      console.error('❌ Error fetching plan limits:', planError.message);
      return;
    }
    
    console.log('\n📊 Current plan limits:');
    if (planLimits && planLimits.length > 0) {
      console.table(planLimits);
      
      console.log('\n📋 Unique resource types found:');
      const resourceTypes = [...new Set(planLimits.map(limit => limit.resource_type))];
      resourceTypes.forEach(type => console.log(`  - ${type}`));
    } else {
      console.log('   No plan limits found');
    }
    
    // Check if youtube_processing already exists
    const youtubeExists = planLimits.some(limit => limit.resource_type === 'youtube_processing');
    console.log('\n🎥 YouTube processing limits:', youtubeExists ? '✅ EXISTS' : '❌ NOT FOUND');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  checkPlanLimits()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
} 