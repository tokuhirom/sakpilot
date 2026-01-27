import { useState, useEffect } from 'react';
import { PreviewText } from '../../wailsjs/go/main/App';

interface TextPreviewProps {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  objectKey: string;
  onClose: () => void;
}

export function TextPreview({
  endpoint,
  accessKey,
  secretKey,
  bucketName,
  objectKey,
  onClose,
}: TextPreviewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [readSize, setReadSize] = useState(0);

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await PreviewText(
          endpoint,
          accessKey,
          secretKey,
          bucketName,
          objectKey,
          1024 * 1024 // 1MB max
        );
        if (result.error) {
          setError(result.error);
        }
        setContent(result.content || '');
        setTruncated(result.truncated);
        setTotalSize(result.totalSize);
        setReadSize(result.readSize);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [endpoint, accessKey, secretKey, bucketName, objectKey]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const getFileExtension = (key: string): string => {
    const parts = key.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  };

  const getLanguageClass = (key: string): string => {
    const ext = getFileExtension(key);
    const langMap: Record<string, string> = {
      'json': 'json',
      'md': 'markdown',
      'ini': 'ini',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'go': 'go',
      'sh': 'bash',
      'bash': 'bash',
    };
    return langMap[ext] || 'plaintext';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '8px',
        width: '90vw',
        maxWidth: '1200px',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          borderBottom: '1px solid #333',
        }}>
          <div>
            <h3 style={{ margin: 0 }}>Text Preview</h3>
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
              {objectKey}
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem' }}
          >
            閉じる
          </button>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1rem',
        }}>
          {loading ? (
            <div className="loading">読み込み中...</div>
          ) : error ? (
            <div style={{ color: '#ff6b6b' }}>エラー: {error}</div>
          ) : content.length === 0 ? (
            <div style={{ color: '#888' }}>ファイルが空です</div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#888' }}>
                {formatSize(readSize)} / {formatSize(totalSize)} 読み込み
                {truncated && ' (ファイルが大きいため一部のみ表示)'}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '1rem',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  color: '#e0e0e0',
                  fontFamily: 'monospace',
                }}
                className={`language-${getLanguageClass(objectKey)}`}
              >
                {content}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
