import { useState, useEffect } from 'react';

let globalBalance = 1000;
const listeners = new Set();

export const useMoneyStore = () => {
  const [balance, setBalance] = useState(globalBalance);

  useEffect(() => {
    listeners.add(setBalance);
    return () => listeners.delete(setBalance);
  }, []);

  const winMoney = (amount) => {
    globalBalance += amount;
    listeners.forEach((listener) => listener(globalBalance));
  };

  const loseMoney = (amount) => {
    globalBalance -= amount;
    listeners.forEach((listener) => listener(globalBalance));
  };

  return { balance, winMoney, loseMoney };
};
