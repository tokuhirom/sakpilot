import { useState, useEffect, useCallback } from 'react';
import {
  GetContainerRegistryUsers,
  SaveContainerRegistrySecret,
  GetContainerRegistrySecret,
  DeleteContainerRegistrySecret,
  HasContainerRegistrySecret,
  ListContainerRegistryImages,
  GetContainerRegistryImageTags,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';

interface ContainerRegistryDetailProps {
  profile: string;
  registry: sakura.ContainerRegistryInfo;
}

interface UserWithSecret extends sakura.ContainerRegistryUserInfo {
  hasSavedSecret?: boolean;
}

type ViewMode = 'info' | 'tags';

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export function ContainerRegistryDetail({ profile, registry }: ContainerRegistryDetailProps) {
  const [users, setUsers] = useState<UserWithSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Image list state
  const [images, setImages] = useState<sakura.RegistryImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // Tags view state
  const [viewMode, setViewMode] = useState<ViewMode>('info');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [tags, setTags] = useState<sakura.RegistryTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  // Active credentials
  const [activeUserName, setActiveUserName] = useState<string | null>(null);
  const [activePassword, setActivePassword] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!profile || !registry.id) return;

    setLoading(true);
    try {
      const userList = await GetContainerRegistryUsers(profile, registry.id);
      // Check which users have saved secrets
      const usersWithSecret: UserWithSecret[] = await Promise.all(
        (userList || []).map(async (user) => {
          const hasSaved = await HasContainerRegistrySecret(registry.id, user.userName);
          return { ...user, hasSavedSecret: hasSaved };
        })
      );
      setUsers(usersWithSecret);

      // Find first all-permission user with saved secret
      const savedAllUser = usersWithSecret.find(
        u => u.permission === 'all' && u.hasSavedSecret
      );
      if (savedAllUser) {
        const savedPassword = await GetContainerRegistrySecret(registry.id, savedAllUser.userName);
        if (savedPassword) {
          setActiveUserName(savedAllUser.userName);
          setActivePassword(savedPassword);
        }
      }
    } catch (err) {
      console.error('[ContainerRegistryDetail] loadUsers error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, registry.id]);

  const loadImages = useCallback(async () => {
    if (!activeUserName || !activePassword) return;

    setLoadingImages(true);
    setImagesError(null);
    try {
      const imageList = await ListContainerRegistryImages(
        registry.fqdn,
        activeUserName,
        activePassword
      );
      setImages(imageList || []);
    } catch (err) {
      console.error('[ContainerRegistryDetail] loadImages error:', err);
      setImagesError(err instanceof Error ? err.message : String(err));
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }, [registry.fqdn, activeUserName, activePassword]);

  const loadTags = useCallback(async (imageName: string) => {
    if (!activeUserName || !activePassword) return;

    setLoadingTags(true);
    setTagsError(null);
    try {
      const tagList = await GetContainerRegistryImageTags(
        registry.fqdn,
        activeUserName,
        activePassword,
        imageName
      );
      setTags(tagList || []);
    } catch (err) {
      console.error('[ContainerRegistryDetail] loadTags error:', err);
      setTagsError(err instanceof Error ? err.message : String(err));
      setTags([]);
    } finally {
      setLoadingTags(false);
    }
  }, [registry.fqdn, activeUserName, activePassword]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeUserName && activePassword) {
      loadImages();
    }
  }, [activeUserName, activePassword, loadImages]);

  const handleSavePassword = async (userName: string) => {
    if (!password) return;

    setSavingPassword(true);
    try {
      await SaveContainerRegistrySecret(registry.id, userName, password);
      // Update users list
      setUsers(prev =>
        prev.map(u =>
          u.userName === userName ? { ...u, hasSavedSecret: true } : u
        )
      );
      // Set as active
      setActiveUserName(userName);
      setActivePassword(password);
      setSelectedUser(null);
      setPassword('');
    } catch (err) {
      console.error('[ContainerRegistryDetail] save password error:', err);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeletePassword = async (userName: string) => {
    try {
      await DeleteContainerRegistrySecret(registry.id, userName);
      setUsers(prev =>
        prev.map(u =>
          u.userName === userName ? { ...u, hasSavedSecret: false } : u
        )
      );
      if (activeUserName === userName) {
        setActiveUserName(null);
        setActivePassword(null);
        setImages([]);
      }
    } catch (err) {
      console.error('[ContainerRegistryDetail] delete password error:', err);
    }
  };

  const handleImageClick = (imageName: string) => {
    setSelectedImage(imageName);
    setViewMode('tags');
    setTags([]);
    loadTags(imageName);
  };

  const handleBackToImages = () => {
    setViewMode('info');
    setSelectedImage(null);
    setTags([]);
  };

  // Tags view
  if (viewMode === 'tags' && selectedImage) {
    return (
      <div className="container-registry-detail">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handleBackToImages}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            >
              ← 戻る
            </button>
            <h2>{selectedImage} のタグ一覧</h2>
          </div>
          <button
            className="btn-reload"
            onClick={() => loadTags(selectedImage)}
            disabled={loadingTags}
            title="リロード"
          >
            ↻
          </button>
        </div>

        {tagsError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#3d1f1f',
            borderRadius: '4px',
            color: '#ff6b6b',
            fontSize: '0.85rem'
          }}>
            エラー: {tagsError}
          </div>
        )}

        {loadingTags ? (
          <div className="loading">読み込み中...</div>
        ) : tags.length === 0 ? (
          <div className="empty-state">タグがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>タグ名</th>
                <th>サイズ</th>
                <th>ダイジェスト</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.name}>
                  <td style={{ fontFamily: 'monospace', color: '#00adb5' }}>{tag.name}</td>
                  <td>{tag.size > 0 ? formatSize(tag.size) : '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#888' }}>
                    {tag.digest ? tag.digest.substring(0, 20) + '...' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // Main view
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
      <div style={{
        marginBottom: '1rem',
        padding: '0.75rem',
        backgroundColor: '#1a1a2e',
        borderRadius: '4px',
        fontSize: '0.85rem',
        color: '#888'
      }}>
        all権限のユーザーのパスワードを保存すると、イメージ一覧を表示できます
      </div>
      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ユーザー名</th>
              <th>権限</th>
              <th style={{ width: '200px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((user, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>
                    {user.userName}
                    {user.hasSavedSecret && (
                      <span style={{ marginLeft: '0.5rem', color: '#4ade80', fontSize: '0.75rem' }}>
                        (保存済み)
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <span className={`status ${user.permission === 'all' ? 'up' : ''}`}>
                      {user.permission === 'all' ? '全権限' :
                       user.permission === 'readwrite' ? '読み書き' :
                       user.permission === 'readonly' ? '読み取り専用' : user.permission}
                    </span>
                  </td>
                  <td>
                    {user.permission === 'all' && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {selectedUser === user.userName ? (
                          <>
                            <input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="パスワード"
                              style={{
                                flex: 1,
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #444',
                                backgroundColor: '#0f0f1a',
                                color: '#fff',
                                fontSize: '0.8rem',
                              }}
                            />
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSavePassword(user.userName)}
                              disabled={savingPassword || !password}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              保存
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setSelectedUser(null);
                                setPassword('');
                              }}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            {user.hasSavedSecret ? (
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleDeletePassword(user.userName)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                削除
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary"
                                onClick={() => setSelectedUser(user.userName)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                パスワード設定
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {user.permission !== 'all' && (
                      <span style={{ color: '#666', fontSize: '0.8rem' }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  ユーザーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Image list section */}
      {activeUserName && activePassword && (
        <>
          <h3 style={{ marginTop: '2rem' }}>イメージ一覧</h3>
          {imagesError && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#3d1f1f',
              borderRadius: '4px',
              color: '#ff6b6b',
              fontSize: '0.85rem'
            }}>
              エラー: {imagesError}
            </div>
          )}
          {loadingImages ? (
            <div className="loading">読み込み中...</div>
          ) : images.length === 0 ? (
            <div className="empty-state">イメージがありません</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>イメージ名</th>
                </tr>
              </thead>
              <tbody>
                {images.map((image) => (
                  <tr
                    key={image.name}
                    onClick={() => handleImageClick(image.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ color: '#00adb5', fontFamily: 'monospace' }}>
                      {image.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
