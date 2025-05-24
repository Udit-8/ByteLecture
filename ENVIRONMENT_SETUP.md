# Environment Setup Guide

## Required Environment Variables

### Backend (.env file in backend/ directory)
```
# Server Configuration
NODE_ENV=development
PORT=3000

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# AI API Keys
OPENAI_API_KEY=your_openai_api_key_here

# File Upload Configuration
MAX_FILE_SIZE=50000000
UPLOAD_DIR=uploads

# Security
JWT_SECRET=your_jwt_secret_here
BCRYPT_ROUNDS=12

# External Services
YOUTUBE_API_KEY=your_youtube_api_key_here
DODO_PAYMENTS_API_KEY=your_dodo_payments_api_key_here
```

### Mobile App (.env file in mobile/ directory)
```
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3000

# Supabase (for client-side)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Setup Instructions

1. Copy the backend configuration to `backend/.env`
2. Copy the mobile configuration to `mobile/.env`
3. Replace placeholder values with actual API keys and URLs
4. Never commit .env files to version control

## Development vs Production

- Development: Use localhost URLs
- Production: Use actual domain URLs
- Use different API keys for different environments 