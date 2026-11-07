import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from './Icon.jsx';
import {
  apiRequest,
  createOffer,
  createRequest,
  declineRequest,
  deleteOffer,
  deleteRequest,
  getOffers,
  getRequests,
  respondToOffer,
  updateOffer,
  updateRequest,
  updateShipmentStatus,
} from '../lib/api.js';
import '../App.css';

const roleConfig = {
  customer: {
    label: 'Customer',
    sections: [
      ['overview', 'Dashboard', 'home'],
      ['requests', 'My requests', 'box'],
      ['offers', 'Offers', 'mail'],
      ['companies', 'Cargo companies', 'building'],
      ['messages', 'Chat', 'chat'],
      ['notifications', 'Notifications', 'bell'],
      ['profile', 'Profile', 'user'],
      ['new-request', 'New request', 'plus'],
    ],
  },
  provider: {
    label: 'Cargo provider',
    sections: [['overview', 'Overview', 'home'], ['opportunities', 'Requests', 'box'], ['offers', 'My offers', 'mail']],
  },
  admin: {
    label: 'Admin',
    sections: [['overview', 'Overview', 'home'], ['requests', 'All requests', 'box'], ['offers', 'All offers', 'mail']],
  },
};

const shipmentStatuses = ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'];

function statusLabel(status) {
  return status.replaceAll('_', ' ');
}

function StatusBadge({ children }) {
  return <span className={`status-badge status-${statusLabel(children).toLowerCase().replaceAll(' ', '-')}`}>{statusLabel(children)}</span>;
}

function Card({ children, className = '' }) {
  return <section className={`dashboard-card ${className}`}>{children}</section>;
}

function CardHeading({ title, subtitle, action }) {
  return (
    <div className="card-heading">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
  );
}

function Avatar({ name, className = '' }) {
  const initials = (name || 'User').split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  return <span className={`avatar ${className}`}>{initials}</span>;
}

