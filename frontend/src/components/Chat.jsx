import { useEffect, useRef, useState } from 'react';
import { getChatContacts, getChatHistory, reportChat } from '../lib/api.js';
import { createChatSocket } from '../socket.js';
import Icon from './Icon.jsx';

function contactRole(role) {
  return {
    customer: 'Customer',
    cargo_provider: 'Cargo provider',
    individual_cargo: 'Individual cargo',
    admin: 'Tayonx support',
  }[role] || role;
}

function contactId(message, field) {
  const value = message[field];
  return String(value?.id || value?._id || value || '');
}

function ChatAvatar({ name }) {
  const initials = (name || 'User').split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  return <span className="avatar">{initials}</span>;
}

function sortMessages(messages) {
  return [...new Map(messages.map((message) => [message.id, message])).values()]
    .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
}

export default function Chat({ user }) {
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('other');
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportFeedback, setReportFeedback] = useState('');
  const socketRef = useRef(null);
  const historyRef = useRef(null);
  const selectedContactIdRef = useRef('');
  const selectedContact = contacts.find((contact) => contact.id === selectedContactId);

  useEffect(() => {
    selectedContactIdRef.current = selectedContactId;
  }, [selectedContactId]);

  useEffect(() => {
    const controller = new AbortController();
    getChatContacts({ signal: controller.signal })
      .then(({ contacts: availableContacts }) => {
        const nextContacts = availableContacts || [];
        setContacts(nextContacts);
        const currentContactId = selectedContactIdRef.current;
        const nextContactId = currentContactId && nextContacts.some((contact) => contact.id === currentContactId)
          ? currentContactId
          : nextContacts[0]?.id || '';
        selectedContactIdRef.current = nextContactId;
        setSelectedContactId(nextContactId);
        setHistoryLoading(Boolean(nextContactId));
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setContactsError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setContactsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user?.id || !token) return undefined;
    const socket = createChatSocket(token);
    socketRef.current = socket;
    socket.on('connect', () => setConnectionState('connected'));
    socket.on('disconnect', () => setConnectionState('disconnected'));
    socket.on('connect_error', (connectError) => {
      setConnectionState('disconnected');
      setHistoryError(connectError.message || 'Chat connection failed.');
    });
    socket.on('receive_message', (message) => {
      const peerId = contactId(message, 'sender') === user.id
        ? contactId(message, 'recipient')
        : contactId(message, 'sender');
      setContacts((current) => {
        const existing = current.find((contact) => contact.id === peerId);
        if (!existing) return current;
        const updated = current.map((contact) => contact.id === peerId
          ? { ...contact, lastMessage: { text: message.text, createdAt: message.createdAt } }
          : contact);
        return updated.sort((first, second) => new Date(second.lastMessage?.createdAt || 0) - new Date(first.lastMessage?.createdAt || 0)
          || first.name.localeCompare(second.name));
      });
      if (peerId === selectedContactIdRef.current) {
        setMessages((current) => sortMessages([...current, message]));
      }
    });
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedContactId) return undefined;
    const controller = new AbortController();
    getChatHistory(selectedContactId, { signal: controller.signal })
      .then(({ messages: history }) => {
        if (!controller.signal.aborted) setMessages((current) => sortMessages([...(history || []), ...current]));
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setHistoryError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [selectedContactId]);

  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, selectedContactId]);

  function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    const socket = socketRef.current;
    if (!text || !selectedContactId || sending) return;
    if (!socket?.connected) {
      setHistoryError('Chat is disconnected. Reconnecting…');
      return;
    }
    setSending(true);
    setHistoryError('');
    socket.timeout(10000).emit('send_message', { recipientId: selectedContactId, text }, (timeoutError, result) => {
      setSending(false);
      if (timeoutError) {
        setHistoryError('Message could not be confirmed. Check your connection and try again.');
        return;
      }
      if (result?.error) {
        setHistoryError(result.error);
        return;
      }
      setDraft('');
    });
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!selectedContactId || reportSaving) return;
    setReportSaving(true);
    setReportError('');
    try {
      await reportChat(selectedContactId, { reason: reportReason, details: reportDetails });
      setReportOpen(false);
      setReportDetails('');
      setReportFeedback('Conversation report submitted to Tayonx support.');
    } catch (requestError) {
      setReportError(requestError.message);
    } finally {
      setReportSaving(false);
    }
  }

  return (
    <>
      <aside className="conversation-list">
        <div className="conversation-heading"><h2>Messages</h2><span className={`chat-connection-dot ${connectionState}`} title={connectionState} /></div>
        {contactsLoading ? <p className="chat-list-state" role="status">Loading contacts…</p>
          : contactsError ? <p className="chat-list-state chat-list-error" role="alert">{contactsError}</p>
            : contacts.length ? contacts.map((contact) => (
              <button
                type="button"
                className={`conversation-row${selectedContactId === contact.id ? ' selected' : ''}`}
                key={contact.id}
                onClick={() => {
                  selectedContactIdRef.current = contact.id;
                  setSelectedContactId(contact.id);
                  setMessages([]);
                  setHistoryLoading(true);
                  setHistoryError('');
                  setDraft('');
                }}
              >
                <ChatAvatar name={contact.name} />
                <span className="conversation-copy"><b>{contact.name}</b><small>{contact.lastMessage?.text || contactRole(contact.role)}</small></span>
                <span className="conversation-meta"><time>{contact.lastMessage?.createdAt ? new Date(contact.lastMessage.createdAt).toLocaleDateString() : ''}</time></span>
              </button>
            )) : <p className="chat-list-state">Contacts appear here when you share a shipping request or quote. You can also contact Tayonx support.</p>}
      </aside>
      <section className="chat-pane" aria-label="Conversation">
        {selectedContact ? <>
          <div className="chat-heading">
            <ChatAvatar name={selectedContact.name} />
            <span><b>{selectedContact.name}</b><small><i className={connectionState === 'connected' ? 'is-online' : ''} />{contactRole(selectedContact.role)} · {connectionState === 'connected' ? 'Live' : 'Reconnecting'}</small></span>
            {user.role !== 'admin' && <button type="button" className="customer-outline-button chat-report-button" onClick={() => { setReportError(''); setReportOpen(true); }}>Report</button>}
          </div>
          <div className="chat-history" ref={historyRef} aria-live="polite">
            {historyLoading && !messages.length && <p className="chat-list-state" role="status">Loading conversation…</p>}
            {!historyLoading && !messages.length && !historyError && <p className="chat-list-state">No messages yet. Send a message to start the conversation.</p>}
            {messages.map((message) => {
              const isSent = contactId(message, 'sender') === user.id;
              return <article className={`chat-message${isSent ? ' sent' : ''}`} key={message.id}>
                <span>{message.text}</span>
                <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              </article>;
            })}
          </div>
          {historyError && <p className="chat-error" role="alert">{historyError}</p>}
          <form className="chat-composer" onSubmit={sendMessage}>
            <input aria-label="Message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="4000" placeholder={`Message ${selectedContact.name}…`} disabled={sending} />
            <button type="submit" className="primary-button" aria-label="Send message" disabled={sending || !draft.trim() || connectionState !== 'connected'}><Icon name="send" size={16} /></button>
          </form>
          {reportFeedback && <p className="chat-report-feedback" role="status">{reportFeedback}<button type="button" className="text-button" onClick={() => setReportFeedback('')}>Dismiss</button></p>}
        </> : <div className="chat-empty-pane"><Icon name="chat" size={24} /><strong>Select a conversation</strong><span>Choose a contact to read and send messages.</span></div>}
      </section>
      {reportOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !reportSaving) setReportOpen(false); }}>
        <form className="request-modal chat-report-modal" onSubmit={submitReport}>
          <div className="modal-heading"><div><p className="eyebrow">SAFETY REPORT</p><h2>Report conversation</h2></div><button type="button" className="icon-button" aria-label="Close report dialog" disabled={reportSaving} onClick={() => setReportOpen(false)}><Icon name="close" /></button></div>
          <p>Tell Tayonx support why you are reporting your conversation with {selectedContact?.name}.</p>
          <label>Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
            <option value="harassment">Harassment</option><option value="spam">Spam</option><option value="fraud">Fraud or scam</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option>
          </select></label>
          <label>Details<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength="2000" rows="4" placeholder="Add context to help our team review the report." /></label>
          {reportError && <p className="signin-message" role="alert">{reportError}</p>}
          <button type="submit" className="primary-button full-button" disabled={reportSaving}>{reportSaving ? 'Submitting…' : 'Submit report'}</button>
        </form>
      </div>}
    </>
  );
}
