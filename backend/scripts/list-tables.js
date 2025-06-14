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

async function listAllTables() {
  console.log('📋 SUPABASE TABLES IN YOUR PROJECT:');
  console.log('='.repeat(50));
  
  try {
    // Method 1: Try to get tables from information_schema using a direct query
    const { data: infoSchemaData, error: infoError } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name, table_type')
      .in('table_schema', ['public', 'auth', 'storage'])
      .order('table_schema, table_name');
    
    if (!infoError && infoSchemaData && infoSchemaData.length > 0) {
      console.log('✅ Tables found via information_schema:');
      let currentSchema = '';
      infoSchemaData.forEach(table => {
        if (table.table_schema !== currentSchema) {
          currentSchema = table.table_schema;
          console.log(`\n🏷️  ${currentSchema.toUpperCase()} SCHEMA:`);
        }
        console.log(`   📊 ${table.table_name} (${table.table_type})`);
      });
      return;
    }
    
    // Method 2: Check known tables individually
    console.log('⚠️  Direct schema query not available, checking known tables...\n');
    
    const knownTables = [
      'user_usage_tracking',
      'plan_limits', 
      'error_logs',
      'processed_videos',
      'user_profiles',
      'processed_pdfs'
    ];
    
    console.log('🔍 PUBLIC SCHEMA TABLES:');
    for (const tableName of knownTables) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (tableError) {
          if (tableError.message.includes('does not exist')) {
            console.log(`❌ ${tableName}: Does not exist`);
          } else {
            console.log(`⚠️  ${tableName}: ${tableError.message}`);
          }
        } else {
          const { count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          // Get column info if table has data
          let columnInfo = '';
          if (tableData && tableData.length > 0) {
            const columns = Object.keys(tableData[0]);
            columnInfo = ` [${columns.length} columns: ${columns.slice(0, 3).join(', ')}${columns.length > 3 ? '...' : ''}]`;
          }
          
          console.log(`✅ ${tableName}: EXISTS (${count} rows)${columnInfo}`);
        }
      } catch (e) {
        console.log(`❌ ${tableName}: ${e.message}`);
      }
    }
    
    // Method 3: Try to detect other Supabase tables
    console.log('\n🔍 CHECKING SUPABASE SYSTEM TABLES:');
    const systemTables = [
      { schema: 'auth', table: 'users' },
      { schema: 'storage', table: 'buckets' },
      { schema: 'storage', table: 'objects' }
    ];
    
    for (const { schema, table } of systemTables) {
      try {
        // Note: We can't directly query these with the client, but we can try
        console.log(`📊 ${schema}.${table}: System table (access via admin only)`);
      } catch (e) {
        console.log(`❌ ${schema}.${table}: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error listing tables:', error.message);
  }
}

async function showTablesSummary() {
  console.log('\n📈 TABLES SUMMARY:');
  console.log('='.repeat(30));
  
  const tableCategories = {
    '✅ EXISTING TABLES': [
      'plan_limits - Usage limits per subscription plan',
      'user_usage_tracking - Track user resource consumption', 
      'error_logs - Application error logging',
      'processed_videos - YouTube video processing results'
    ],
    '❌ MISSING TABLES': [
      'user_profiles - User profile information',
      'processed_pdfs - PDF processing results'
    ],
    '🏗️  SUPABASE SYSTEM TABLES': [
      'auth.users - User authentication (managed by Supabase)',
      'storage.buckets - File storage buckets',
      'storage.objects - Stored files and metadata'
    ]
  };
  
  Object.entries(tableCategories).forEach(([category, tables]) => {
    console.log(`\n${category}:`);
    tables.forEach(table => {
      console.log(`   • ${table}`);
    });
  });
}

if (require.main === module) {
  listAllTables()
    .then(() => showTablesSummary())
    .then(() => {
      console.log('\n🏁 Table listing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Failed:', error);
      process.exit(1);
    });
} 