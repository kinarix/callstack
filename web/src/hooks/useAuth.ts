import { useEffect, useCallback, useState } from 'react';
import { parseJwt } from '../lib/jwt';

export interface User {
  email: string;
  name: string;
  picture: string;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

interface UseAuth {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  initializeGoogleSignIn: (buttonElement: HTMLElement) => void;
  handleSignIn: (callback: (user: User) => void) => void;
  handleSignOut: () => void;
}

export function useAuth(): UseAuth {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('callstack-user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleCredentialResponse = useCallback(
    (response: any, callback: (user: User) => void) => {
      try {
        const decoded = parseJwt(response.credential);
        const user: User = {
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
        };
        setCurrentUser(user);
        localStorage.setItem('callstack-user', JSON.stringify(user));
        callback(user);
      } catch (err) {
        console.error('Failed to parse credential:', err);
      }
    },
    []
  );

  const initializeGoogleSignIn = useCallback((buttonElement: HTMLElement) => {
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      (window as any).google.accounts.id.renderButton(buttonElement, {
        theme: 'filled_black',
        size: 'medium',
        text: 'signin_with',
        width: '200',
      });
    }
  }, [handleCredentialResponse]);

  const handleSignIn = useCallback((callback: (user: User) => void) => {
    // Handled by Google's renderButton callback
  }, []);

  const handleSignOut = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('callstack-user');
  }, []);

  // Load Google Sign-In script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return {
    currentUser,
    setCurrentUser,
    initializeGoogleSignIn,
    handleSignIn,
    handleSignOut,
  };
}
