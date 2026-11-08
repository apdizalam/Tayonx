import Icon from './Icon.jsx';
import { useFileUrl } from '../lib/useFileUrl.js';

/** A profile photo stored on the server, with an initials fallback. */
export function ProtectedAvatar({ fileId, name = '', className = '' }) {
  const { url } = useFileUrl(fileId);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return (
    <span className={`protected-avatar ${className}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials}
    </span>
  );
}

function formatSize(bytes = 0) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Admin document preview card: image thumbnail or PDF icon, plus "Open" in a new tab. */
export function DocumentPreview({ label, file }) {
  const { url, error, loading } = useFileUrl(file?.id);
  if (!file) {
    return (
      <div className="document-preview missing">
        <span className="document-preview-thumb"><Icon name="alert" size={20} /></span>
        <span className="document-preview-meta"><strong>{label}</strong><small>Not provided</small></span>
      </div>
    );
  }
  const isImage = file.mimeType?.startsWith('image/');
  return (
    <div className="document-preview">
      <span className="document-preview-thumb">
        {loading ? <Icon name="clock" size={20} /> : isImage && url ? <img src={url} alt={`${label} preview`} /> : <Icon name="file" size={22} />}
      </span>
      <span className="document-preview-meta">
        <strong>{label}</strong>
        <small>{file.originalName || 'document'} · {file.mimeType === 'application/pdf' ? 'PDF' : 'Image'} · {formatSize(file.size)}</small>
        {error && <small className="document-preview-error">{error}</small>}
      </span>
      <a
        className={`customer-outline-button document-open${url ? '' : ' disabled'}`}
        href={url || undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!url}
        onClick={(event) => { if (!url) event.preventDefault(); }}
      ><Icon name="eye" size={14} />Open</a>
    </div>
  );
}
