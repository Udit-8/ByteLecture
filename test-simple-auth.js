#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000';

async function testRegistration() {
  console.log('Testing with standard email format...');
  
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    fullName: 'Test User'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });
    
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Registration successful!');
    } else {
      console.log('❌ Registration failed');
    }
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

testRegistration(); 