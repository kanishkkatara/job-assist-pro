import { useState, useEffect, useRef } from 'react';

export function useStorageLocal<T>(key: string, initialValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    chrome.storage.local.get({ [key]: initialValueRef.current }, (result) => {
      setValue(result[key] as T);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[key]) {
        const newVal = changes[key].newValue !== undefined ? changes[key].newValue : initialValueRef.current;
        setValue(newVal as T);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);

  const setter = (newValue: T) => {
    setValue(newValue);
    chrome.storage.local.set({ [key]: newValue });
  };

  return [value, setter];
}

export function useStorageSession<T>(key: string, initialValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    chrome.storage.session.get({ [key]: initialValueRef.current }, (result) => {
      setValue(result[key] as T);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'session' && changes[key]) {
        const newVal = changes[key].newValue !== undefined ? changes[key].newValue : initialValueRef.current;
        setValue(newVal as T);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);

  const setter = (newValue: T) => {
    setValue(newValue);
    chrome.storage.session.set({ [key]: newValue });
  };

  return [value, setter];
}
