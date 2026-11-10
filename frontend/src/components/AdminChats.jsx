import { useEffect, useState } from 'react';
import { getAdminChats, getAdminConversation, updateChatReport } from '../lib/api.js';
import Icon from './Icon.jsx';

// Admin "Support & Disputes": dispute queue (chat reports) and a conversation directory with a
// message-log inspector. Admins see full message history (users' "delete chat" only hides it on
// their own side), so reported conversations can always be reviewed.

const reportStatusLabels = { open: 'Open', reviewed: 'Under review', resolved: 'Resolved', dismissed: 'Dismissed' };
const reasonLabels = { harassment: 'Harassment', spam: 'Spam', fraud: 'Fraud or scam', inappropriate: 'Inappropriate', other: 'Other' };
const roleLabels = { customer: 'Customer', cargo_provider: 'Cargo company', individual_cargo: 'Individual', admin: 'Admin' };

function formatDate(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function Person({ person, fallback = 'Deleted user' }) {
  return (
    <span className="moderation-person">
      <span className="moderation-avatar" aria-hidden="true">{initials(person?.name || fallback)}</span>
      <span><b>{person?.name || fallback}</b><small>{roleLabels[person?.role] || person?.role || ''}</small></span>
    </span>
  );
}

export default function AdminChats() {
  const [conversations, setConversations] = useState([]);
  const [reports, setReports] = useState([]);
  const [tab, setTab] = useState('reports');
  const [reportFilter, setReportFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyReportId, setBusyReportId] = useState('');
  const [notes, setNotes] = useState({});
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');

  async function loadChats() {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminChats();
      setConversations(result.conversations || []);
      setReports(result.reports || []);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getAdminChats({ signal: controller.signal })
      .then((result) => {
        setConversations(result.conversations || []);
        setReports(result.reports || []);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!activeConversation) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setActiveConversation(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeConversation]);

  async function inspectConversation(userIds, title, highlightId = '') {
    setConversationLoading(true);
    setConversationError('');
    setActiveConversation({ title, messages: [], participants: [], highlightId });
    try {
      const result = await getAdminConversation(userIds[0], userIds[1]);
      setActiveConversation({ title, messages: result.messages || [], participants: result.participants || [], highlightId });
    } catch (requestError) {
      setConversationError(requestError.message);
    } finally {
      setConversationLoading(false);
    }
  }

  async function moderateReport(reportId, status) {
    setBusyReportId(reportId);
    setError('');
    setFeedback('');
    try {
      const { report: updatedReport } = await updateChatReport(reportId, { status, resolutionNote: notes[reportId] || '' });
      setReports((current) => current.map((report) => (report.id === reportId ? updatedReport : report)));
      setFeedback(`Report marked ${reportStatusLabels[status].toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyReportId('');
    }
  }

  const counts = {
    open: reports.filter((report) => report.status === 'open').length,
    reviewed: reports.filter((report) => report.status === 'reviewed').length,
    closed: reports.filter((report) => ['resolved', 'dismissed'].includes(report.status)).length,
  };
  const totalMessages = conversations.reduce((sum, conversation) => sum + (conversation.messageCount || 0), 0);
  const search = query.trim().toLowerCase();
  const matches = (...values) => !search || values.filter(Boolean).join(' ').toLowerCase().includes(search);

  const filters = [
    ['active', 'Needs action', (report) => ['open', 'reviewed'].includes(report.status)],
    ['open', 'Open', (report) => report.status === 'open'],
    ['reviewed', 'Under review', (report) => report.status === 'reviewed'],
    ['closed', 'Closed', (report) => ['resolved', 'dismissed'].includes(report.status)],
    ['all', 'All', () => true],
  ];
  const activeFilter = filters.find(([id]) => id === reportFilter) || filters[0];
  const visibleReports = reports.filter(activeFilter[2])
    .filter((report) => matches(report.reporter?.name, report.reportedUser?.name, report.reason, report.details, report.message?.text));
  const visibleConversations = conversations
    .filter((conversation) => matches(...conversation.participants.map((participant) => participant.name), conversation.lastMessage?.text));

  return (
    <>
      <section className="dashboard-card moderation-shell">
        <header className="moderation-header">
          <div>
            <h2>Support &amp; Disputes</h2>
            <p>Audit conversations between customers, cargo providers and Tayonx support, and resolve reported issues. Message history is always kept for review.</p>
          </div>
          <button type="button" className="customer-outline-button" onClick={() => loadChats()} disabled={loading}><Icon name="refresh" size={14} />Refresh</button>
        </header>

        <div className="moderation-stats">
          <article className={`moderation-stat tone-red${counts.open ? ' attention' : ''}`}><span><Icon name="alert" size={16} /></span><div><strong>{loading ? '—' : counts.open}</strong><small>Open reports</small></div></article>
          <article className="moderation-stat tone-amber"><span><Icon name="eye" size={16} /></span><div><strong>{loading ? '—' : counts.reviewed}</strong><small>Under review</small></div></article>
          <article className="moderation-stat tone-green"><span><Icon name="check" size={16} /></span><div><strong>{loading ? '—' : counts.closed}</strong><small>Resolved / dismissed</small></div></article>
          <article className="moderation-stat tone-blue"><span><Icon name="chat" size={16} /></span><div><strong>{loading ? '—' : conversations.length}</strong><small>Conversations</small></div></article>
          <article className="moderation-stat tone-navy"><span><Icon name="mail" size={16} /></span><div><strong>{loading ? '—' : totalMessages}</strong><small>Messages</small></div></article>
        </div>

        <div className="moderation-toolbar">
          <div className="moderation-tabs" role="tablist" aria-label="Chat administration views">
            <button type="button" role="tab" aria-selected={tab === 'reports'} className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}><Icon name="shield" size={14} />Reports<span>{counts.open + counts.reviewed}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'conversations'} className={tab === 'conversations' ? 'active' : ''} onClick={() => setTab('conversations')}><Icon name="chat" size={14} />Conversations<span>{conversations.length}</span></button>
          </div>
          <label className="search-box moderation-search">
            <Icon name="search" size={15} />
            <input aria-label={tab === 'reports' ? 'Search reports' : 'Search conversations'} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === 'reports' ? 'Search reports by name, reason or text…' : 'Search conversations…'} />
          </label>
        </div>

        {error && <p className="admin-inline-error" role="alert">{error}</p>}
        {feedback && <p className="admin-inline-success" role="status"><Icon name="check" size={14} />{feedback}</p>}

        {tab === 'reports' && (
          <>
            <div className="admin-request-tabs moderation-filters" role="tablist" aria-label="Filter reports">
              {filters.map(([id, label, match]) => <button type="button" role="tab" key={id} aria-selected={activeFilter[0] === id} className={`admin-request-tab${activeFilter[0] === id ? ' active' : ''}`} onClick={() => setReportFilter(id)}><span>{label}</span><b>{reports.filter(match).length}</b></button>)}
            </div>
            {loading ? <p className="empty-table" role="status">Loading reports…</p> : visibleReports.length ? (
              <ul className="moderation-report-list">
                {visibleReports.map((report) => {
                  const actionable = ['open', 'reviewed'].includes(report.status);
                  return (
                    <li key={report.id} className={`moderation-report status-${report.status}`}>
                      <div className="moderation-report-head">
                        <span className={`moderation-reason reason-${report.reason}`}>{reasonLabels[report.reason] || report.reason}</span>
                        <span className={`admin-report-status status-${report.status}`}>{reportStatusLabels[report.status] || report.status}</span>
                        <time>{formatDate(report.createdAt)}</time>
                      </div>
                      <div className="moderation-report-people">
                        <div><small>Reported by</small><Person person={report.reporter} /></div>
                        <Icon name="arrow" size={16} />
                        <div><small>Reported user</small><Person person={report.reportedUser} /></div>
                      </div>
                      <blockquote className="moderation-report-text">{report.details || report.message?.text || 'No additional details were given.'}</blockquote>
                      {!actionable && report.resolutionNote && <p className="moderation-resolution"><Icon name="check" size={13} />{report.resolutionNote}{report.resolvedBy?.name ? ` — ${report.resolvedBy.name}` : ''}</p>}
                      <div className="moderation-report-actions">
                        {report.reporter?.id && report.reportedUser?.id && <button type="button" className="customer-outline-button" onClick={() => inspectConversation([report.reporter.id, report.reportedUser.id], `${report.reporter.name} ↔ ${report.reportedUser.name}`, report.reportedUser.id)}><Icon name="eye" size={14} />View conversation</button>}
                        {actionable && <>
                          <input className="moderation-note" aria-label="Resolution note" placeholder="Resolution note (optional)" maxLength={1000} value={notes[report.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} />
                          {report.status === 'open' && <button type="button" className="customer-outline-button" disabled={busyReportId === report.id} onClick={() => moderateReport(report.id, 'reviewed')}>Start review</button>}
                          <button type="button" className="customer-outline-button" disabled={busyReportId === report.id} onClick={() => moderateReport(report.id, 'dismissed')}>Dismiss</button>
                          <button type="button" className="small-primary" disabled={busyReportId === report.id} onClick={() => moderateReport(report.id, 'resolved')}>{busyReportId === report.id ? 'Saving…' : 'Resolve'}</button>
                        </>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <div className="notification-empty"><span aria-hidden="true"><Icon name="shield" size={18} /></span><strong>{reports.length ? 'No reports match' : 'No chat reports yet'}</strong><p>{reports.length ? 'Try another filter or search.' : 'Reports submitted by customers and cargo providers appear here.'}</p></div>}
          </>
        )}

        {tab === 'conversations' && (loading ? <p className="empty-table" role="status">Loading conversations…</p> : visibleConversations.length ? (
          <div className="table-scroll">
            <table className="data-table moderation-table">
              <thead><tr><th>Participants</th><th>Last message</th><th>Messages</th><th>Last activity</th><th className="offer-actions-col">Actions</th></tr></thead>
              <tbody>{visibleConversations.map((conversation) => (
                <tr key={conversation.id} className="request-row-clickable" onClick={() => conversation.participants.length === 2 && inspectConversation(conversation.participants.map((participant) => participant.id), conversation.participants.map((participant) => participant.name).join(' ↔ '))}>
                  <td><span className="moderation-participants">{conversation.participants.map((participant) => <Person key={participant.id} person={participant} />)}</span></td>
                  <td className="moderation-last"><span>{conversation.lastMessage.text}</span></td>
                  <td><span className="request-offers-count">{conversation.messageCount}</span></td>
                  <td className="table-date">{formatDate(conversation.lastMessage.createdAt)}</td>
                  <td className="offer-actions-col" onClick={(event) => event.stopPropagation()}>{conversation.participants.length === 2 && <button type="button" className="offer-action-btn view" onClick={() => inspectConversation(conversation.participants.map((participant) => participant.id), conversation.participants.map((participant) => participant.name).join(' ↔ '))}><Icon name="eye" size={15} /><span>Inspect</span></button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="notification-empty"><span aria-hidden="true"><Icon name="chat" size={18} /></span><strong>{conversations.length ? 'No conversations match' : 'No conversations yet'}</strong><p>{conversations.length ? 'Try another search.' : 'Conversations between customers, providers and support appear here.'}</p></div>)}
      </section>

      {activeConversation && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveConversation(null); }}>
        <section className="request-modal admin-chat-inspector moderation-inspector" role="dialog" aria-modal="true" aria-labelledby="admin-chat-inspector-title">
          <div className="modal-heading"><div><p className="eyebrow">MESSAGE LOG · READ-ONLY</p><h2 id="admin-chat-inspector-title">{activeConversation.title}</h2></div><button type="button" className="icon-button" aria-label="Close conversation inspector" onClick={() => setActiveConversation(null)}><Icon name="close" /></button></div>
          {activeConversation.participants.length > 0 && <div className="moderation-inspector-people">{activeConversation.participants.map((participant) => <Person key={participant.id} person={participant} />)}<span className="moderation-inspector-count">{activeConversation.messages.length} message{activeConversation.messages.length === 1 ? '' : 's'}</span></div>}
          {conversationLoading ? <p className="empty-table" role="status">Loading conversation…</p>
            : conversationError ? <p className="admin-inline-error" role="alert">{conversationError}</p>
              : <div className="moderation-log">{activeConversation.messages.map((message) => {
                const flagged = activeConversation.highlightId && message.sender?.id === activeConversation.highlightId;
                const right = activeConversation.participants[1] && message.sender?.id === activeConversation.participants[1].id;
                return <article className={`moderation-log-message${right ? ' right' : ''}${flagged ? ' flagged' : ''}`} key={message.id}>
                  <div><strong>{message.sender?.name || 'Deleted user'}</strong><time>{formatDate(message.createdAt)}</time></div>
                  <p>{message.text}</p>
                </article>;
              })}
              {!activeConversation.messages.length && <p className="empty-table">This conversation has no messages.</p>}</div>}
        </section>
      </div>}
    </>
  );
}
