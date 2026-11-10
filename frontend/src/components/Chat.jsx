import { useEffect, useRef, useState } from 'react';
import { closeChat, deleteChat, getChatContacts, getChatHistory, reportChat } from '../lib/api.js';
import { createChatSocket } from '../socket.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';

function contactRole(role) {
  return {
    customer: 'Customer',
    cargo_provider: 'Cargo company',
    individual_cargo: 'Individual',
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

/**
 * `initialContactId` (optional) opens that conversation directly, e.g. from an accepted offer;
 * otherwise the most recent conversation is selected.
 */
export default function Chat({ user, initialContactId = '' }) {
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState('');
  // Threads this user closed: listed under "Closed chats" so they can be re-opened at any time.
  const [closedContacts, setClosedContacts] = useState([]);
  const [closedOpen, setClosedOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(initialContactId);
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
  const [threadBusy, setThreadBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [listFeedback, setListFeedback] = useState('');
  const socketRef = useRef(null);
  const reloadContactsRef = useRef(() => {});
  const historyRef = useRef(null);
  const selectedContactIdRef = useRef(initialContactId);
  const selectedContact = contacts.find((contact) => contact.id === selectedContactId);
  const contactsRef = useRef(contacts);

  useEffect(() => {
    selectedContactIdRef.current = selectedContactId;
  }, [selectedContactId]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  // Re-fetch contacts without changing the open conversation — used when a message arrives in a
  // thread that is not in the list (it was closed or deleted), so it re-appears automatically.
  useEffect(() => {
    reloadContactsRef.current = () => getChatContacts()
      .then(({ contacts: availableContacts, closed }) => {
        setContacts(availableContacts || []);
        setClosedContacts(closed || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // `include` re-opens the thread we were sent to (e.g. from an offer's Chat button) if it was closed.
    getChatContacts({ signal: controller.signal, include: initialContactId || undefined })
      .then(({ contacts: availableContacts, closed }) => {
        const nextContacts = availableContacts || [];
        setContacts(nextContacts);
        setClosedContacts(closed || []);
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
      // A closed/deleted thread is restored by the server once a newer message exists.
      if (!contactsRef.current.some((contact) => contact.id === peerId)) reloadContactsRef.current();
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

  // Deselect the open conversation (back to "Select a conversation").
  function clearSelection() {
    selectedContactIdRef.current = '';
    setSelectedContactId('');
    setMessages([]);
    setHistoryError('');
    setHistoryLoading(false);
    setDraft('');
    setReportFeedback('');
  }

  // "Close chat": hide the thread from the list until a new message arrives or it is reopened.
  async function closeConversation() {
    const contact = selectedContact;
    if (!contact || threadBusy) return;
    setThreadBusy(true);
    try {
      await closeChat(contact.id);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      setClosedContacts((current) => [{ ...contact, closedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== contact.id)]);
      clearSelection();
      setListFeedback(`Chat with ${contact.name} closed. It re-opens when a new message arrives, or from Closed chats.`);
    } catch (requestError) {
      if (requestError.missingRoute) {
        // Older server without thread state: still close the open conversation, keep it in the list.
        clearSelection();
        setListFeedback(`Chat with ${contact.name} closed.`);
      } else {
        setHistoryError(requestError.message);
      }
    } finally {
      setThreadBusy(false);
    }
  }

  // "Delete chat": remove the history for this user only (the other person keeps theirs).
  async function deleteConversation() {
    const contact = selectedContact;
    if (!contact) return;
    setThreadBusy(true);
    try {
      await deleteChat(contact.id);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
      setClosedContacts((current) => current.filter((item) => item.id !== contact.id));
      setDeleteConfirm(false);
      clearSelection();
      setListFeedback(`Chat with ${contact.name} deleted from your messages.`);
    } catch (requestError) {
      setDeleteConfirm(false);
      setHistoryError(requestError.message);
    } finally {
      setThreadBusy(false);
    }
  }

  function selectContact(contact) {
    setListFeedback('');
    selectedContactIdRef.current = contact.id;
    setSelectedContactId(contact.id);
    setMessages([]);
    setHistoryLoading(true);
    setHistoryError('');
    setDraft('');
  }

  // Re-open a closed thread: loading its history re-opens it on the server as well.
  function reopenContact(contact) {
    const restored = { ...contact };
    delete restored.closedAt;
    setClosedContacts((current) => current.filter((item) => item.id !== contact.id));
    setContacts((current) => (current.some((item) => item.id === contact.id) ? current : [restored, ...current]));
    selectContact(restored);
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
        {listFeedback && <p className="chat-list-feedback" role="status"><Icon name="check" size={13} /><span>{listFeedback}</span><button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setListFeedback('')}><Icon name="close" size={12} /></button></p>}
        {contactsLoading ? <p className="chat-list-state" role="status">Loading contacts…</p>
          : contactsError ? <p className="chat-list-state chat-list-error" role="alert">{contactsError}</p>
            : contacts.length ? contacts.map((contact) => (
              <button
                type="button"
                className={`conversation-row${selectedContactId === contact.id ? ' selected' : ''}`}
                key={contact.id}
                onClick={() => selectContact(contact)}
              >
                <ChatAvatar name={contact.name} />
                <span className="conversation-copy"><b>{contact.name}</b><small>{contact.lastMessage?.text || contactRole(contact.role)}</small></span>
                <span className="conversation-meta"><time>{contact.lastMessage?.createdAt ? new Date(contact.lastMessage.createdAt).toLocaleDateString() : ''}</time></span>
              </button>
            )) : <p className="chat-list-state">Contacts appear here when you have active business together — a request sent to you, a pending quote, or an accepted shipment. You can always contact Tayonx support.</p>}
        {!contactsLoading && closedContacts.length > 0 && (
          <div className="closed-chats">
            <button type="button" className={`closed-chats-toggle${closedOpen ? ' open' : ''}`} aria-expanded={closedOpen} onClick={() => setClosedOpen((open) => !open)}>
              <Icon name="clock" size={14} />
              <span>Closed chats</span>
              <b>{closedContacts.length}</b>
              <Icon name="arrow" size={14} />
            </button>
            {closedOpen && closedContacts.map((contact) => (
              <div className="closed-chat-row" key={contact.id}>
                <ChatAvatar name={contact.name} />
                <span className="conversation-copy"><b>{contact.name}</b><small>{contact.lastMessage?.text || contactRole(contact.role)}</small></span>
                <button type="button" className="secondary-button closed-chat-reopen" onClick={() => reopenContact(contact)} aria-label={`Re-open chat with ${contact.name}`}>Re-open</button>
              </div>
            ))}
          </div>
        )}
      </aside>
      <section className="chat-pane" aria-label="Conversation">
        {selectedContact ? <>
          <div className="chat-heading">
            <ChatAvatar name={selectedContact.name} />
            <span><b>{selectedContact.name}</b><small><i className={connectionState === 'connected' ? 'is-online' : ''} />{contactRole(selectedContact.role)} · {connectionState === 'connected' ? 'Live' : 'Reconnecting'}</small></span>
            <span className="chat-heading-actions">
              {user.role !== 'admin' && <button type="button" className="customer-outline-button chat-report-button" onClick={() => { setReportError(''); setReportOpen(true); }}>Report</button>}
              <button type="button" className="icon-button chat-delete-button" aria-label={`Delete chat with ${selectedContact.name}`} title="Delete chat" disabled={threadBusy} onClick={() => setDeleteConfirm(true)}><Icon name="trash" size={16} /></button>
              <button type="button" className="icon-button chat-close-button" aria-label={`Close chat with ${selectedContact.name}`} title="Close chat (it re-opens when a new message arrives)" disabled={threadBusy} onClick={closeConversation}><Icon name="close" size={18} /></button>
            </span>
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
        </> : <div className="chat-empty-pane"><Icon name="chat" size={24} /><strong>Select a conversation</strong><span>Choose a contact to read and send messages. Only people you are doing business with are listed.</span></div>}
      </section>
      {deleteConfirm && selectedContact && (
        <ConfirmDialog
          title="Delete this chat?"
          message={`Your conversation with ${selectedContact.name} will be removed from your messages. ${selectedContact.name} keeps their copy, and a new message from either of you starts a fresh chat.`}
          confirmLabel="Delete chat"
          tone="danger"
          busy={threadBusy}
          onConfirm={deleteConversation}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
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
