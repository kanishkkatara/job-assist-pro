import { useState, useEffect, useRef } from 'react';

export function useStorageLocal<T>(key: string, initialValue: T): [T, (val: T) => void, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    let isMounted = true;
    chrome.storage.local.get({ [key]: initialValueRef.current }, (result) => {
      if (isMounted) {
        setValue(result[key] as T);
        setIsLoaded(true);
      }
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[key] && isMounted) {
        const newVal = changes[key].newValue !== undefined ? changes[key].newValue : initialValueRef.current;
        setValue(newVal as T);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      isMounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  const setter = (newValue: T) => {
    setValue(newValue);
    chrome.storage.local.set({ [key]: newValue });
  };

  return [value, setter, isLoaded];
}

export function useStorageSession<T>(key: string, initialValue: T): [T, (val: T) => void, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const initialValueRef = useRef(initialValue);

  useEffect(() => {
    let isMounted = true;
    chrome.storage.session.get({ [key]: initialValueRef.current }, (result) => {
      if (isMounted) {
        setValue(result[key] as T);
        setIsLoaded(true);
      }
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'session' && changes[key] && isMounted) {
        const newVal = changes[key].newValue !== undefined ? changes[key].newValue : initialValueRef.current;
        setValue(newVal as T);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      isMounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  const setter = (newValue: T) => {
    setValue(newValue);
    chrome.storage.session.set({ [key]: newValue });
  };

  return [value, setter, isLoaded];
}
