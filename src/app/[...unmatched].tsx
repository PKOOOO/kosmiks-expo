import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

/**
 * Catch-all route to handle OAuth callbacks and unmatched routes.
 * This prevents the "unmatched route" error from showing during OAuth redirects.
 */
export default function UnmatchedRoute() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      // Wait a brief moment for any OAuth processing to complete
      const timeout = setTimeout(() => {
        // Redirect to home - the user will be signed in if OAuth was successful
        router.replace('/');
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [isLoaded, isSignedIn, router]);

  // Show a loading spinner while processing
  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#F4EDE5', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <ActivityIndicator size="large" color="#423120" />
    </View>
  );
}

