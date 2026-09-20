import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import useAuthStore, { User } from '@/store/auth.store';

/**
 * Hook to sync Clerk authentication state with zustand auth store.
 * Call this in components that need auth state synced.
 */
export function useClerkAuth() {
    const { isSignedIn, isLoaded: authLoaded, getToken } = useAuth();
    const { user: clerkUser, isLoaded: userLoaded } = useUser();
    const { 
        setUser, 
        setIsAuthenticated, 
        setLoading, 
        setAuthToken,
        user,
        isAuthenticated,
        isLoading
    } = useAuthStore();

    useEffect(() => {
        // Sync loading state
        setLoading(!authLoaded || !userLoaded);
    }, [authLoaded, userLoaded, setLoading]);

    useEffect(() => {
        // Sync authentication state
        if (authLoaded) {
            setIsAuthenticated(isSignedIn ?? false);
        }
    }, [authLoaded, isSignedIn, setIsAuthenticated]);

    useEffect(() => {
        // Sync user data from Clerk to zustand
        if (userLoaded && clerkUser && isSignedIn) {
            // Determine auth provider
            let provider: 'google' | 'apple' | 'email' = 'email';
            const externalAccounts = clerkUser.externalAccounts;
            if (externalAccounts && externalAccounts.length > 0) {
                const firstAccount = externalAccounts[0];
                if (firstAccount.provider === 'google') {
                    provider = 'google';
                } else if (firstAccount.provider === 'apple') {
                    provider = 'apple';
                }
            }

            const syncedUser: User = {
                id: clerkUser.id,
                name: clerkUser.fullName || clerkUser.firstName || 'User',
                email: clerkUser.primaryEmailAddress?.emailAddress || '',
                avatar: clerkUser.imageUrl || '',
                provider,
            };
            setUser(syncedUser);
        } else if (userLoaded && !clerkUser) {
            setUser(null);
        }
    }, [userLoaded, clerkUser, isSignedIn, setUser]);

    useEffect(() => {
        // Sync auth token
        const syncToken = async () => {
            if (isSignedIn && authLoaded) {
                try {
                    const token = await getToken();
                    setAuthToken(token);
                } catch (error) {
                    console.log('Failed to get auth token:', error);
                    setAuthToken(null);
                }
            } else if (authLoaded) {
                setAuthToken(null);
            }
        };
        
        syncToken();
    }, [authLoaded, isSignedIn, getToken, setAuthToken]);

    return {
        isLoaded: authLoaded && userLoaded,
        isSignedIn: isSignedIn ?? false,
        user,
        isAuthenticated,
        isLoading,
    };
}

export default useClerkAuth;

