#!/usr/bin/env node

/**
 * Deep Link Testing Script for ByteLecture
 * 
 * This script helps test deep link functionality during development.
 * Run this after starting the mobile app to test deep link handling.
 */

const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const testLinks = {
  '1': {
    name: 'Email Verification Success',
    url: 'bytelecture://auth/verify-email?token=test_token_123&type=signup'
  },
  '2': {
    name: 'Email Verification Error',
    url: 'bytelecture://auth/verify-email?error=invalid_token&error_description=The verification link has expired'
  },
  '3': {
    name: 'Password Reset',
    url: 'bytelecture://auth/reset-password?token=reset_token_456'
  },
  '4': {
    name: 'Custom Deep Link',
    url: 'bytelecture://custom/path?param1=value1&param2=value2'
  }
};

function showMenu() {
  console.log('\n🔗 ByteLecture Deep Link Tester');
  console.log('================================');
  console.log('Choose a deep link to test:');
  console.log('');
  
  Object.entries(testLinks).forEach(([key, link]) => {
    console.log(`${key}. ${link.name}`);
    console.log(`   ${link.url}`);
    console.log('');
  });
  
  console.log('c. Custom URL');
  console.log('q. Quit');
  console.log('');
}

function openDeepLink(url) {
  console.log(`\n🚀 Opening deep link: ${url}`);
  
  // Try iOS Simulator first
  exec(`xcrun simctl openurl booted "${url}"`, (error, stdout, stderr) => {
    if (error) {
      console.log('iOS Simulator not available, trying Android...');
      
      // Try Android Emulator
      exec(`adb shell am start -W -a android.intent.action.VIEW -d "${url}" com.bytelecture.app`, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Could not open deep link on any emulator/simulator');
          console.log('Make sure you have either:');
          console.log('- iOS Simulator running with ByteLecture app installed');
          console.log('- Android Emulator running with ByteLecture app installed');
          console.log('');
          console.log('Error details:', error.message);
        } else {
          console.log('✅ Deep link sent to Android emulator');
        }
      });
    } else {
      console.log('✅ Deep link sent to iOS simulator');
    }
  });
}

function promptUser() {
  rl.question('Enter your choice: ', (answer) => {
    const choice = answer.toLowerCase().trim();
    
    if (choice === 'q') {
      console.log('👋 Goodbye!');
      rl.close();
      return;
    }
    
    if (choice === 'c') {
      rl.question('Enter custom deep link URL: ', (customUrl) => {
        if (customUrl.trim()) {
          openDeepLink(customUrl.trim());
        } else {
          console.log('❌ Invalid URL');
        }
        setTimeout(() => {
          showMenu();
          promptUser();
        }, 2000);
      });
      return;
    }
    
    const selectedLink = testLinks[choice];
    if (selectedLink) {
      openDeepLink(selectedLink.url);
      setTimeout(() => {
        showMenu();
        promptUser();
      }, 2000);
    } else {
      console.log('❌ Invalid choice');
      setTimeout(() => {
        showMenu();
        promptUser();
      }, 1000);
    }
  });
}

// Check if required tools are available
function checkTools() {
  console.log('🔍 Checking available tools...');
  
  exec('xcrun simctl list devices', (error) => {
    if (!error) {
      console.log('✅ iOS Simulator tools available');
    } else {
      console.log('⚠️  iOS Simulator tools not available');
    }
    
    exec('adb devices', (error) => {
      if (!error) {
        console.log('✅ Android Debug Bridge (adb) available');
      } else {
        console.log('⚠️  Android Debug Bridge (adb) not available');
      }
      
      console.log('');
      console.log('📱 Make sure your app is running on a simulator/emulator before testing deep links.');
      console.log('');
      
      showMenu();
      promptUser();
    });
  });
}

// Start the script
console.log('🎯 ByteLecture Deep Link Testing Tool');
console.log('====================================');
console.log('');
console.log('This tool helps you test deep link functionality during development.');
console.log('Make sure the ByteLecture app is running on your simulator/emulator.');
console.log('');

checkTools(); 