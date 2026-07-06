import { useLending } from '../contexts/LendingContext';

export const useTransactions = () => {
  const { transactions, activities, addTransaction } = useLending();

  return {
    transactions,
    activities,
    addTransaction,
  };
};

