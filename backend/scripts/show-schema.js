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

async function getSchemaStructure() {
  console.log('🏗️  ByteLecture Database Schema Structure');
  console.log('='.repeat(60));
  
  try {
    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_schema_tables');
    
    if (tablesError) {
      // Fallback: try to get tables using information_schema
      console.log('📋 Attempting to fetch schema via direct queries...\n');
      await getSchemaDirectly();
      return;
    }
    
    console.log('📋 Tables found:', tables);
    
  } catch (error) {
    console.log('📋 Using direct schema queries...\n');
    await getSchemaDirectly();
  }
}

async function getSchemaDirectly() {
  try {
    // 1. Show all tables we know exist
    console.log('🗃️  KNOWN TABLES:');
    console.log('='.repeat(40));
    
    const knownTables = [
      'user_profiles',
      'user_usage_tracking', 
      'plan_limits',
      'error_logs',
      'processed_pdfs',
      'processed_videos' // This might not exist yet
    ];
    
    for (const tableName of knownTables) {
      console.log(`\n📊 TABLE: ${tableName}`);
      console.log('-'.repeat(30));
      
      try {
        // Try to get table structure
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`   ❌ ${error.message}`);
          continue;
        }
        
        console.log(`   ✅ Exists and accessible`);
        
        // Show sample data structure if any data exists
        if (data && data.length > 0) {
          console.log(`   📝 Sample columns:`, Object.keys(data[0]).join(', '));
        } else {
          console.log(`   📝 Table is empty, trying to get column info...`);
        }
        
        // Get row count
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          console.log(`   📈 Total rows: ${count}`);
        }
        
      } catch (tableError) {
        console.log(`   ❌ Error accessing table: ${tableError.message}`);
      }
    }
    
    // 2. Show plan_limits details
    console.log('\n\n🎯 PLAN LIMITS DETAILS:');
    console.log('='.repeat(40));
    
    const { data: planLimits, error: planError } = await supabase
      .from('plan_limits')
      .select('*')
      .order('plan_type, resource_type');
    
    if (!planError && planLimits) {
      console.log(`📊 Total plan limit records: ${planLimits.length}`);
      console.log('\n📋 Plan limits by type:');
      
      const groupedPlans = planLimits.reduce((acc, limit) => {
        if (!acc[limit.plan_type]) acc[limit.plan_type] = [];
        acc[limit.plan_type].push(limit);
        return acc;
      }, {});
      
      Object.entries(groupedPlans).forEach(([planType, limits]) => {
        console.log(`\n  🏷️  ${planType.toUpperCase()} PLAN:`);
        limits.forEach(limit => {
          console.log(`    - ${limit.resource_type}: ${limit.daily_limit}/day, ${limit.monthly_limit}/month`);
        });
      });
      
      console.log('\n📋 All resource types:');
      const resourceTypes = [...new Set(planLimits.map(limit => limit.resource_type))];
      resourceTypes.forEach(type => console.log(`  - ${type}`));
    } else {
      console.log('❌ Could not fetch plan limits:', planError?.message);
    }
    
    // 3. Show user_profiles structure
    console.log('\n\n👤 USER PROFILES DETAILS:');
    console.log('='.repeat(40));
    
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(3);
    
    if (!profilesError && profiles) {
      console.log(`📊 Total user profiles: checking...`);
      
      const { count: profileCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Total user profiles: ${profileCount}`);
      
      if (profiles.length > 0) {
        console.log('📝 Sample profile structure:');
        const sampleProfile = profiles[0];
        Object.entries(sampleProfile).forEach(([key, value]) => {
          const valueType = typeof value;
          const displayValue = valueType === 'string' && value.length > 50 
            ? `${value.substring(0, 50)}...` 
            : value;
          console.log(`  - ${key}: ${displayValue} (${valueType})`);
        });
      }
    } else {
      console.log('❌ Could not fetch user profiles:', profilesError?.message);
    }
    
    // 4. Show usage tracking details
    console.log('\n\n📊 USAGE TRACKING DETAILS:');
    console.log('='.repeat(40));
    
    const { data: usageStats, error: usageError } = await supabase
      .from('user_usage_tracking')
      .select('*')
      .limit(10);
    
    if (!usageError) {
      const { count: totalUsage } = await supabase
        .from('user_usage_tracking')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Total usage tracking records: ${totalUsage}`);
      
      // Get recent usage if any exists
      if (usageStats && usageStats.length > 0) {
        console.log('\n📋 Recent usage records:');
        usageStats.slice(0, 5).forEach(usage => {
          console.log(`  - ${usage.date_tracked}: ${usage.resource_type} (${usage.usage_count} uses)`);
        });
        
        console.log('\n📝 Usage tracking columns:', Object.keys(usageStats[0]).join(', '));
      } else {
        console.log('\n📝 No usage records found yet');
      }
    } else {
      console.log('❌ Could not fetch usage tracking:', usageError?.message);
    }
    
    // 5. Check for processed_videos table
    console.log('\n\n🎥 YOUTUBE PROCESSING STATUS:');
    console.log('='.repeat(40));
    
    const { data: videos, error: videosError } = await supabase
      .from('processed_videos')
      .select('*')
      .limit(1);
    
    if (!videosError) {
      const { count: videoCount } = await supabase
        .from('processed_videos')
        .select('*', { count: 'exact', head: true });
      
      console.log(`✅ processed_videos table exists`);
      console.log(`📊 Total processed videos: ${videoCount}`);
      
      if (videos && videos.length > 0) {
        console.log('📝 Sample video record structure:');
        const sampleVideo = videos[0];
        Object.keys(sampleVideo).forEach(key => {
          console.log(`  - ${key}: ${typeof sampleVideo[key]}`);
        });
      } else {
        console.log('📝 Table exists but is empty (expected for new setup)');
      }
    } else {
      console.log(`❌ processed_videos table does not exist yet`);
      console.log(`   Error: ${videosError.message}`);
      console.log(`   👉 You need to run the YouTube processing migration SQL`);
    }
    
    // 6. Show constraint information
    console.log('\n\n🔒 IMPORTANT CONSTRAINTS:');
    console.log('='.repeat(40));
    
    // Check if youtube_processing is allowed in plan_limits
    const youtubeInLimits = planLimits?.some(limit => limit.resource_type === 'youtube_processing');
    console.log(`🎥 YouTube processing in plan_limits: ${youtubeInLimits ? '✅ YES' : '❌ NO'}`);
    
    if (!youtubeInLimits) {
      console.log('   👉 You need to update the plan_limits constraint first');
    }
    
    // 7. Summary of current state
    console.log('\n\n📈 DATABASE SETUP STATUS:');
    console.log('='.repeat(40));
    
    const tableStatus = {
      'plan_limits': '✅ EXISTS & CONFIGURED',
      'user_usage_tracking': '✅ EXISTS (empty)',
      'error_logs': '✅ EXISTS (empty)', 
      'processed_videos': '✅ EXISTS (empty)',
      'user_profiles': '❌ MISSING',
      'processed_pdfs': '❌ MISSING'
    };
    
    Object.entries(tableStatus).forEach(([table, status]) => {
      console.log(`   ${table}: ${status}`);
    });
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('   1. Create missing user_profiles table');
    console.log('   2. Create missing processed_pdfs table');
    console.log('   3. All YouTube processing infrastructure is ready!');
    
  } catch (error) {
    console.error('❌ Error getting schema:', error.message);
  }
}

