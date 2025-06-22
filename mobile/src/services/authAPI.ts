// REST API authentication service as fallback for Supabase issues
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
}

interface AuthResponse {
  user?: User;
  session?: {
    access_token: string;
    refresh_token: string;
  };
  error?: string;
  message?: string;
}

class AuthAPI {
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: any
  ): Promise<AuthResponse> {
    try {
      const token = await AsyncStorage.getItem('auth_token');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || data.error || 'Request failed' };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return { error: 'Network error occurred' };
    }
  }

  async register(
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthResponse> {
    const result = await this.makeRequest('/auth/register', 'POST', {
      email,
      password,
      full_name: fullName,
    });

    if (result.session?.access_token) {
      await AsyncStorage.setItem('auth_token', result.session.access_token);
    }

    return result;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const result = await this.makeRequest('/auth/login', 'POST', {
      email,
      password,
    });

    if (result.session?.access_token) {
      await AsyncStorage.setItem('auth_token', result.session.access_token);
    }

    return result;
  }

  async logout(): Promise<AuthResponse> {
    const result = await this.makeRequest('/auth/logout', 'POST');
    await AsyncStorage.removeItem('auth_token');
    return result;
  }

  async getProfile(): Promise<AuthResponse> {
    return await this.makeRequest('/auth/me');
  }

  async getStoredToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  }

  async clearStoredToken(): Promise<void> {
    await AsyncStorage.removeItem('auth_token');
  }
}

export const authAPI = new AuthAPI();
export default authAPI;
