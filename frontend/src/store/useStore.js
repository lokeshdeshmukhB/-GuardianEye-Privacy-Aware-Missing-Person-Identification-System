import { create } from 'zustand';

const useStore = create((set) => ({
  // Gallery
  gallery: [],
  galleryTotal: 0,
  setGallery: (data) => set({ gallery: data }),

  // Re-ID results
  reidResults: null,
  setReidResults: (results) => set({ reidResults: results }),

  // Attribute results (aliased as attrResults for component convenience)
  attrResults: null,
  setAttrResults: (results) => set({ attrResults: results }),

  // Gait results
  gaitResults: null,
  setGaitResults: (results) => set({ gaitResults: results }),

  // Dashboard stats
  stats: null,
  setStats: (stats) => set({ stats }),

  // Global loading state
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Reset all results
  resetResults: () =>
    set({ reidResults: null, attrResults: null, gaitResults: null }),
}));

export default useStore;
