import { create } from 'zustand';

const useStore = create((set) => ({
  // Gallery
  gallery: [],
  galleryTotal: 0,
  setGallery: (persons, total) => set({ gallery: persons, galleryTotal: total }),

  // Re-ID results
  reidResults: null,
  setReidResults: (results) => set({ reidResults: results }),

  // Attribute results
  attributeResults: null,
  setAttributeResults: (results) => set({ attributeResults: results }),

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
    set({ reidResults: null, attributeResults: null, gaitResults: null }),
}));

export default useStore;
