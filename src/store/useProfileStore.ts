import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Goal, Level, Position, TrainFrequency, Weakness } from '@/constants/kicks';
import { zustandStorage } from '@/lib/storage';

export interface OnboardingAnswers {
  position: Position | null;
  level: Level | null;
  weakness: Weakness | null;
  goal: Goal | null;
  frequency: TrainFrequency | null;
}

interface ProfileState {
  /** Set once the DOB check passes. DOB itself is kept in SecureStore, not here. */
  ageVerified: boolean;
  /** Birth year only, for analytics cohorts. */
  birthYear: number | null;
  onboardingComplete: boolean;
  answers: OnboardingAnswers;
  firstName: string;
  heightCm: number | null;
  referralCode: string | null;
  redeemedReferral: string | null;
  paywallVariant: 'A' | 'B' | null;
  setAgeVerified: (birthYear: number) => void;
  setAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void;
  completeOnboarding: () => void;
  setFirstName: (name: string) => void;
  setHeightCm: (cm: number | null) => void;
  setReferralCode: (code: string) => void;
  setRedeemedReferral: (code: string) => void;
  setPaywallVariant: (v: 'A' | 'B') => void;
  reset: () => void;
}

const initialAnswers: OnboardingAnswers = {
  position: null,
  level: null,
  weakness: null,
  goal: null,
  frequency: null,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ageVerified: false,
      birthYear: null,
      onboardingComplete: false,
      answers: initialAnswers,
      firstName: '',
      heightCm: null,
      referralCode: null,
      redeemedReferral: null,
      paywallVariant: null,
      setAgeVerified: (birthYear) => set({ ageVerified: true, birthYear }),
      setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),
      completeOnboarding: () => set({ onboardingComplete: true }),
      setFirstName: (firstName) => set({ firstName: firstName.trim().slice(0, 24) }),
      setHeightCm: (heightCm) => set({ heightCm }),
      setReferralCode: (referralCode) => set({ referralCode }),
      setRedeemedReferral: (redeemedReferral) => set({ redeemedReferral }),
      setPaywallVariant: (paywallVariant) => set({ paywallVariant }),
      reset: () =>
        set({
          ageVerified: false,
          birthYear: null,
          onboardingComplete: false,
          answers: initialAnswers,
          firstName: '',
          heightCm: null,
          referralCode: null,
          redeemedReferral: null,
          paywallVariant: null,
        }),
    }),
    { name: 'kickiq.profile', storage: zustandStorage, version: 1 },
  ),
);
