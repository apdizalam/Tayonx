import { useEffect, useState } from 'react';
import { loadFileUrl } from './api.js';

/**
 * Loads a protected upload (it needs the bearer token) as an object URL.
 * Returns { url, error, loading }. The URL is revoked automatically.
 */
export function useFileUrl(fileId) {
  const [result, setResult] = useState({ fileId: null, url: '', error: '' });

  useEffect(() => {
    if (!fileId) return undefined;
    const controller = new AbortController();
    let objectUrl = '';
    loadFileUrl(fileId, { signal: controller.signal })
      .then((url) => { objectUrl = url; setResult({ fileId, url, error: '' }); })
      .catch((error) => { if (error.name !== 'AbortError') setResult({ fileId, url: '', error: error.message }); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  const current = fileId && result.fileId === fileId;
  return {
    url: current ? result.url : '',
    error: current ? result.error : '',
    loading: Boolean(fileId) && !current,
  };
}
