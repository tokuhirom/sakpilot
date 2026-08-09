import { useState, useEffect, useCallback } from 'react';
import {
  GetContainerRegistries,
  GetContainerRegistryUsers,
  SaveContainerRegistrySecret,
  GetContainerRegistrySecret,
  DeleteContainerRegistrySecret,
  HasContainerRegistrySecret,
  ListContainerRegistryImages,
  GetContainerRegistryImageTags,
  UpdateContainerRegistry,
  AddContainerRegistryUser,
  UpdateContainerRegistryUser,
  DeleteContainerRegistryUser,
} from '../../wailsjs/go/main/App';
import { sakura } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface ContainerRegistryDetailProps {
  profile: string;
  registryId: string;
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

export function ContainerRegistryDetail({ profile, registryId }: ContainerRegistryDetailProps) {
  const [registry, setRegistry] = useState<sakura.ContainerRegistryInfo | null>(null);
  const [users, setUsers] = useState<UserWithSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Basic info inline edit
  const [editingBasic, setEditingBasic] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [accessLevelInput, setAccessLevelInput] = useState('none');
  const [virtualDomainInput, setVirtualDomainInput] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  // User add/edit
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPermission, setNewUserPermission] = useState('readwrite');
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserPermission, setEditUserPermission] = useState('readwrite');
  const [savingUser, setSavingUser] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);

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

  // Load registry details
  useEffect(() => {
    if (!profile || !registryId) return;

    const loadRegistry = async () => {
      try {
        const registries = await GetContainerRegistries(profile);
        const found = registries?.find(r => r.id === registryId);
        if (found) {
          setRegistry(found);
        }
      } catch (err) {
        console.error('[ContainerRegistryDetail] loadRegistry error:', err);
      }
    };
    loadRegistry();
  }, [profile, registryId]);

  const loadUsers = useCallback(async () => {
    if (!profile || !registryId) return;

    setLoading(true);
    try {
      const userList = await GetContainerRegistryUsers(profile, registryId);
      // Check which users have saved secrets
      const usersWithSecret: UserWithSecret[] = await Promise.all(
        (userList || []).map(async (user) => {
          const hasSaved = await HasContainerRegistrySecret(registryId, user.userName);
          return { ...user, hasSavedSecret: hasSaved };
        })
      );
      setUsers(usersWithSecret);

      // Find first all-permission user with saved secret
      const savedAllUser = usersWithSecret.find(
        u => u.permission === 'all' && u.hasSavedSecret
      );
      if (savedAllUser) {
        const savedPassword = await GetContainerRegistrySecret(registryId, savedAllUser.userName);
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
  }, [profile, registryId]);

  const loadImages = useCallback(async () => {
    if (!activeUserName || !activePassword || !registry) return;

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
  }, [registry, activeUserName, activePassword]);

  const loadTags = useCallback(async (imageName: string) => {
    if (!activeUserName || !activePassword || !registry) return;

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
  }, [registry, activeUserName, activePassword]);

  const handleGlobalReload = useCallback(() => {
    if (viewMode === 'tags' && selectedImage) {
      loadTags(selectedImage);
    } else {
      loadUsers();
      if (activeUserName && activePassword) {
        loadImages();
      }
    }
  }, [viewMode, selectedImage, loadUsers, loadImages, loadTags, activeUserName, activePassword]);

  useGlobalReload(handleGlobalReload);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (activeUserName && activePassword) {
      loadImages();
    }
  }, [activeUserName, activePassword, loadImages]);

  const handleSavePassword = async (e: React.FormEvent, userName: string) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await SaveContainerRegistrySecret(registryId, userName, password);
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
      await DeleteContainerRegistrySecret(registryId, userName);
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

  const handleBasicEditStart = () => {
    if (!registry) return;
    setNameInput(registry.name);
    setDescriptionInput(registry.description || '');
    setAccessLevelInput(registry.accessLevel === 'readonly' ? 'readonly' : 'none');
    setVirtualDomainInput(registry.virtualDomain || '');
    setBasicError(null);
    setEditingBasic(true);
  };

  const handleBasicEditCancel = () => {
    setEditingBasic(false);
    setBasicError(null);
  };

  const handleBasicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    setBasicError(null);
    try {
      const updated = await UpdateContainerRegistry(
        profile, registryId, nameInput, descriptionInput, accessLevelInput, virtualDomainInput
      );
      setRegistry(updated);
      setEditingBasic(false);
    } catch (e) {
      setBasicError(String(e));
    } finally {
      setSavingBasic(false);
    }
  };

  const handleAddUserOpen = () => {
    setNewUserName('');
    setNewUserPassword('');
    setNewUserPermission('readwrite');
    setAddUserError(null);
    setShowAddUser(true);
  };

  const handleAddUserCancel = () => {
    setShowAddUser(false);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    setAddUserError(null);
    try {
      await AddContainerRegistryUser(profile, registryId, newUserName, newUserPassword, newUserPermission);
      setShowAddUser(false);
      await loadUsers();
    } catch (e) {
      setAddUserError(String(e));
    } finally {
      setAddingUser(false);
    }
  };

  const handleEditUserOpen = (user: UserWithSecret) => {
    setEditingUser(user.userName);
    setEditUserPassword('');
    setEditUserPermission(user.permission || 'readwrite');
    setEditUserError(null);
  };

  const handleEditUserCancel = () => {
    setEditingUser(null);
    setEditUserError(null);
  };

  const handleEditUserSave = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    setEditUserError(null);
    try {
      await UpdateContainerRegistryUser(profile, registryId, editingUser, editUserPassword, editUserPermission);
      setEditingUser(null);
      await loadUsers();
    } catch (e) {
      setEditUserError(String(e));
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUserClick = (userName: string) => {
    setConfirmDeleteUser(userName);
  };

  const handleDeleteUserCancel = () => {
    setConfirmDeleteUser(null);
  };

  const handleDeleteUserConfirm = async () => {
    if (!confirmDeleteUser) return;
    const userName = confirmDeleteUser;
    setConfirmDeleteUser(null);
    setDeletingUser(userName);
    try {
      await DeleteContainerRegistryUser(profile, registryId, userName);
      await loadUsers();
    } catch (e) {
      alert(`ユーザーの削除に失敗しました: ${e}`);
    } finally {
      setDeletingUser(null);
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

  // Loading state
  if (!registry) {
    return (
      <div className="container-registry-detail">
        <div className="loading">読み込み中...</div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ color: '#00adb5', margin: 0 }}>基本情報</h4>
          {!editingBasic && (
            <button className="btn btn-secondary btn-small" onClick={handleBasicEditStart}>編集</button>
          )}
        </div>
        {editingBasic ? (
          <form onSubmit={handleBasicSave}>
            <div className="form-group">
              <label>名前<span className="required-mark">*</span></label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>説明</label>
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="任意"
                maxLength={512}
              />
            </div>
            <div className="form-group">
              <label>アクセスレベル</label>
              <select
                value={accessLevelInput}
                onChange={(e) => setAccessLevelInput(e.target.value)}
              >
                <option value="none">非公開</option>
                <option value="readonly">読み取り専用で公開</option>
              </select>
            </div>
            <div className="form-group">
              <label>仮想ドメイン</label>
              <input
                type="text"
                value={virtualDomainInput}
                onChange={(e) => setVirtualDomainInput(e.target.value)}
                placeholder="任意"
              />
            </div>
            {basicError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {basicError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleBasicEditCancel} disabled={savingBasic}>キャンセル</button>
              <button type="submit" className="btn btn-primary" disabled={savingBasic}>
                {savingBasic ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        ) : (
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
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>ユーザー一覧</h3>
        <button className="btn btn-primary btn-small" onClick={handleAddUserOpen}>+ ユーザー追加</button>
      </div>
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
              <th style={{ width: '200px' }}>資格情報</th>
              <th style={{ width: '160px' }}>操作</th>
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
                    {editingUser === user.userName ? (
                      <select
                        value={editUserPermission}
                        onChange={(e) => setEditUserPermission(e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        <option value="all">全権限</option>
                        <option value="readwrite">読み書き</option>
                        <option value="readonly">読み取り専用</option>
                      </select>
                    ) : (
                      <span className={`status ${user.permission === 'all' ? 'up' : ''}`}>
                        {user.permission === 'all' ? '全権限' :
                         user.permission === 'readwrite' ? '読み書き' :
                         user.permission === 'readonly' ? '読み取り専用' : user.permission}
                      </span>
                    )}
                  </td>
                  <td>
                    {user.permission === 'all' && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {selectedUser === user.userName ? (
                          <form
                            onSubmit={(e) => handleSavePassword(e, user.userName)}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}
                          >
                            <input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="パスワード *"
                              required
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
                              type="submit"
                              className="btn btn-primary"
                              disabled={savingPassword}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setSelectedUser(null);
                                setPassword('');
                              }}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              取消
                            </button>
                          </form>
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
                  <td style={{ textAlign: 'left' }}>
                    {editingUser === user.userName ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleEditUserSave(); }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                      >
                        <input
                          type="password"
                          value={editUserPassword}
                          onChange={(e) => setEditUserPassword(e.target.value)}
                          placeholder="新しいパスワード(任意)"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        />
                        {editUserError && (
                          <span style={{ color: '#ff6b6b', fontSize: '0.75rem' }}>{editUserError}</span>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={savingUser}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            {savingUser ? '保存中...' : '保存'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleEditUserCancel}
                            disabled={savingUser}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleEditUserOpen(user)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ユーザー編集
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteUserClick(user.userName)}
                          disabled={deletingUser === user.userName}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {deletingUser === user.userName ? '削除中...' : 'ユーザー削除'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  ユーザーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {confirmDeleteUser && (
        <div className="confirm-overlay" onClick={handleDeleteUserCancel}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>ユーザー「{confirmDeleteUser}」を削除しますか？</p>
            <p className="confirm-warning">この操作は取り消せません。</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={handleDeleteUserCancel}>キャンセル</button>
              <button className="btn btn-danger" onClick={handleDeleteUserConfirm}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="modal-overlay" onClick={handleAddUserCancel} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
            padding: '20px', minWidth: '320px', maxWidth: '420px',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ユーザー追加</h3>
            <form onSubmit={handleAddUserSubmit}>
            <div className="form-group">
              <label>ユーザー名<span className="required-mark">*</span></label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>パスワード<span className="required-mark">*</span></label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>権限</label>
              <select
                value={newUserPermission}
                onChange={(e) => setNewUserPermission(e.target.value)}
              >
                <option value="all">全権限</option>
                <option value="readwrite">読み書き</option>
                <option value="readonly">読み取り専用</option>
              </select>
            </div>
            {addUserError && (
              <div style={{ marginBottom: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
                エラー: {addUserError}
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={handleAddUserCancel}>キャンセル</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={addingUser}
              >
                {addingUser ? '追加中...' : '追加する'}
              </button>
            </div>
            </form>
          </div>
        </div>
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
