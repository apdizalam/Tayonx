import { useEffect, useState } from 'react';
import { getAdminChats, getAdminConversation, updateChatReport } from '../lib/api.js';
import Icon from './Icon.jsx';

const reportStatusLabels = {
  open: 'Open',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function AdminChats() {
  const [conversations, setConversations] = useState([]);
  const [reports, setReports] = useState([]);
  const [tab, setTab] = useState('reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyReportId, setBusyReportId] = useState('');
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

  async function inspectConversation(userIds, title) {
    setConversationLoading(true);
    setConversationError('');
    setActiveConversation({ title, messages: [] });
    try {
      const result = await getAdminConversation(userIds[0], userIds[1]);
      setActiveConversation({ title: `${title} · ${result.participants.map((participant) => participant.name).join(' · ')}`, messages: result.messages || [] });
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
      const { report: updatedReport } = await updateChatReport(reportId, { status });
      setReports((current) => current.map((report) => report.id === reportId ? updatedReport : report));
      setFeedback(`Report marked ${reportStatusLabels[status].toLowerCase()}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyReportId('');
    }
  }

  const reportCount = reports.filter((report) => ['open', 'reviewed'].includes(report.status)).length;

  return (
    <>
      <section className="dashboard-card admin-moderation-card">
        <div className="card-heading admin-moderation-heading">
          <div><h2>Chats &amp; reports</h2><p>{conversations.length} conversations · {reportCount} reports awaiting action</p></div>
          <button type="button" className="customer-outline-button" onClick={() => loadChats()} disabled={loading}><Icon name="refresh" size={14} />Refresh</button>
        </div>
        <div className="admin-chat-tabs" role="tablist" aria-label="Chat administration views">
          <button type="button" role="tab" aria-selected={tab === 'reports'} className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Reports <span>{reportCount}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'conversations'} className={tab === 'conversations' ? 'active' : ''} onClick={() => setTab('conversations')}>Conversations <span>{conversations.length}</span></button>
        </div>
        {error && <p className="admin-inline-error" role="alert">{error}</p>}
        {feedback && <p className="admin-inline-success" role="status">{feedback}</p>}
        {loading ? <p className="empty-table" role="status">Loading chat records…</p> : tab === 'reports'
          ? <div className="table-scroll"><table className="data-table admin-moderation-table">
            <thead><tr><th>Reporter</th><th>Reported user</th><th>Reason</th><th>Details</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{reports.map((report) => <tr key={report.id}>
              <td><span className="table-primary">{report.reporter?.name || 'Deleted user'}</span><span className="table-secondary">{report.reporter?.role || ''}</span></td>
              <td><span className="table-primary">{report.reportedUser?.name || 'Deleted user'}</span><span className="table-secondary">{report.reportedUser?.role || ''}</span></td>
              <td><span className="admin-report-reason">{report.reason}</span></td>
              <td className="admin-report-details">{report.details || report.message?.text || 'No additional details'}</td>
              <td>{formatDate(report.createdAt)}</td>
              <td><span className={`admin-report-status status-${report.status}`}>{reportStatusLabels[report.status] || report.status}</span></td>
              <td><div className="table-buttons admin-moderation-actions">
                {report.reporter?.id && report.reportedUser?.id && <button type="button" className="icon-button table-action" aria-label={`Inspect conversation reported by ${report.reporter.name}`} onClick={() => inspectConversation([report.reporter.id, report.reportedUser.id], 'Reported conversation')}><Icon name="eye" size={16} /></button>}
                {['open', 'reviewed'].includes(report.status) && <>
                  <button type="button" className="small-primary" disabled={busyReportId === report.id} onClick={() => moderateReport(report.id, 'resolved')}>{busyReportId === report.id ? 'Saving…' : 'Resolve'}</button>
                  <button type="button" className="customer-outline-button" disabled={busyReportId === report.id} onClick={() => moderateReport(report.id, 'dismissed')}>Dismiss</button>
                </>}
                {report.status === 'open' && <button type="button" className="text-button" disabled={busyReportId === report.id} onClick={() => moderateReport(report.id, 'reviewed')}>Mark reviewed</button>}
              </div></td>
            </tr>)}
            {!reports.length && <tr><td className="empty-table" colSpan="7">No chat reports have been submitted.</td></tr>}</tbody>
          </table></div>
          : <div className="table-scroll"><table className="data-table admin-moderation-table">
            <thead><tr><th>Participants</th><th>Messages</th><th>Last message</th><th>Last activity</th><th>Actions</th></tr></thead>
            <tbody>{conversations.map((conversation) => {
              return <tr key={conversation.id}>
                <td>{conversation.participants.map((participant) => <span className="admin-chat-participant" key={participant.id}>{participant.name}<small>{participant.role}</small></span>)}</td>
                <td>{conversation.messageCount}</td>
                <td className="admin-report-details">{conversation.lastMessage.text}</td>
                <td>{formatDate(conversation.lastMessage.createdAt)}</td>
                <td>{conversation.participants.length === 2 && <button type="button" className="customer-outline-button" onClick={() => inspectConversation(conversation.participants.map((participant) => participant.id), 'Conversation')}><Icon name="eye" size={14} />Inspect</button>}</td>
              </tr>;
            })}
            {!conversations.length && <tr><td className="empty-table" colSpan="5">No conversations have been started.</td></tr>}</tbody>
          </table></div>}
      </section>

      {activeConversation && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveConversation(null); }}>
        <section className="request-modal admin-chat-inspector" role="dialog" aria-modal="true" aria-labelledby="admin-chat-inspector-title">
          <div className="modal-heading"><div><p className="eyebrow">MESSAGE LOG</p><h2 id="admin-chat-inspector-title">{activeConversation.title}</h2></div><button type="button" className="icon-button" aria-label="Close conversation inspector" onClick={() => setActiveConversation(null)}><Icon name="close" /></button></div>
          {conversationLoading ? <p className="empty-table" role="status">Loading conversation…</p>
            : conversationError ? <p className="admin-inline-error" role="alert">{conversationError}</p>
              : <div className="admin-inspector-messages">{activeConversation.messages.map((message) => <article className="admin-inspector-message" key={message.id}>
                <div><strong>{message.sender?.name || 'Deleted user'}</strong><time>{formatDate(message.createdAt)}</time></div>
                <p>{message.text}</p>
              </article>)}
            {!conversationLoading && !conversationError && !activeConversation.messages.length && <p className="empty-table">This conversation has no messages.</p>}</div>}
        </section>
      </div>}
    </>
  );
}
