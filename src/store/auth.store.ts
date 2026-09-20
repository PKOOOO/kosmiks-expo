import { create } from 'zustand';

export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role?: 'customer' | 'service_provider' | 'admin';
    provider?: 'google' | 'apple' | 'email';
}

type AuthState = {
    isAuthenticated: boolean;
    user: User | null;
    isLoading: boolean;
    authToken: string | null;

    setIsAuthenticated: (value: boolean) => void;
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setAuthToken: (token: string | null) => void;
    setUserRole: (role: 'customer' | 'service_provider' | 'admin') => void;
    clearAuth: () => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    authToken: null,

    setIsAuthenticated: (value) => set({ isAuthenticated: value }),
    setUser: (user) => set({ user }),
    setLoading: (value) => set({ isLoading: value }),
    setAuthToken: (token) => set({ authToken: token }),
    setUserRole: (role) => {
        const currentUser = get().user;
        if (currentUser) {
            set({ user: { ...currentUser, role } });
        }
    },
    clearAuth: () => set({ 
        isAuthenticated: false, 
        user: null, 
        authToken: null,
        isLoading: false 
    }),
}))

export default useAuthStore;