function RequestTable({ requests, role, search, busyId, onEdit, onDelete, onSelectOffers, onStatusChange, onCreateOffer, onDeclineRequest }) {
  const visibleRequests = requests.filter((request) =>
    `${request.product} ${request.sourceCountry} ${request.destination} ${request.status} ${request.customer?.name || ''}`
      .toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Shipping request</th><th>Route</th><th>Posted</th><th>Offers</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {visibleRequests.map((request) => {
            const canCancel = role === 'customer' && ['open', 'offers_received', 'in_progress'].includes(request.status);
            const canComplete = role === 'customer' && request.status === 'shipping';
            const canEdit = role === 'admin' || role === 'customer';
            return (
              <tr key={request._id}>
                <td><span className="table-primary">{request.product} · {request.quantity}</span><span className="table-secondary">{request._id}</span></td>
                <td>{request.sourceCountry} → {request.destination}</td>
                <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                <td>{role === 'customer' && request.offers?.length
                  ? <button className="text-button" onClick={() => onSelectOffers(request._id)}>{request.offers.length} offers</button>
                  : request.offers?.length || '—'}</td>
                <td>
                  {role === 'admin' && <select aria-label={`Update status for ${request.product}`} value={request.status} disabled={busyId === request._id} onChange={(event) => onStatusChange(request._id, event.target.value)}>
                    {shipmentStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}
                  </select>}
                  {role === 'customer' && (canCancel || canComplete) && <select aria-label={`Update status for ${request.product}`} value={request.status} disabled={busyId === request._id} onChange={(event) => onStatusChange(request._id, event.target.value)}>
                    <option value={request.status}>{statusLabel(request.status)}</option>
                    <option value={canComplete ? 'delivered' : 'cancelled'}>{canComplete ? 'Mark delivered' : 'Cancel request'}</option>
                  </select>}
                  {role !== 'admin' && role !== 'customer' || (!canCancel && !canComplete && role === 'customer')
                    ? <StatusBadge>{request.status}</StatusBadge>
                    : null}
                </td>
                <td><div className="table-buttons">
                  {canEdit && <button className="icon-button table-action" aria-label={`Edit ${request.product}`} onClick={() => onEdit(request)}><Icon name="edit" size={16} /></button>}
                  {(role === 'customer' || role === 'admin') && <button className="icon-button table-action" aria-label={`Delete ${request.product}`} disabled={busyId === request._id} onClick={() => onDelete(request)}><Icon name="trash" size={16} /></button>}
                  {role === 'customer' && <button className="icon-button table-action" aria-label={`View offers for ${request.product}`} onClick={() => onSelectOffers(request._id)}><Icon name="arrow" size={17} /></button>}
                  {role === 'provider' && ['open', 'offers_received'].includes(request.status) && <><button className="customer-outline-button" disabled={busyId === request._id} onClick={() => onDeclineRequest(request._id)}>Decline</button><button className="small-primary" disabled={busyId === request._id} onClick={() => onCreateOffer(request)}>Send offer</button></>}
                </div></td>
              </tr>
            );
          })}
          {!visibleRequests.length && <tr><td className="empty-table" colSpan="6">{search ? 'No requests match your search.' : 'No shipping requests yet.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OffersTable({ offers, role, busyId, onEdit, onDelete, onRespond, onStatusChange }) {
  if (!offers.length) {
    return <p className="empty-table">{role === 'customer' ? 'No offers have been submitted for your requests.' : 'You have not sent any offers yet.'}</p>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>Request</th><th>{role === 'customer' || role === 'admin' ? 'Cargo provider' : 'Customer'}</th><th>Quote</th><th>Delivery</th><th>Status / shipment</th><th>Actions</th></tr></thead>
        <tbody>{offers.map((offer) => {
          const nextStatus = { in_progress: 'purchased', purchased: 'shipping', shipping: 'delivered' }[offer.request.status];
          return (
            <tr key={offer._id}>
              <td><span className="table-primary">{offer.request.product}</span><span className="table-secondary">{offer.request.id}</span></td>
              <td>{role === 'customer' || role === 'admin' ? offer.provider?.name || 'Cargo provider' : offer.request.customer?.name || 'Customer'}</td>
              <td><b>{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(offer.price)}</b></td>
              <td>{offer.deliveryDays} days</td>
              <td>{role === 'provider' && offer.status === 'accepted' && nextStatus
                ? <select aria-label="Update shipment progress" value={offer.request.status} disabled={busyId === offer.request.id} onChange={(event) => onStatusChange(offer.request.id, event.target.value)}>
                  <option value={offer.request.status}>{statusLabel(offer.request.status)}</option><option value={nextStatus}>{statusLabel(nextStatus)}</option>
                </select>
                : <StatusBadge>{role === 'provider' && offer.status === 'accepted' ? offer.request.status : offer.status}</StatusBadge>}</td>
              <td><div className="table-buttons">
                {(role === 'provider' || role === 'admin') && offer.status === 'pending' && <>
                  <button className="icon-button table-action" aria-label="Edit offer" onClick={() => onEdit(offer)}><Icon name="edit" size={16} /></button>
                  <button className="icon-button table-action" aria-label="Delete offer" disabled={busyId === offer._id} onClick={() => onDelete(offer)}><Icon name="trash" size={16} /></button>
                </>}
                {role === 'customer' && offer.status === 'pending' && <>
                  <button className="reject-button" disabled={busyId === offer._id} onClick={() => onRespond(offer, 'declined')}>Decline</button>
                  <button className="approve-button" disabled={busyId === offer._id} onClick={() => onRespond(offer, 'accepted')}>Accept</button>
                </>}
              </div></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function RequestForm({ request, saving, error, onSubmit, onClose }) {
  const [values, setValues] = useState({
    product: request?.product || '',
    sourceCountry: request?.sourceCountry || 'China',
    destination: request?.destination || '',
    quantity: request?.quantity || '',
    details: request?.details || '',
  });
  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
        <div className="modal-heading"><div><p className="eyebrow">{request ? 'EDIT SHIPPING REQUEST' : 'NEW SHIPPING REQUEST'}</p><h2>{request ? 'Update your request' : 'What are you looking for?'}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        <label>Product or item<input name="product" value={values.product} onChange={change} maxLength="160" required placeholder="e.g. 50 business laptops" /></label>
        <div className="form-row"><label>Source country<select name="sourceCountry" value={values.sourceCountry} onChange={change}><option>China</option><option>Turkey</option><option>Other</option></select></label><label>Delivery to<input name="destination" value={values.destination} onChange={change} maxLength="160" required placeholder="City, country" /></label></div>
        <label>Quantity<input name="quantity" value={values.quantity} onChange={change} maxLength="100" required placeholder="e.g. 50 units" /></label>
        <label>Additional details<textarea name="details" value={values.details} onChange={change} maxLength="2000" rows="3" /></label>
        {error && <p className="signin-message" role="alert">{error}</p>}
        <button className="primary-button full-button" disabled={saving} type="submit">{saving ? 'Saving…' : request ? 'Save changes' : 'Post request'}</button>
      </form>
    </div>
  );
}

function OfferForm({ request, offer, saving, error, onSubmit, onClose }) {
  const [values, setValues] = useState({ price: offer?.price ?? '', deliveryDays: offer?.deliveryDays ?? '', includes: offer?.includes || '' });
  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
        <div className="modal-heading"><div><p className="eyebrow">{offer ? 'UPDATE OFFER' : 'SEND OFFER'}</p><h2>{request?.product || offer?.request?.product}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        <label>Total quote (USD)<input name="price" type="number" min="0.01" step="0.01" value={values.price} onChange={change} required /></label>
        <label>Delivery time (days)<input name="deliveryDays" type="number" min="1" max="365" step="1" value={values.deliveryDays} onChange={change} required /></label>
        <label>Included services<textarea name="includes" value={values.includes} onChange={change} maxLength="500" rows="3" placeholder="Shipping, customs, final-mile delivery" /></label>
        {error && <p className="signin-message" role="alert">{error}</p>}
        <button className="primary-button full-button" disabled={saving} type="submit">{saving ? 'Saving…' : offer ? 'Update offer' : 'Send offer'}</button>
      </form>
    </div>
  );
}

export default function DashboardWorkspace({ initialRole }) {
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [offerRequest, setOfferRequest] = useState(null);
  const [editingOffer, setEditingOffer] = useState(null);
  const [formError, setFormError] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const config = roleConfig[initialRole];
  const displayName = user?.name || config.label;
  const customerMode = initialRole === 'customer';
  const providerMode = initialRole === 'provider';
  const adminMode = initialRole === 'admin';
  const title = useMemo(() => ({
    overview: 'Dashboard',
    requests: adminMode ? 'All shipping requests' : 'My shipping requests',
    opportunities: 'Matching requests',
    offers: customerMode ? 'Offers to review' : adminMode ? 'All marketplace offers' : 'My offers',
    companies: 'Cargo companies',
    messages: 'Chat',
    notifications: 'Notifications',
    profile: 'Profile',
  })[section], [section, adminMode, customerMode]);
  const requestStatusCounts = shipmentStatuses.map((status) => ({
    status,
    count: requests.filter((request) => request.status === status).length,
  }));
  const activeShipments = requests.filter((request) => ['in_progress', 'purchased', 'shipping'].includes(request.status));
  const pendingOffers = offers.filter((offer) => offer.status === 'pending');
  const sourceCountries = [...new Set(requests.map((request) => request.sourceCountry).filter(Boolean))];
  const recentRequests = [...requests]
    .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
    .slice(0, 5);
  const recentOffers = offers.slice(0, 4);
  const quotedProviders = [...offers.reduce((providers, offer) => {
    const provider = offer.provider;
    if (!provider) return providers;
    const key = String(provider._id || provider.id || provider.name || '');
    if (!key) return providers;
    const existing = providers.get(key) || {
      id: key,
      name: provider.name || 'Cargo provider',
      offers: 0,
      requestId: offer.request?.id,
    };
    existing.offers += 1;
    providers.set(key, existing);
    return providers;
  }, new Map()).values()];

  useEffect(() => {
    document.title = `Tayonx | ${config.label} dashboard`;
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true });
      return undefined;
    }

    const controller = new AbortController();
    apiRequest('/api/auth/me', { signal: controller.signal })
      .then(({ user: account }) => {
        const accountRole = account.role === 'cargo_provider' ? 'provider' : account.role;
        if (accountRole !== initialRole) {
          navigate(account.role === 'cargo_provider' ? '/cargo/dashboard' : `/${account.role}/dashboard`, { replace: true });
          return;
        }
        setUser(account);
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return;
        if (requestError.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
        } else {
          setError(requestError.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [config.label, initialRole, navigate]);

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    Promise.all([
      getRequests(providerMode ? 'opportunities' : undefined, { signal: controller.signal }),
      getOffers({ signal: controller.signal }),
    ])
      .then(([requestResult, offerResult]) => {
        setRequests(requestResult.requests || []);
        setOffers(offerResult.offers || []);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, providerMode]);

  async function refreshData() {
    const [requestResult, offerResult] = await Promise.all([
      getRequests(providerMode ? 'opportunities' : undefined),
      getOffers(),
    ]);
    setRequests(requestResult.requests || []);
    setOffers(offerResult.offers || []);
  }

  async function performMutation(id, action, successMessage) {
    setBusyId(id || 'all');
    setError('');
    setMessage('');
    try {
      await action();
      await refreshData();
      setMessage(successMessage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  }

  function openCreateRequest() {
    setEditingRequest(null);
    setFormError('');
    setRequestModalOpen(true);
  }

  async function saveRequest(values) {
    setSaving(true);
    setFormError('');
    try {
      if (editingRequest) await updateRequest(editingRequest._id, values);
      else await createRequest(values);
      await refreshData();
      setRequestModalOpen(false);
      setEditingRequest(null);
      setMessage(editingRequest ? 'Shipping request updated.' : 'Shipping request posted.');
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveOffer(values) {
    setSaving(true);
    setFormError('');
    try {
      const payload = { price: Number(values.price), deliveryDays: Number(values.deliveryDays), includes: values.includes };
      if (editingOffer) await updateOffer(editingOffer._id, payload);
      else await createOffer(offerRequest._id, payload);
      await refreshData();
      setOfferRequest(null);
      setEditingOffer(null);
      setMessage(editingOffer ? 'Offer updated.' : 'Offer sent to the customer.');
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function deleteShippingRequest(request) {
    if (!window.confirm(`Delete "${request.product}" and its offers?`)) return;
    performMutation(request._id, () => deleteRequest(request._id), 'Shipping request deleted.');
  }

  function deleteCargoOffer(offer) {
    if (!window.confirm('Delete this pending offer?')) return;
    performMutation(offer._id, () => deleteOffer(offer._id), 'Offer deleted.');
  }

  function handleStatusChange(id, status) {
    performMutation(id, () => updateShipmentStatus(id, status), `Shipment status changed to ${statusLabel(status)}.`);
  }

  function handleOfferResponse(offer, status) {
    performMutation(offer._id, () => respondToOffer(offer._id, status), status === 'accepted'
      ? 'Offer accepted. The shipment is now in progress.'
      : 'Offer declined.');
  }

  function handleDeclineRequest(id) {
    performMutation(id, () => declineRequest(id), 'Request removed from your opportunities.');
  }

  function exportRequests() {
    const rows = [['ID', 'Customer', 'Product', 'Source', 'Destination', 'Quantity', 'Offers', 'Status'], ...requests.map((request) => [
      request._id, request.customer?.name || '', request.product, request.sourceCountry,
      request.destination, request.quantity, request.offers?.length || 0, request.status,
    ])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tayonx-shipping-requests.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`${requests.length} shipping requests exported.`);
  }

  function signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }

  function renderRequests(rows) {
    return <RequestTable
      requests={rows}
      role={initialRole}
      search={search}
      busyId={busyId}
      onEdit={(request) => { setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}
      onDelete={deleteShippingRequest}
      onSelectOffers={(id) => { setSelectedRequestId(id); setSection('offers'); }}
      onStatusChange={handleStatusChange}
      onCreateOffer={(request) => { setOfferRequest(request); setEditingOffer(null); setFormError(''); }}
      onDeclineRequest={handleDeclineRequest}
    />;
  }

  function renderContent() {
    if (section === 'offers') {
      const selectedOffers = customerMode && selectedRequestId
        ? offers.filter((offer) => offer.request.id === selectedRequestId)
        : offers;
      return <Card><CardHeading title={title} subtitle={customerMode ? 'Compare quotes, then accept or decline an offer.' : 'Manage pending quotes and update accepted shipment progress.'} />{loading ? <p className="empty-table" role="status">Loading offers…</p> : <OffersTable
        offers={selectedOffers}
        role={initialRole}
        busyId={busyId}
        onEdit={(offer) => { setEditingOffer(offer); setOfferRequest(null); setFormError(''); }}
        onDelete={deleteCargoOffer}
        onRespond={handleOfferResponse}
        onStatusChange={handleStatusChange}
      />}</Card>;
    }

    if (section === 'opportunities') {
      return <Card><CardHeading title={title} subtitle="Send a real quote or decline requests you cannot fulfil." />{loading ? <p className="empty-table" role="status">Loading matching requests…</p> : renderRequests(requests)}</Card>;
    }

    if (section === 'requests') {
      return <Card><CardHeading title={title} subtitle={adminMode ? 'Review and manage requests across the marketplace.' : 'Create, edit, or cancel your shipping requests.'} action={customerMode ? <button className="primary-button" onClick={openCreateRequest}><Icon name="plus" size={16} />New request</button> : null} />{loading ? <p className="empty-table" role="status">Loading shipping requests…</p> : renderRequests(requests)}</Card>;
    }

    if (customerMode && section === 'companies') {
      return <Card><CardHeading title="Cargo companies" subtitle="Providers who have sent quotes for your requests." />{loading ? <p className="empty-table" role="status">Loading cargo providers…</p> : quotedProviders.length ? <div className="customer-directory-list">{quotedProviders.map((provider) => <div className="customer-company-row" key={provider.id}><Avatar name={provider.name} className="customer-company-avatar navy" /><span className="customer-row-copy"><strong>{provider.name}</strong><small>{provider.offers} quote{provider.offers === 1 ? '' : 's'} on your requests</small></span><button className="customer-outline-button" disabled={!provider.requestId} onClick={() => { setSelectedRequestId(provider.requestId); setSection('offers'); }}>View quotes</button></div>)}</div> : <div className="empty-state"><strong>No cargo companies yet</strong><p>Companies appear here after they send a quote on one of your requests.</p><button className="small-primary" onClick={() => setSection('requests')}>View requests</button></div>}</Card>;
    }

    if (customerMode && section === 'notifications') {
      return <Card><CardHeading title="Notifications" subtitle="Updates from your shipping requests." />{loading ? <p className="empty-table" role="status">Loading updates…</p> : pendingOffers.length ? <div className="customer-directory-list">{pendingOffers.map((offer) => <div className="customer-offer-row" key={offer._id}><span className="customer-company-avatar blue"><Icon name="mail" size={15} /></span><span className="customer-row-copy"><strong>New quote for {offer.request.product}</strong><small>{offer.provider?.name || 'Cargo provider'} · {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(offer.price)} · {offer.deliveryDays} days</small></span><button className="small-primary" onClick={() => { setSelectedRequestId(offer.request.id); setSection('offers'); }}>Review</button></div>)}</div> : <div className="empty-state"><strong>You’re all caught up</strong><p>New provider quotes for your requests will appear here.</p></div>}</Card>;
    }

    if (customerMode && section === 'messages') {
      return <Card><CardHeading title="Chat" subtitle="Message cargo providers about your shipments." /><div className="empty-state customer-unavailable-state"><span className="customer-stat-icon"><Icon name="chat" size={19} /></span><strong>Messaging is not available yet</strong><p>There is no messaging service connected to this account. You can review and respond to provider quotes from your Offers page.</p><button className="small-primary" onClick={() => setSection('offers')}>View offers</button></div></Card>;
    }

    if (customerMode && section === 'profile') {
      return <Card><CardHeading title="Profile" subtitle="Your account details." />{user ? <div className="customer-profile-grid"><div><span>Full name</span><strong>{user.name}</strong></div><div><span>Email address</span><strong>{user.email}</strong></div><div><span>Country</span><strong>{user.country}</strong></div><div><span>Account type</span><strong>{config.label}</strong></div></div> : <p className="empty-table" role="status">Loading profile…</p>}</Card>;
    }

    if (customerMode) {
      return (
        <div className="customer-dashboard">
          <div className="customer-stats-grid">
            {[
              ['My requests', requests.length, 'box'],
              ['Offers waiting', pendingOffers.length, 'mail'],
              ['Active shipments', offers.filter((offer) => offer.status === 'accepted' && ['in_progress', 'purchased', 'shipping'].includes(offer.request.status)).length, 'package'],
              ['Completed', requestStatusCounts.find((item) => item.status === 'delivered')?.count || 0, 'check'],
            ].map(([label, value, icon]) => (
              <article className="customer-stat-card" key={label} aria-busy={loading}><span className="customer-stat-icon"><Icon name={icon} size={17} /></span><div><strong>{loading ? '—' : value}</strong><span>{label}</span></div></article>
            ))}
          </div>
          {pendingOffers.length > 0 && <section className="offers-notice"><Icon name="mail" size={18} /><div><strong>{pendingOffers.length} offer{pendingOffers.length === 1 ? '' : 's'} ready to review</strong><span>Compare live provider quotes and choose the right option for your shipment.</span></div><button className="small-primary" onClick={() => setSection('offers')}>Review offers</button></section>}
          <div className="customer-dashboard-grid customer-dashboard-grid-main">
            <Card className="customer-list-card">
              <CardHeading title="My recent requests" subtitle="Your latest shipping requests" action={<button className="link-button" onClick={() => setSection('requests')}>View all <Icon name="arrow" size={15} /></button>} />
              <div className="customer-request-header"><span>Request</span><span>Status</span><span>Actions</span></div>
              {loading ? <p className="empty-table" role="status">Loading your requests…</p> : recentRequests.length ? <div className="customer-request-list">
                {recentRequests.map((request) => {
                  const tone = request.status === 'delivered' ? 'success' : ['open', 'offers_received'].includes(request.status) ? 'info' : 'warning';
                  return <div className="customer-request-row" key={request._id}>
                    <span className="customer-request-icon"><Icon name="box" size={18} /></span>
                    <span className="customer-row-copy"><strong>{request.product}</strong><small>{request.quantity} · {request.sourceCountry} to {request.destination}</small><small>{request.offers?.length || 0} quote{request.offers?.length === 1 ? '' : 's'}</small></span>
                    <span className={`customer-status customer-status-${tone}`}>{statusLabel(request.status)}</span>
                    <span className="customer-row-actions">
                      <button className="icon-button table-action" aria-label={`Edit ${request.product}`} onClick={() => { setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}><Icon name="edit" size={15} /></button>
                      <button className="icon-button table-action" aria-label={`Delete ${request.product}`} disabled={busyId === request._id} onClick={() => deleteShippingRequest(request)}><Icon name="trash" size={15} /></button>
                    </span>
                  </div>;
                })}
              </div> : <div className="empty-state"><strong>No shipping requests yet</strong><p>Create a request to receive quotes from cargo providers.</p><button className="small-primary" onClick={openCreateRequest}>Create request</button></div>}
            </Card>
            <Card className="customer-tracking-card">
              <CardHeading title="Shipment tracking" subtitle="Live progress for your active shipments" />
              {loading ? <p className="empty-table" role="status">Loading shipment progress…</p> : activeShipments.length ? <div className="customer-tracking-list">{activeShipments.slice(0, 3).map((request) => {
                const stageIndex = { in_progress: 0, purchased: 1, shipping: 2, delivered: 3 }[request.status] ?? 0;
                const stages = ['Offer accepted', 'Item purchased', 'In transit', 'Delivered'];
                return <section className="customer-tracking-item" key={request._id}>
                  <div className="customer-tracking-heading"><span><strong>{request.product}</strong><small>{request.destination} · {statusLabel(request.status)}</small></span><span className="customer-row-actions">
                    <button className="icon-button table-action" aria-label={`Edit ${request.product}`} onClick={() => { setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}><Icon name="edit" size={15} /></button>
                    <button className="icon-button table-action" aria-label={`Delete ${request.product}`} disabled={busyId === request._id} onClick={() => deleteShippingRequest(request)}><Icon name="trash" size={15} /></button>
                  </span></div>
                  <ol className="shipment-tracking">{stages.map((stage, index) => <li className={index < stageIndex ? 'complete' : index === stageIndex ? 'current' : ''} key={stage}><i /><span><strong>{stage}</strong>{index === stageIndex && <small>Current status</small>}</span></li>)}</ol>
                </section>;
              })}</div> : <div className="empty-state"><strong>No active shipments</strong><p>Accepted offers will appear here as your shipments progress.</p></div>}
            </Card>
          </div>
          <div className="customer-dashboard-grid customer-dashboard-grid-secondary">
            <Card className="customer-list-card">
              <CardHeading title="Cargo providers" subtitle="Companies that have quoted on your requests" action={<button className="link-button" onClick={() => setSection('offers')}>View offers <Icon name="arrow" size={15} /></button>} />
              {loading ? <p className="empty-table" role="status">Loading providers…</p> : quotedProviders.length ? <div className="customer-compact-list">{quotedProviders.slice(0, 4).map((provider) => <div className="customer-company-row" key={provider.id}><Avatar name={provider.name} className="customer-company-avatar navy" /><span className="customer-row-copy"><strong>{provider.name}</strong><small>{provider.offers} quote{provider.offers === 1 ? '' : 's'} on your requests</small></span><button className="customer-outline-button" disabled={!provider.requestId} onClick={() => { setSelectedRequestId(provider.requestId); setSection('offers'); }}>Offers</button></div>)}</div> : <div className="empty-state"><strong>No provider quotes yet</strong><p>Providers will appear here when they respond to your requests.</p></div>}
            </Card>
            <Card className="customer-list-card">
              <CardHeading title="Latest offers" subtitle="Compare quotes and respond to providers" action={<button className="link-button" onClick={() => setSection('offers')}>View all <Icon name="arrow" size={15} /></button>} />
              {loading ? <p className="empty-table" role="status">Loading offers…</p> : recentOffers.length ? <div className="customer-compact-list">{recentOffers.map((offer) => <div className="customer-offer-row" key={offer._id}>
                <span className="customer-company-avatar blue"><Icon name="package" size={15} /></span>
                <span className="customer-row-copy"><strong>{offer.provider?.name || 'Cargo provider'}</strong><small>{offer.request.product} · {offer.deliveryDays} days</small></span>
                <span className="customer-offer-amount">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(offer.price)}</span>
                {offer.status === 'pending' ? <span className="customer-offer-actions"><button className="small-primary" disabled={busyId === offer._id} onClick={() => handleOfferResponse(offer, 'accepted')}>Accept</button><button className="icon-button table-action" aria-label={`Decline offer from ${offer.provider?.name || 'cargo provider'}`} disabled={busyId === offer._id} onClick={() => handleOfferResponse(offer, 'declined')}><Icon name="close" size={15} /></button></span> : <StatusBadge>{offer.status}</StatusBadge>}
              </div>)}</div> : <div className="empty-state"><strong>No offers yet</strong><p>Provider quotes will appear here when submitted.</p></div>}
            </Card>
          </div>
        </div>
      );
    }

    if (providerMode) {
      return (
        <div className="provider-dashboard">
          <div className="provider-stats-grid">
            {[
              ['Open requests', requests.length, 'box'],
              ['Offers sent', offers.length, 'mail'],
              ['Active shipments', activeShipments.length, 'package'],
              ['Offers accepted', offers.filter((offer) => offer.status === 'accepted').length, 'check'],
            ].map(([label, value, icon]) => <article className="provider-stat-card" key={label}><span className="provider-stat-icon"><Icon name={icon} size={16} /></span><div><strong>{value}</strong><span>{label}</span></div></article>)}
          </div>
          <div className="provider-dashboard-grid">
            <Card className="provider-requests-card"><CardHeading title="New requests for you" subtitle="Submit a quote for a real customer request or decline it." action={<span className="results-count">{requests.length} available</span>} />{loading ? <p className="empty-table" role="status">Loading opportunities…</p> : renderRequests(requests.slice(0, 8))}</Card>
            <div className="provider-dashboard-aside">
              <Card className="provider-list-card"><CardHeading title="Your latest offers" action={<button className="link-button" onClick={() => setSection('offers')}>View all <Icon name="arrow" size={14} /></button>} />{loading ? <p className="empty-table" role="status">Loading offers…</p> : <OffersTable offers={offers.slice(0, 4)} role="provider" busyId={busyId} onEdit={(offer) => { setEditingOffer(offer); setOfferRequest(null); setFormError(''); }} onDelete={deleteCargoOffer} onStatusChange={handleStatusChange} />}</Card>
              <Card className="provider-performance-card"><CardHeading title="Offer activity" /><div className="provider-performance"><div><span>Pending quotes</span><strong>{pendingOffers.length}</strong></div><div><span>Response rate</span><strong>{offers.length ? `${Math.round((offers.filter((offer) => offer.status !== 'pending').length / offers.length) * 100)}%` : '—'}</strong></div><p>Quote requests matching your cargo services are shown in the list.</p></div></Card>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="admin-dashboard">
        <div className="admin-kpi-grid">
          {[
            ['Total requests', requests.length, 'box', 'admin-kpi-blue'],
            ['Active shipments', activeShipments.length, 'package', 'admin-kpi-green'],
            ['Offers submitted', offers.length, 'mail', 'admin-kpi-blue'],
            ['Awaiting review', pendingOffers.length, 'clock', 'admin-kpi-amber'],
          ].map(([label, value, icon, tone]) => <article className={`admin-kpi ${tone}`} key={label}><span className="admin-kpi-icon"><Icon name={icon} size={16} /></span><span className="admin-kpi-content"><strong>{value}</strong><span>{label}</span><small>Live database total</small></span></article>)}
        </div>
        <div className="admin-insights-grid">
          <Card className="admin-insight-card"><CardHeading title="Requests by status" /><div className="admin-source-content">{requestStatusCounts.filter((item) => item.count > 0).map((item) => <div className="admin-source-item" key={item.status}><span>{statusLabel(item.status)}</span><strong>{item.count}</strong><i><b style={{ width: `${requests.length ? (item.count / requests.length) * 100 : 0}%` }} /></i></div>)}{!requests.length && <p>No request activity recorded yet.</p>}</div></Card>
          <Card className="admin-insight-card"><CardHeading title="Source countries" /><div className="admin-source-content">{sourceCountries.map((country) => <div className="admin-source-item" key={country}><span>{country}</span><strong>{requests.filter((request) => request.sourceCountry === country).length}</strong><i><b style={{ width: `${requests.length ? (requests.filter((request) => request.sourceCountry === country).length / requests.length) * 100 : 0}%` }} /></i></div>)}{!sourceCountries.length && <p>No source country data yet.</p>}</div></Card>
          <Card className="admin-insight-card"><CardHeading title="Offer decisions" /><div className="admin-source-content"><div className="admin-source-item"><span>Pending</span><strong>{pendingOffers.length}</strong></div><div className="admin-source-item"><span>Accepted</span><strong>{offers.filter((offer) => offer.status === 'accepted').length}</strong></div><div className="admin-source-item"><span>Declined</span><strong>{offers.filter((offer) => offer.status === 'declined').length}</strong></div></div></Card>
        </div>
        <div className="admin-lower-grid">
          <Card className="admin-latest-card"><CardHeading title="Latest marketplace requests" action={<button className="link-button" onClick={() => setSection('requests')}>View all <Icon name="arrow" size={14} /></button>} />{loading ? <p className="empty-table" role="status">Loading marketplace data…</p> : renderRequests(requests.slice(0, 6))}</Card>
          <Card className="admin-attention-card"><CardHeading title="Latest offers" action={<button className="link-button" onClick={() => setSection('offers')}>View all <Icon name="arrow" size={14} /></button>} />{loading ? <p className="empty-table" role="status">Loading offers…</p> : <OffersTable offers={offers.slice(0, 4)} role="admin" busyId={busyId} onEdit={(offer) => { setEditingOffer(offer); setOfferRequest(null); setFormError(''); }} onDelete={deleteCargoOffer} onRespond={handleOfferResponse} onStatusChange={handleStatusChange} />}</Card>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className={`app-shell${customerMode ? ' customer-shell' : ''}${providerMode ? ' provider-shell' : ''}${adminMode ? ' admin-shell' : ''}`}>
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
        <a className="sidebar-brand" href="#dashboard" aria-label="Tayonx dashboard home" onClick={(event) => { event.preventDefault(); setSection('overview'); }}><img src={logo} alt="Tayonx" /></a>
        <div className="workspace-role-picker"><span className="customer-role-label">{config.label.toUpperCase()}</span></div>
        <nav className="side-nav" aria-label={`${config.label} navigation`}>
          {config.sections.map(([sectionId, label, icon]) => (
            <Fragment key={sectionId}>
              <button className={`nav-item${section === sectionId ? ' active' : ''}`} onClick={() => {
                if (sectionId === 'new-request') {
                  openCreateRequest();
                  setMobileNavOpen(false);
                  return;
                }
                setSection(sectionId);
                setSearch('');
                setSelectedRequestId('');
                setMobileNavOpen(false);
              }}>
                <Icon name={icon} size={16} /><span>{label}</span>{customerMode && sectionId === 'notifications' && pendingOffers.length > 0 && <span className="nav-count">{pendingOffers.length}</span>}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="customer-signout" onClick={signOut}><Icon name="arrow" size={15} />Log out</button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Icon name="menu" /></button>
          <div className="customer-topbar-title"><strong>{title}</strong><span>Welcome back, {displayName}</span></div>
          <div className="topbar-actions">
            {adminMode && <button className="admin-export-button" onClick={exportRequests}><Icon name="download" size={13} />Export</button>}
            {(section === 'requests' || section === 'opportunities') && <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests…" /></label>}
            {customerMode && <button className="notification-button" aria-label={`${pendingOffers.length} pending offer notifications`} title="Notifications" onClick={() => setSection('notifications')}><Icon name="bell" size={16} />{pendingOffers.length > 0 && <i />}</button>}
            {customerMode && section === 'overview' && <button className="primary-button" onClick={openCreateRequest}><Icon name="plus" size={16} />New request</button>}
            <Avatar name={displayName} className={`topbar-avatar${providerMode || adminMode ? ' provider-topbar-avatar' : ''}`} />
          </div>
        </header>
        <main className={`dashboard-main${customerMode ? ' customer-dashboard-main' : ''}${providerMode ? ' provider-dashboard-main' : ''}${adminMode ? ' admin-dashboard-main' : ''}`}>
          {error && <div className="toast-message toast-error" role="alert"><Icon name="alert" size={17} />{error}<button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={16} /></button></div>}
          {message && <div className="toast-message" role="status"><Icon name="check" size={17} />{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></div>}
          <div className={`dashboard-content${customerMode ? ' customer-dashboard-content' : ''}${providerMode ? ' provider-dashboard-content' : ''}${adminMode ? ' admin-dashboard-content' : ''}`}>{renderContent()}</div>
          <footer className="dashboard-footer"><span>Tayonx</span><span>Connect · Request · Ship · Get it done</span></footer>
        </main>
      </div>

      {requestModalOpen && <RequestForm request={editingRequest} saving={saving} error={formError} onSubmit={saveRequest} onClose={() => { setRequestModalOpen(false); setEditingRequest(null); setFormError(''); }} />}
      {(offerRequest || editingOffer) && <OfferForm request={offerRequest || editingOffer?.request} offer={editingOffer} saving={saving} error={formError} onSubmit={saveOffer} onClose={() => { setOfferRequest(null); setEditingOffer(null); setFormError(''); }} />}
    </div>
  );
}
