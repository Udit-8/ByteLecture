#!/usr/bin/env node
// Simple script to test ByteLecture authentication API

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
async function makeRequest(url, method = 'GET', body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  const result = await makeRequest(`${BASE_URL}/api/auth/health`);
  
  if (result.ok) {
    console.log('✅ Health check passed:', result.data);
  } else {
    console.log('❌ Health check failed:', result);
  }
  return result.ok;
}

async function testRegistration() {
  console.log('\n📝 Testing User Registration...');
  const testUser = {
    email: `rai.udit.88@gmail.com`,
    password: 'uditRAI123!',
    fullName: 'Udit Rai'
  };
  
  const result = await makeRequest(`${BASE_URL}/api/auth/register`, 'POST', testUser);
  
  if (result.ok) {
    console.log('✅ Registration successful:', {
      email: testUser.email,
      response: result.data
    });
    return testUser;
  } else {
    console.log('❌ Registration failed:', result);
    return null;
  }
}

async function testLogin(email, password) {
  console.log('\n🔑 Testing User Login...');
  const result = await makeRequest(`${BASE_URL}/api/auth/login`, 'POST', {
    email,
    password
  });
  
  if (result.ok) {
    console.log('✅ Login successful:', {
      email,
      hasToken: !!result.data.session?.access_token
    });
    return result.data.session?.access_token;
  } else {
    console.log('❌ Login failed:', result);
    return null;
  }
}

async function testProfile(token) {
  console.log('\n👤 Testing Profile Access...');
  const result = await makeRequest(`${BASE_URL}/api/auth/me`, 'GET', null, {
    Authorization: `Bearer ${token}`
  });
  
  if (result.ok) {
    console.log('✅ Profile access successful:', result.data);
  } else {
    console.log('❌ Profile access failed:', result);
  }
  return result.ok;
}

async function testLogout(token) {
  console.log('\n🚪 Testing User Logout...');
  const result = await makeRequest(`${BASE_URL}/api/auth/logout`, 'POST', null, {
    Authorization: `Bearer ${token}`
  });
  
  if (result.ok) {
    console.log('✅ Logout successful:', result.data);
  } else {
    console.log('❌ Logout failed:', result);
  }
  return result.ok;
}

// Main test function
async function runTests() {
  console.log('🧪 Starting ByteLecture Authentication API Tests');
  console.log('================================================');
  
  let passed = 0;
  let total = 0;
  
  // Test 1: Health Check
  total++;
  if (await testHealthCheck()) passed++;
  
  // Test 2: Registration
  total++;
  const testUser = await testRegistration();
  if (testUser) passed++;
  
  if (!testUser) {
    console.log('\n❌ Stopping tests - registration failed');
    return;
  }
  
  // Test 3: Login
  total++;
  const token = await testLogin(testUser.email, testUser.password);
  if (token) passed++;
  
  if (!token) {
    console.log('\n❌ Stopping tests - login failed');
    return;
  }
  
  // Test 4: Profile Access
  total++;
  if (await testProfile(token)) passed++;
  
  // Test 5: Logout
  total++;
  if (await testLogout(token)) passed++;
  
  // Results
  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Authentication system is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the Supabase configuration and database setup.');
  }
}

// Run the tests
runTests().catch(console.error); 