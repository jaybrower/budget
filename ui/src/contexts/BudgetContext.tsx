import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Budget } from '../types/budget';
import { getBudgets } from '../api/budgets';
import { useAuth } from './AuthContext';

interface BudgetContextType {
  budgets: Budget[];
  currentBudget: Budget | null;
  isLoading: boolean;
  setCurrentBudget: (budget: Budget) => void;
  refreshBudgets: () => Promise<void>;
}

const BudgetContext = createContext<BudgetContextType | null>(null);

export function BudgetProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [currentBudget, setCurrentBudgetState] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBudgets = async () => {
    if (!isAuthenticated) {
      setBudgets([]);
      setCurrentBudgetState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await getBudgets();
      setBudgets(response.budgets);

      // Set current budget from localStorage or first budget
      const savedBudgetId = localStorage.getItem('currentBudgetId');
      if (savedBudgetId) {
        const savedBudget = response.budgets.find(b => b.id === savedBudgetId);
        if (savedBudget) {
          setCurrentBudgetState(savedBudget);
        } else if (response.budgets.length > 0) {
          setCurrentBudgetState(response.budgets[0]);
          localStorage.setItem('currentBudgetId', response.budgets[0].id);
        }
      } else if (response.budgets.length > 0) {
        setCurrentBudgetState(response.budgets[0]);
        localStorage.setItem('currentBudgetId', response.budgets[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch budgets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshBudgets();
  }, [isAuthenticated]);

  const setCurrentBudget = (budget: Budget) => {
    setCurrentBudgetState(budget);
    localStorage.setItem('currentBudgetId', budget.id);
  };

  return (
    <BudgetContext.Provider
      value={{
        budgets,
        currentBudget,
        isLoading,
        setCurrentBudget,
        refreshBudgets,
      }}
    >
      {children}
    </BudgetContext.Provider>
  );
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
}
