import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from './useSearch';

interface Item {
  name: string;
}

const items: Item[] = [
  { name: 'alpha' },
  { name: 'beta' },
  { name: 'gamma' },
];

describe('useSearch', () => {
  it('returns all items when the query is empty', () => {
    const { result } = renderHook(() => useSearch(items, (item, query) => item.name.includes(query)));
    expect(result.current.filteredItems).toEqual(items);
  });

  it('filters items using the provided matcher', () => {
    const { result } = renderHook(() => useSearch(items, (item, query) => item.name.includes(query)));

    act(() => {
      result.current.setSearchQuery('et');
    });

    expect(result.current.filteredItems).toEqual([{ name: 'beta' }]);
  });

  it('closeSearch resets both the query and the searching state', () => {
    const { result } = renderHook(() => useSearch(items, (item, query) => item.name.includes(query)));

    act(() => {
      result.current.setIsSearching(true);
      result.current.setSearchQuery('beta');
    });
    expect(result.current.filteredItems).toEqual([{ name: 'beta' }]);

    act(() => {
      result.current.closeSearch();
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.filteredItems).toEqual(items);
  });
});
