import { create } from 'zustand';

type ProviderServicesState = {
  count: number;
  setCount: (count: number) => void;
  tabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
};

const useProviderServicesStore = create<ProviderServicesState>((set) => ({
  count: 0,
  setCount: (count) => set({ count: Math.max(0, count) }),
  tabBarHidden: false,
  setTabBarHidden: (tabBarHidden) => set({ tabBarHidden }),
}));

export default useProviderServicesStore;
