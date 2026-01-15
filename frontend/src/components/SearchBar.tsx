import { RefObject } from 'react';

interface SearchBarProps {
  isSearching: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  closeSearch: () => void;
  searchInputRef: RefObject<HTMLInputElement>;
  placeholder?: string;
}

export function SearchBar({
  isSearching,
  searchQuery,
  setSearchQuery,
  closeSearch,
  searchInputRef,
  placeholder = '検索... (Escで閉じる)',
}: SearchBarProps) {
  if (!isSearching) {
    return (
      <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
        Cmd+F で検索
      </div>
    );
  }

  return (
    <div className="search-bar" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <input
        ref={searchInputRef}
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{
          flex: 1,
          padding: '0.5rem 0.75rem',
          borderRadius: '4px',
          border: '1px solid #444',
          backgroundColor: '#1a1a2e',
          color: '#fff',
          fontSize: '0.9rem',
        }}
      />
      <button
        className="btn btn-secondary"
        onClick={closeSearch}
        style={{ padding: '0.5rem 0.75rem' }}
      >
        閉じる
      </button>
    </div>
  );
}
