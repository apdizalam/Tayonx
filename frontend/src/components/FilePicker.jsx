import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * File input with preview and drag & drop.
 * variant "photo": round avatar picker. variant "document": card-style drop zone.
 */
export default function FilePicker({
  id,
  label,
  hint,
  accept,
  file,
  error,
  required = false,
  variant = 'document',
  onChange,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(() => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : ''), [file]);

  // Free the preview URL when the file changes or the picker unmounts.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function choose(nextFile) {
    onChange(nextFile || null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const input = (
    <input
      ref={inputRef}
      id={id}
      className="file-picker-input"
      type="file"
      accept={accept}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      onChange={(event) => choose(event.target.files?.[0])}
    />
  );

  if (variant === 'photo') {
    return (
      <div className={`account-field photo-picker${error ? ' has-error' : ''}`}>
        <span className="account-field-label">{label}{!required && <em>Optional</em>}</span>
        <div className="photo-picker-body">
          <span className="photo-picker-preview" aria-hidden="true">
            {previewUrl ? <img src={previewUrl} alt="" /> : <Icon name="camera" size={22} />}
          </span>
          <div className="photo-picker-actions">
            <label htmlFor={id} className="file-picker-button">
              <Icon name="upload" size={15} />{file ? 'Change photo' : 'Upload photo'}
            </label>
            {input}
            {file && <button type="button" className="file-picker-remove" onClick={() => choose(null)}>Remove</button>}
            {hint && <small id={`${id}-hint`}>{hint}</small>}
          </div>
        </div>
        {error && <p className="account-field-error" id={`${id}-error`} role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`account-field document-picker${error ? ' has-error' : ''}`}>
      <span className="account-field-label">{label}{required && <b aria-hidden="true">*</b>}</span>
      <label
        htmlFor={id}
        className={`document-dropzone${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); }}
      >
        {file ? (
          <>
            <span className="document-thumb">{previewUrl ? <img src={previewUrl} alt="" /> : <Icon name="file" size={22} />}</span>
            <span className="document-meta"><strong>{file.name}</strong><small>{formatSize(file.size)} · click to replace</small></span>
          </>
        ) : (
          <>
            <span className="document-thumb empty"><Icon name="upload" size={20} /></span>
            <span className="document-meta"><strong>Click to upload or drag a file here</strong><small>{hint}</small></span>
          </>
        )}
      </label>
      {input}
      {file && <button type="button" className="file-picker-remove" onClick={() => choose(null)}>Remove file</button>}
      {error && <p className="account-field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
