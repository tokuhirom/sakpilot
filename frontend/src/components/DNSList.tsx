import { useState, useEffect, useCallback } from 'react';
import { GetDNSList, DeleteDNS } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useSearch } from '../hooks/useSearch';
import { useGlobalReload } from '../hooks/useGlobalReload';
import { SearchBar } from './SearchBar';

interface DNSListProps {
  profile: string;
  onSelectDNS: (id: string) => void;
}

export function DNSList({ profile, onSelectDNS }: DNSListProps) {
  const [dnsList, setDnsList] = useState<sakura.DNSInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<sakura.DNSInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useGlobalReload(loadDNS);

  // profile が変更されたら DNS 一覧を再取得
  useEffect(() => {
    console.log('[DNSList] useEffect triggered:', { profile });
    loadDNS();
  }, [loadDNS]);

  const handleDeleteClick = (e: React.MouseEvent, dns: sakura.DNSInfo) => {
    e.stopPropagation();
    setConfirmDelete(dns);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const dns = confirmDelete;
    setConfirmDelete(null);
    setDeleting(dns.id);
    try {
      await DeleteDNS(profile, dns.id);
      await loadDNS();
    } catch (e) {
      alert(`削除に失敗しました: ${e}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="header">
        <h2>DNS</h2>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredDnsList.map((dns) => (
              <tr key={dns.id} onClick={() => onSelectDNS(dns.id)} style={{ cursor: 'pointer' }} className="row-hover">
                <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{dns.name}</td>
                <td>{dns.zone}</td>
                <td>{dns.description || '-'}</td>
                <td style={{ textAlign: 'left' }}>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, dns)}
                    disabled={deleting === dns.id}
                    title="削除"
                  >
                    {deleting === dns.id ? '削除中...' : '削除'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmDelete && (
        <div className="confirm-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>DNSゾーン「{confirmDelete.name}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。登録されているレコードもすべて削除されます。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
