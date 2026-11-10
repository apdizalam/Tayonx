import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

function relativeTime(at, now) {
  const diff = now - at;
  const abs = Math.abs(diff);
  if (abs < 60 * 60 * 1000) return 'just now';
  if (abs < 24 * 60 * 60 * 1000) return diff >= 0 ? `${Math.floor(abs / (60 * 60 * 1000))} h ago` : 'today';
  const days = Math.round(abs / (24 * 60 * 60 * 1000));
  return diff >= 0 ? `${days} d ago` : `in ${days} d`;
}

/** One notification row; `compact` is used in the top-bar dropdown. */
function NotificationItem({ item, unread, now, onAction, onDismiss, compact = false }) {
  return (
    <li className={`notification-item tone-${item.tone}${unread ? ' unread' : ''}${compact ? ' compact' : ''}`}>
      <span className="notification-icon" aria-hidden="true"><Icon name={item.icon || 'bell'} size={compact ? 14 : 16} /></span>
      <span className="notification-copy">
        <strong>{item.title}{unread && <i className="notification-unread-dot" aria-label="Unread" />}</strong>
        <small>{item.text}</small>
        <span className="notification-meta">
          <time>{relativeTime(item.at, now)}</time>
          {item.action && <button type="button" className="link-button" onClick={() => onAction(item)}>{item.action.label}<Icon name="arrow" size={12} /></button>}
        </span>
      </span>
      {onDismiss && <button type="button" className="icon-button notification-dismiss" aria-label={`Dismiss: ${item.title}`} title="Dismiss" onClick={() => onDismiss(item)}><Icon name="close" size={14} /></button>}
    </li>
  );
}

/** List of notifications (dashboard card and full page). */
export function NotificationList({ items, seen, now, onAction, onDismiss, empty, compact = false, limit }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) {
    return <div className="notification-empty"><span aria-hidden="true"><Icon name="check" size={18} /></span><strong>{empty?.title || 'You’re all caught up'}</strong><p>{empty?.text || 'New alerts about your requests and shipments will appear here.'}</p></div>;
  }
  return <ul className="notification-list">{shown.map((item) => <NotificationItem key={item.id} item={item} unread={!seen.has(item.id)} now={now} onAction={onAction} onDismiss={onDismiss} compact={compact} />)}</ul>;
}

/** Top-bar bell with an unread badge and a dropdown of the latest notifications. */
export function NotificationBell({ items, seen, now, onAction, onDismiss, onMarkAllRead, onViewAll }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const unread = items.filter((item) => !seen.has(item.id)).length;

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onPointer); window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button type="button" className="notification-button" aria-haspopup="true" aria-expanded={open} aria-label={unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'} title="Notifications" onClick={() => setOpen((current) => !current)}>
        <Icon name="bell" size={16} />
        {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" className="link-button" onClick={onMarkAllRead}>Mark all as read</button>}
          </header>
          <NotificationList items={items} seen={seen} now={now} compact limit={6} onDismiss={onDismiss}
            onAction={(item) => { setOpen(false); onAction(item); }} />
          <footer><button type="button" className="link-button" onClick={() => { setOpen(false); onViewAll(); }}>View all notifications<Icon name="arrow" size={13} /></button></footer>
        </div>
      )}
    </div>
  );
}
