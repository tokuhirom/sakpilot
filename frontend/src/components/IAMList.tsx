import { useState, useEffect, useCallback } from 'react';
import { GetIAMUsers, GetIAMGroups, GetIAMRoles, GetIAMIDRoles } from '../../wailsjs/go/main/App';
import { iam } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface IAMListProps {
  profile: string;
}

type SubPage = 'users' | 'groups' | 'iamRoles' | 'idRoles';

const TAB_LABEL: Record<SubPage, string> = {
  users: 'ユーザー',
  groups: 'グループ',
  iamRoles: 'IAMロール',
  idRoles: 'IDロール',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString || '-';

  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
};

export function IAMList({ profile }: IAMListProps) {
  const [subPage, setSubPage] = useState<SubPage>('users');
  const [users, setUsers] = useState<iam.UserInfo[]>([]);
  const [groups, setGroups] = useState<iam.GroupInfo[]>([]);
  const [iamRoles, setIamRoles] = useState<iam.IAMRoleInfo[]>([]);
  const [idRoles, setIdRoles] = useState<iam.IDRoleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      if (subPage === 'users') {
        setUsers((await GetIAMUsers(profile)) || []);
      } else if (subPage === 'groups') {
        setGroups((await GetIAMGroups(profile)) || []);
      } else if (subPage === 'iamRoles') {
        setIamRoles((await GetIAMRoles(profile)) || []);
      } else {
        setIdRoles((await GetIAMIDRoles(profile)) || []);
      }
    } catch (err) {
      console.error(`[IAMList] loadData error (${subPage}):`, err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [profile, subPage]);

  useGlobalReload(loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderContent = () => {
    if (loading) return <div className="loading">読み込み中...</div>;
    if (error) return <div className="empty-state">読み込みに失敗しました: {error}</div>;

    if (subPage === 'users') {
      if (users.length === 0) return <div className="empty-state">ユーザーがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>ユーザーコード</th>
              <th>メールアドレス</th>
              <th>ステータス</th>
              <th>説明</th>
              <th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{u.code}</td>
                <td>{u.email || '-'}</td>
                <td>{u.status}</td>
                <td>{u.description || '-'}</td>
                <td>{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'groups') {
      if (groups.length === 0) return <div className="empty-state">グループがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>説明</th>
              <th>作成日</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id}>
                <td>{g.id}</td>
                <td>{g.name}</td>
                <td>{g.description || '-'}</td>
                <td>{formatDate(g.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (subPage === 'iamRoles') {
      if (iamRoles.length === 0) return <div className="empty-state">IAMロールがありません</div>;
      return (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>名前</th>
              <th>カテゴリ</th>
              <th>付与可能な最低階層</th>
              <th>説明</th>
            </tr>
          </thead>
          <tbody>
            {iamRoles.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.category}</td>
                <td>{r.lowestGrantableResource}</td>
                <td>{r.description || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (idRoles.length === 0) return <div className="empty-state">IDロールがありません</div>;
    return (
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名前</th>
            <th>説明</th>
          </tr>
        </thead>
        <tbody>
          {idRoles.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.name}</td>
              <td>{r.description || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <div className="header">
        <h2>IAM</h2>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        {(Object.keys(TAB_LABEL) as SubPage[]).map(key => (
          <button
            key={key}
            className={`btn ${subPage === key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubPage(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      {renderContent()}
    </>
  );
}
