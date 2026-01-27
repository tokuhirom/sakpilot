import { useState, useEffect } from 'react';
import { PreviewGzipJSONL } from '../../wailsjs/go/main/App';

interface JSONLPreviewProps {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucketName: string;
  objectKey: string;
  onClose: () => void;
}

export function JSONLPreview({
  endpoint,
  accessKey,
  secretKey,
  bucketName,
  objectKey,
  onClose,
}: JSONLPreviewProps) {
  const [lines, setLines] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [totalRead, setTotalRead] = useState(0);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await PreviewGzipJSONL(
          endpoint,
          accessKey,
          secretKey,
          bucketName,
          objectKey,
          100 // max 100 lines
        );
        if (result.error) {
          setError(result.error);
        }
        setLines(result.lines || []);
        setTruncated(result.truncated);
        setTotalRead(result.totalRead);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [endpoint, accessKey, secretKey, bucketName, objectKey]);

  const toggleExpand = (index: number) => {
    setExpandedLines(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const formatJSON = (obj: unknown, expanded: boolean): string => {
    if (expanded) {
      return JSON.stringify(obj, null, 2);
    }
    const str = JSON.stringify(obj);
    if (str.length > 200) {
      return str.substring(0, 200) + '...';
    }
    return str;
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
            <h3 style={{ margin: 0 }}>JSONL Preview</h3>
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
          ) : lines.length === 0 ? (
            <div style={{ color: '#888' }}>データがありません</div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#888' }}>
                {totalRead} 行読み込み {truncated && '(一部のみ表示)'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lines.map((line, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#2a2a2a',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() => toggleExpand(index)}
                      style={{
                        padding: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                      }}
                    >
                      <span style={{ color: '#666', fontSize: '0.75rem', minWidth: '3rem' }}>
                        #{index + 1}
                      </span>
                      <pre style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        whiteSpace: expandedLines.has(index) ? 'pre-wrap' : 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        color: '#e0e0e0',
                      }}>
                        {formatJSON(line, expandedLines.has(index))}
                      </pre>
                      <span style={{ color: '#666', fontSize: '0.75rem' }}>
                        {expandedLines.has(index) ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
