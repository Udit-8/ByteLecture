import React from 'react';
import { useAuth } from '../contexts/AuthContext';
export const AuthButtons: React.FC = () => {
  const {
    login
  } = useAuth();
  return <div className="flex gap-4">
      <button onClick={login} className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        Log in
      </button>
      <button onClick={login} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Sign up
      </button>
    </div>;
};