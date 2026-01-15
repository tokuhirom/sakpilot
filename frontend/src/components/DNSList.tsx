import { useState, useEffect, useCallback } from 'react';
import { GetDNSList } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { SearchBar } from './SearchBar';

interface DNSListProps {
  profile: string;
  onSelectDNS: (id: string) => void;
}

export function DNSList({ profile, onSelectDNS }: DNSListProps) {
  const [dnsList, setDnsList] = useState<sakura.DNSInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchInputRef,
    filteredItems: filteredDnsList,
    closeSearch,
  } = useSearch(dnsList, (dns, query) =>
    dns.name.toLowerCase().includes(query) ||
    dns.zone.toLowerCase().includes(query) ||
    dns.description?.toLowerCase().includes(query) ||
    dns.id.includes(query)
  );

  const loadDNS = useCallback(async () => {
    if (!profile) {
      console.log('[DNSList] loadDNS skipped: profile is empty');
      return;
    }

    console.log('[DNSList] loadDNS called:', { profile });
    setLoading(true);
    try {
      const list = await GetDNSList(profile);
      console.log('[DNSList] DNS loaded:', list?.length ?? 0, 'zones');
      setDnsList(list || []);
    } catch (err) {
      console.error('[DNSList] loadDNS error:', err);
      setDnsList([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // profile が変更されたら DNS 一覧を再取得
  useEffect(() => {
    console.log('[DNSList] useEffect triggered:', { profile });
    loadDNS();
  }, [loadDNS]);

  return (
    <>
      <div className="header">
        <h2>DNS</h2>
        <button
          className="btn-reload"
          onClick={() => loadDNS()}
          disabled={loading}
          title="リロード"
        >
          ↻
        </button>
      </div>

      <SearchBar
        isSearching={isSearching}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        closeSearch={closeSearch}
        searchInputRef={searchInputRef}
        placeholder="名前、ゾーンで検索... (Escで閉じる)"
      />

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : filteredDnsList.length === 0 ? (
        <div className="empty-state">
          {searchQuery ? `「${searchQuery}」に一致するDNSゾーンがありません` : 'DNSゾーンがありません'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>名前</th>
              <th>ゾーン</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {filteredDnsList.map((dns) => (
              <tr key={dns.id} onClick={() => onSelectDNS(dns.id)} style={{ cursor: 'pointer' }} className="row-hover">
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{dns.name}</td>
                <td>{dns.zone}</td>
                <td>{dns.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
