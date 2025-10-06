
import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function getValue<T,>(key: string, initialValue: T | (() => T)): T {
  const savedValue = localStorage.getItem(key);
  if (savedValue) {
    try {
      return JSON.parse(savedValue);
    } catch (e) {
      console.error(`Error parsing localStorage key "${key}":`, e);
      // Fallback to initial value if parsing fails
    }
  }

  if (initialValue instanceof Function) {
    return initialValue();
  }
  return initialValue;
}

// FIX: Changed React.Dispatch<React.SetStateAction<T>> to Dispatch<SetStateAction<T>> and imported the types.
export function useLocalStorage<T,>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => getValue(key, initialValue));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error setting localStorage key "${key}":`, e);
    }
  }, [key, value]);

  return [value, setValue];
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
