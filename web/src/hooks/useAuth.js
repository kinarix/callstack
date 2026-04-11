import { useEffect, useCallback, useState } from 'react';
import { parseJwt } from '../lib/jwt';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
export function useAuth() {
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem('callstack-user');
        return saved ? JSON.parse(saved) : null;
    });
    const handleCredentialResponse = useCallback((response, callback) => {
        try {
            const decoded = parseJwt(response.credential);
            const user = {
                email: decoded.email,
                name: decoded.name,
                picture: decoded.picture,
            };
            setCurrentUser(user);
            localStorage.setItem('callstack-user', JSON.stringify(user));
            callback(user);
        }
        catch (err) {
            console.error('Failed to parse credential:', err);
        }
    }, []);
    const initializeGoogleSignIn = useCallback((buttonElement) => {
        if (typeof window !== 'undefined' && window.google) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleCredentialResponse,
            });
            window.google.accounts.id.renderButton(buttonElement, {
                theme: 'filled_black',
                size: 'medium',
                text: 'signin_with',
                width: '200',
            });
        }
    }, [handleCredentialResponse]);
    const handleSignIn = useCallback((callback) => {
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