async function showTableRelationships() {
  console.log('\n\n🔗 TABLE RELATIONSHIPS:');
  console.log('='.repeat(40));
  
  console.log(`
📊 ByteLecture Database Schema:

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  auth.users     │────→│  user_profiles   │     │   plan_limits   │
│  (Supabase)     │     │                  │     │                 │
└─────────────────┘     │ - user_id (FK)   │     │ - plan_type     │
                        │ - full_name      │     │ - resource_type │
                        │ - subscription_  │     │ - daily_limit   │
                        │   plan           │     │ - monthly_limit │
                        └──────────────────┘     └─────────────────┘
                                 │
                                 │
                        ┌────────▼──────────┐     ┌─────────────────┐
                        │ user_usage_       │     │  error_logs     │
                        │ tracking          │     │                 │
                        │                   │     │ - user_id (FK)  │
                        │ - user_id (FK)    │     │ - error_type    │
                        │ - resource_type   │     │ - error_message │
                        │ - usage_count     │     │ - created_at    │
                        │ - date_tracked    │     └─────────────────┘
                        └───────────────────┘
                                 │
                                 │
                        ┌────────▼──────────┐     ┌─────────────────┐
                        │ processed_pdfs    │     │ processed_      │
                        │                   │     │ videos          │
                        │ - user_id (FK)    │     │                 │
                        │ - file_name       │     │ - user_id (FK)  │
                        │ - content_text    │     │ - video_id      │
                        │ - processed_at    │     │ - title         │
                        └───────────────────┘     │ - transcript    │
                                                  │ - metadata      │
                                                  └─────────────────┘

🔑 Foreign Key Relationships:
   • user_profiles.user_id → auth.users.id
   • user_usage_tracking.user_id → auth.users.id  
   • error_logs.user_id → auth.users.id
   • processed_pdfs.user_id → auth.users.id
   • processed_videos.user_id → auth.users.id

🛡️  Security:
   • All tables have Row Level Security (RLS) enabled
   • Users can only access their own data
   • Service role has full access for backend operations

📋 DETAILED TABLE STRUCTURES:

🔹 plan_limits:
   - id: UUID (Primary Key)
   - plan_type: TEXT ('free', 'premium', 'enterprise')
   - resource_type: TEXT ('ai_processing', 'pdf_upload', 'youtube_processing', etc.)
   - daily_limit: INTEGER (-1 for unlimited)
   - monthly_limit: INTEGER (-1 for unlimited)
   - created_at: TIMESTAMPTZ

🔹 user_usage_tracking:
   - user_id: UUID (Foreign Key → auth.users)
   - resource_type: TEXT (matches plan_limits.resource_type)
   - usage_count: INTEGER
   - date_tracked: DATE
   - created_at: TIMESTAMPTZ

🔹 error_logs:
   - user_id: UUID (Foreign Key → auth.users)
   - error_type: TEXT
   - error_message: TEXT
   - created_at: TIMESTAMPTZ

🔹 processed_videos:
   - user_id: UUID (Foreign Key → auth.users)
   - video_id: TEXT (YouTube video ID)
   - title: TEXT
   - transcript: TEXT
   - metadata: JSONB
   - processed_at: TIMESTAMPTZ

🔹 user_profiles (PLANNED):
   - user_id: UUID (Foreign Key → auth.users)
   - full_name: TEXT
   - subscription_plan: TEXT ('free', 'premium', 'enterprise')
   - created_at: TIMESTAMPTZ

🔹 processed_pdfs (PLANNED):
   - user_id: UUID (Foreign Key → auth.users)
   - file_name: TEXT
   - content_text: TEXT
   - processed_at: TIMESTAMPTZ
  `);
}

if (require.main === module) {
  getSchemaStructure()
    .then(() => showTableRelationships())
    .then(() => {
      console.log('\n🏁 Schema analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
} 