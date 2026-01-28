import { useEffect } from 'react';

/**
 * グローバルリロードイベントを購読するカスタムフック
 * トップバーのリロードボタンがクリックされたときに reloadFn が呼ばれる
 */
export function useGlobalReload(reloadFn: () => void) {
  useEffect(() => {
    const handler = () => reloadFn();
    window.addEventListener('app-reload', handler);
    return () => window.removeEventListener('app-reload', handler);
  }, [reloadFn]);
}

/**
 * グローバルリロードイベントを発火する
 */
export function triggerGlobalReload() {
  window.dispatchEvent(new CustomEvent('app-reload'));
}
