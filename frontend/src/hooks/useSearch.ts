import { useState, useEffect, useRef, useCallback } from 'react';

export function useSearch<T>(
  items: T[],
  filterFn: (item: T, query: string) => boolean
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cmd+F で検索モードに入る
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearching(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && isSearching) {
        setIsSearching(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching]);

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setSearchQuery('');
  }, []);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    return filterFn(item, searchQuery.toLowerCase());
  });

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    setIsSearching,
    searchInputRef,
    filteredItems,
    closeSearch,
  };
}
