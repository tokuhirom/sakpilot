import { useState, useEffect, useCallback } from 'react';
import { GetContainerRegistryUsers } from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface ContainerRegistryDetailProps {
  profile: string;
  registry: sakura.ContainerRegistryInfo;
}

export function ContainerRegistryDetail({ profile, registry }: ContainerRegistryDetailProps) {
  const [users, setUsers] = useState<sakura.ContainerRegistryUserInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!profile || !registry.id) return;

    setLoading(true);
    try {
      const userList = await GetContainerRegistryUsers(profile, registry.id);
      setUsers(userList || []);
    } catch (err) {
      console.error('[ContainerRegistryDetail] loadUsers error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, registry.id]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="container-registry-detail">
      <div className="header">
        <h2>コンテナレジストリ詳細: {registry.name}</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
        <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>ID</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{registry.id}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>FQDN</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{registry.fqdn}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>説明</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{registry.description || '-'}</td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>アクセスレベル</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                <span className={`status ${registry.accessLevel === 'readwrite' ? 'up' : ''}`}>
                  {registry.accessLevel === 'readwrite' ? '読み書き' :
                   registry.accessLevel === 'readonly' ? '読み取り専用' :
                   registry.accessLevel === 'none' ? '非公開' : registry.accessLevel}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>仮想ドメイン</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{registry.virtualDomain || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>ユーザー一覧</h3>
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ユーザー名</th>
              <th>権限</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((user, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{user.userName}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status ${user.permission === 'readwrite' ? 'up' : ''}`}>
                      {user.permission === 'readwrite' ? '読み書き' :
                       user.permission === 'readonly' ? '読み取り専用' : user.permission}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  ユーザーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
