import { createStore } from 'zustand/vanilla';
import { create } from 'zustand';
import type { Track } from '@/player/types';

interface PlayerState {
  isLoading: boolean;
  isInitialized: boolean;
  prevTrack: Track | null;
  activeTrack: Track | null;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setPrevTrack: (prevTrack: Track | null) => void;
  setActiveTrack: (activeTrack: Track | null) => void;
}

const usePlayerStore = create<PlayerState>((set) => ({
  isLoading: false,
  isInitialized: false,
  prevTrack: null,
  activeTrack: null,
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setPrevTrack: (prevTrack) => set({ prevTrack }),
  setActiveTrack: (activeTrack) => set({ activeTrack }),
}));

export default usePlayerStore;
