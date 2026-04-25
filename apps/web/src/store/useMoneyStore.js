import { create } from 'zustand'

export const useMoneyStore = create((set) => ({
  balance: 1000,
  winMoney: (amount) => set((state) => ({ balance: state.balance + amount })),
  loseMoney: (amount) => set((state) => ({ balance: state.balance - amount }))
}))
