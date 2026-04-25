import { create } from 'zustand';

const useStore = create((set) => ({
  // Re-ID results
  reidResults: null,
  setReidResults: (results) => set({ reidResults: results }),

  // Attribute results (aliased as attrResults for component convenience)
  attrResults: null,
  setAttrResults: (results) => set({ attrResults: results }),

  // Dashboard stats
  stats: null,
  setStats: (stats) => set({ stats }),

  // Global loading state
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Reset all results
  resetResults: () =>
    set({ reidResults: null, attrResults: null }),
}));

export default useStore;
