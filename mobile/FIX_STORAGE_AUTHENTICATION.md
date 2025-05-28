# 🔧 Fix: Storage Bucket Not Accessible

## ❌ Problem Identified
The "storage bucket is not accessible" error occurs because:

1. **User is not authenticated** when trying to upload
2. **Row Level Security (RLS) policies** require authentication for file uploads
3. **Bucket policies** only allow users to upload to their own folders (`{user_id}/...`)

## ✅ Solution: Ensure Authentication Before Upload

### 1. Check Authentication State in Your Component

Add this authentication check to your upload component:

```typescript
// In your PDFUpload component or wherever upload happens
import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

const [user, setUser] = useState(null);
const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  // Check initial auth state
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user || null);
    setIsAuthenticated(!!session?.user);
  });

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setUser(session?.user || null);
      setIsAuthenticated(!!session?.user);
    }
  );

  return () => subscription.unsubscribe();
}, []);

// In your upload function, check auth first:
const handleUpload = async () => {
  if (!isAuthenticated) {
    Alert.alert(
      'Authentication Required', 
      'Please sign in to upload files',
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
    );
    return;
  }
  
  // Proceed with upload...
};
```

### 2. Update Upload Service to Use User Folder

Modify the upload service to use the authenticated user's ID:

```typescript
// In uploadService.ts
export const uploadPDFToSupabase = async (
  file: PDFFile,
  options: UploadOptions = {},
  controller?: UploadController
): Promise<UploadResult> => {
  // Check authentication first
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return {
      success: false,
      error: 'User must be authenticated to upload files',
    };
  }

  const uploadOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Use user ID in the file path for RLS compliance
  const userFolder = `pdfs/${session.user.id}`;
  const filePath = `${userFolder}/${uploadOptions.fileName}`;

  // ... rest of upload logic
};
```

### 3. Quick Authentication Test

Add this helper function to test authentication:

```typescript
// Add to your component
const testAuthentication = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Auth error:', error);
    Alert.alert('Auth Error', error.message);
    return;
  }
  
  if (session?.user) {
    Alert.alert(
      'Authentication Status', 
      `✅ Logged in as: ${session.user.email}\n👤 User ID: ${session.user.id}`
    );
  } else {
    Alert.alert(
      'Authentication Status', 
      '❌ Not logged in\nPlease sign in to upload files'
    );
  }
};
```

### 4. Alternative: Temporary Anonymous Upload Policy (Less Secure)

If you want to allow anonymous uploads for testing, run this SQL in Supabase SQL Editor:

```sql
-- TEMPORARY: Allow anonymous uploads for testing
-- WARNING: This is less secure and should only be used for development

CREATE POLICY "Allow anonymous uploads for testing" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    name LIKE 'test-uploads/%'
  );
```

### 5. Add Authentication UI

If you don't have authentication set up yet, add a simple login screen:

```typescript
// Simple authentication component
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Signed in successfully!');
    }
    setLoading(false);
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Account created! Check your email for verification.');
    }
    setLoading(false);
  };

  // ... rest of UI
};
```

## 🎯 Summary

The storage error is caused by **missing authentication**. To fix:

1. ✅ **Ensure users are authenticated before uploading**
2. ✅ **Check auth state in your upload component**  
3. ✅ **Use user ID in upload path for RLS compliance**
4. ✅ **Add authentication UI if not already present**

The storage bucket and policies are configured correctly - you just need to authenticate users first!

## 🧪 Test the Fix

After implementing authentication:

1. Sign in with a test user
2. Try uploading a PDF
3. The upload should now work correctly
4. Files will be stored in `documents/pdfs/{user_id}/filename.pdf` 