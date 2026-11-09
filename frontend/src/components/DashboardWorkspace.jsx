import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from './Icon.jsx';
import AdminChats from './AdminChats.jsx';
import AdminSettings from './AdminSettings.jsx';
import Chat from './Chat.jsx';
import AccountFields from './AccountFields.jsx';
import AdminVerifications from './AdminVerifications.jsx';
import VerificationCenter from './VerificationCenter.jsx';
import { ProtectedAvatar } from './ProtectedFile.jsx';
import { createChatSocket } from '../socket.js';
import { ACCOUNT_TYPES, ROLE_LABELS, VERIFICATION_LABELS, cleanText, normalizePhone, validateAccount } from '../lib/accountFields.js';
import { formatUsd, parseQuantity, roundMoney } from '../lib/offerPricing.js';
import {
  apiRequest,
  createOffer,
  createRequest,
  createUser,
  declineRequest,
  deleteOffer,
  deleteRequest,
  deleteUser,
  getOffers,
  getRequests,
  getUsers,
  getVerificationRequests,
  respondToOffer,
  updateOffer,
  updateRequest,
  updateShipmentStatus,
  updateUser,
} from '../lib/api.js';
import '../App.css';
import '../dashboard-sizing.css';
import '../account-forms.css';

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
    sections: [
      ['overview', 'Dashboard', 'home'],
      ['opportunities', 'Requests', 'box'],
      ['offers', 'My offers', 'mail'],
      ['orders', 'Orders & shipping', 'package'],
      ['messages', 'Chats', 'chat'],
      ['company', 'Company profile', 'building'],
      ['settings', 'Settings', 'user'],
    ],
  },
  admin: {
    label: 'Admin',
    sections: [
      ['overview', 'Dashboard', 'home'],
      ['requests', 'Requests', 'box'],
      ['companies', 'Cargo companies', 'building'],
      ['offers', 'Offers', 'mail'],
      ['users', 'Users', 'users'],
      ['verifications', 'Verifications', 'shield'],
      ['messages', 'Chats & reports', 'chat'],
      ['analytics', 'Analytics', 'chart'],
      ['settings', 'Settings', 'user'],
    ],
  },
};

const shipmentStatuses = ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'];
const dashboardLoadedAt = Date.now();

function statusLabel(status) {
  return status.replaceAll('_', ' ');
}

function formatRelativeTime(value, referenceTime) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Date unavailable';
  const elapsedMinutes = Math.max(0, Math.floor((referenceTime - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago` : new Date(timestamp).toLocaleDateString();
}

function StatusBadge({ children }) {
  return <span className={`status-badge status-${statusLabel(children).toLowerCase().replaceAll(' ', '-')}`}>{statusLabel(children)}</span>;
}

function userRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function VerificationChip({ status = 'unverified' }) {
  return <span className={`verification-chip verification-${status}`}><Icon name="shield" size={13} />{VERIFICATION_LABELS[status] || status}</span>;
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
              <td><b>{formatUsd(offer.price)}</b>{offer.unitPrice && offer.quantityCount ? <span className="table-secondary">{offer.quantityCount.toLocaleString('en-US')} × {formatUsd(offer.unitPrice)}</span> : null}</td>
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

/** "units", "laptops", "pcs"… taken from the request's quantity text (e.g. "50 laptops"). */
function quantityUnitLabel(quantity, count) {
  const word = String(quantity || '').replace(/^[^\d]*[\d.,]+\s*/, '').split(/[\s(]/)[0];
  if (word && /^\p{L}/u.test(word)) return word;
  return count === 1 ? 'unit' : 'units';
}

/**
 * Send / update offer. When the request has a numeric quantity the provider enters a unit price
 * and the total is calculated live (the server recalculates it the same way).
 */
function OfferForm({ request, offer, saving, error, onSubmit, onClose }) {
  const quantity = request?.quantity || offer?.request?.quantity || '';
  const count = parseQuantity(quantity);
  const unitLabel = quantityUnitLabel(quantity, count);
  // Prefill the unit price when editing (older offers only stored a total).
  const initialUnitPrice = offer?.unitPrice
    ?? (offer?.price && count && roundMoney(offer.price / count) * count === offer.price ? roundMoney(offer.price / count) : '');
  const [values, setValues] = useState({
    unitPrice: initialUnitPrice,
    price: offer?.price ?? '',
    deliveryDays: offer?.deliveryDays ?? '',
    includes: offer?.includes || '',
  });
  const [errors, setErrors] = useState({});
  const unitPrice = Number(values.unitPrice);
  const unitPriceValid = values.unitPrice !== '' && Number.isFinite(unitPrice) && unitPrice > 0;
  const total = count && unitPriceValid ? roundMoney(unitPrice * count) : null;

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    if (count) {
      if (!unitPriceValid) next.unitPrice = 'Enter a unit price greater than zero.';
      else if (roundMoney(unitPrice) !== unitPrice) next.unitPrice = 'Use at most 2 decimals (cents).';
    } else if (!(Number(values.price) > 0)) {
      next.price = 'Enter a total quote greater than zero.';
    }
    const days = Number(values.deliveryDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) next.deliveryDays = 'Enter 1 to 365 days.';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit(count
      ? { unitPrice, deliveryDays: days, includes: values.includes }
      : { price: Number(values.price), deliveryDays: days, includes: values.includes });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal offer-modal" onSubmit={handleSubmit} noValidate>
        <div className="modal-heading"><div><p className="eyebrow">{offer ? 'UPDATE OFFER' : 'SEND OFFER'}</p><h2>{request?.product || offer?.request?.product}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        <p className="offer-quantity"><Icon name="box" size={15} />Requested quantity: <strong>{quantity || 'not specified'}</strong></p>

        {count ? (
          <div className="form-row">
            <label>Unit price (USD)
              <input name="unitPrice" type="number" min="0.01" step="0.01" inputMode="decimal" value={values.unitPrice} onChange={change} placeholder="e.g. 10" aria-invalid={Boolean(errors.unitPrice)} aria-describedby="offer-unit-help" autoFocus />
              <small id="offer-unit-help" className="offer-field-help">Price for one item</small>
              {errors.unitPrice && <span className="offer-field-error" role="alert">{errors.unitPrice}</span>}
            </label>
            <label>Total quote (USD)
              <output className={`offer-total${total === null ? ' empty' : ''}`} htmlFor="unitPrice" aria-live="polite">{total === null ? '—' : formatUsd(total)}</output>
              <small className="offer-field-help">Calculated automatically</small>
            </label>
          </div>
        ) : (
          <label>Total quote (USD)
            <input name="price" type="number" min="0.01" step="0.01" inputMode="decimal" value={values.price} onChange={change} aria-invalid={Boolean(errors.price)} autoFocus />
            <small className="offer-field-help">This request’s quantity isn’t a number, so enter the total price for the whole order.</small>
            {errors.price && <span className="offer-field-error" role="alert">{errors.price}</span>}
          </label>
        )}

        {count > 0 && (
          <div className={`offer-calculation${total === null ? ' pending' : ''}`} aria-live="polite">
            <Icon name="chart" size={16} />
            {total === null
              ? <span>Enter a unit price to see the total: <b>{count.toLocaleString('en-US')} {unitLabel} × $…</b></span>
              : <span>Calculation: <b>{count.toLocaleString('en-US')} {unitLabel} × {formatUsd(unitPrice)} = {formatUsd(total)} total</b></span>}
          </div>
        )}

        <label>Delivery time (days)
          <input name="deliveryDays" type="number" min="1" max="365" step="1" value={values.deliveryDays} onChange={change} aria-invalid={Boolean(errors.deliveryDays)} />
          {errors.deliveryDays && <span className="offer-field-error" role="alert">{errors.deliveryDays}</span>}
        </label>
        <label>Included services<textarea name="includes" value={values.includes} onChange={change} maxLength="500" rows="3" placeholder="Shipping, customs, final-mile delivery" /></label>
        {error && <p className="signin-message" role="alert">{error}</p>}
        <button className="primary-button full-button" disabled={saving} type="submit">{saving ? 'Saving…' : offer ? 'Update offer' : total !== null ? `Send offer · ${formatUsd(total)}` : 'Send offer'}</button>
      </form>
    </div>
  );
}

/**
 * Admin create/edit user dialog. Fields adapt to the selected account role.
 * When editing, only changed fields are sent, so older accounts are not forced
 * to meet newer rules (e.g. three-part names) unless that field is edited.
 */
function UserForm({ user, saving, error, onSubmit, onClose }) {
  const initial = {
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    country: user?.country || 'Somaliland',
    password: '',
    profilePhoto: null,
  };
  const [role, setRole] = useState(user?.role || 'customer');
  const [values, setValues] = useState(initial);
  const [localErrors, setErrors] = useState({});
  const roleOptions = [...Object.entries(ACCOUNT_TYPES).map(([value, type]) => [value, type.label]), ...(user?.role === 'admin' ? [['admin', 'Administrator']] : [])];
  // "Add phone" in the users table opens this dialog focused on the phone field.
  useEffect(() => {
    if (user?.focusField) document.getElementById(`user-form-${user.focusField}`)?.focus();
  }, [user?.focusField]);

  // A field error from the server (e.g. duplicate email) shows on that field until the field is edited.
  const errors = error?.field && !Object.hasOwn(localErrors, error.field)
    ? { ...localErrors, [error.field]: error.message }
    : localErrors;

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  function changedFields() {
    return ['name', 'phone', 'email', 'country'].filter((field) => cleanText(values[field]) !== cleanText(initial[field]));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const only = user ? [...changedFields(), 'password', 'profilePhoto'] : undefined;
    const validationErrors = Object.fromEntries(Object.entries(validateAccount(values, role, { requirePassword: !user, only })).filter(([, message]) => message));
    setErrors(validationErrors);
    const firstInvalid = Object.keys(validationErrors)[0];
    if (firstInvalid) {
      document.getElementById(`user-form-${firstInvalid === 'profilePhoto' ? 'photo' : firstInvalid}`)?.focus();
      return;
    }

    const fields = user ? changedFields() : ['name', 'phone', 'email', 'country'];
    const payload = {};
    for (const field of fields) payload[field] = field === 'phone' ? normalizePhone(values[field]) : cleanText(values[field]);
    if (!user || role !== user.role) payload.role = role;
    if (values.password) payload.password = values.password;
    const photo = ACCOUNT_TYPES[role]?.profilePhoto ? values.profilePhoto : null;

    if (user && !Object.keys(payload).length && !photo) {
      onClose();
      return;
    }
    if (photo) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(payload)) formData.append(key, value);
      formData.append('profilePhoto', photo);
      onSubmit(formData);
    } else {
      onSubmit(payload);
    }
  }

  const generalError = error && !error.field ? error.message : '';

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal user-modal account-form" onSubmit={handleSubmit} noValidate>
        <div className="modal-heading"><div><p className="eyebrow">{user ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</p><h2>{user ? 'Update user' : 'Create user'}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        <div className="account-field">
          <label className="account-field-label" htmlFor="user-form-role">Account role</label>
          <div className="account-input with-icon">
            <Icon name="users" size={16} />
            <select id="user-form-role" value={role} onChange={(event) => { setRole(event.target.value); setErrors({}); }} disabled={user?.role === 'admin'}>
              {roleOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          {ACCOUNT_TYPES[role] && <small className="account-field-hint">{ACCOUNT_TYPES[role].description}</small>}
        </div>
        <AccountFields role={role} values={values} errors={errors} onChange={updateField} idPrefix="user-form" />
        <div className={`account-field${errors.password ? ' has-error' : ''}`}>
          <label className="account-field-label" htmlFor="user-form-password">{user ? 'New password (optional)' : 'Temporary password'}</label>
          <div className="account-input with-icon">
            <Icon name="shield" size={16} />
            <input id="user-form-password" autoComplete="new-password" type="password" value={values.password} onChange={(event) => updateField('password', event.target.value)} maxLength="72" placeholder={user ? 'Leave blank to keep current password' : 'At least 8 characters'} aria-invalid={Boolean(errors.password)} />
          </div>
          {errors.password && <p className="account-field-error" role="alert">{errors.password}</p>}
        </div>
        {generalError && <p className="signin-message" role="alert">{generalError}</p>}
        <button className="primary-button full-button" disabled={saving} type="submit">{saving ? 'Saving…' : user ? 'Save changes' : `Create ${(ACCOUNT_TYPES[role]?.label || 'user').toLowerCase()}`}</button>
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
  const [users, setUsers] = useState([]);
  const [usersError, setUsersError] = useState('');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
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
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormError, setUserFormError] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [verificationRefreshKey, setVerificationRefreshKey] = useState(0);
  const [verificationPromptHidden, setVerificationPromptHidden] = useState(() => {
    try { return sessionStorage.getItem('tayonx-hide-verification-prompt') === '1'; } catch { return false; }
  });
  const [adminPeriod, setAdminPeriod] = useState('30 days');
  const [currentTime, setCurrentTime] = useState(dashboardLoadedAt);
  const [providerCountryFilter, setProviderCountryFilter] = useState('All');
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
    users: 'Users',
    verifications: 'Verifications',
    analytics: 'Analytics',
    settings: 'Settings',
    orders: 'Orders & shipping',
    company: 'Company profile',
  })[section], [section, adminMode, customerMode]);
  const requestStatusCounts = shipmentStatuses.map((status) => ({
    status,
    count: requests.filter((request) => request.status === status).length,
  }));
  const activeShipments = requests.filter((request) => ['in_progress', 'purchased', 'shipping'].includes(request.status));
  const pendingOffers = offers.filter((offer) => offer.status === 'pending');
  const providerCountries = [...new Set(requests.map((request) => request.sourceCountry).filter(Boolean))].sort();
  const visibleProviderRequests = providerCountryFilter === 'All'
    ? requests
    : requests.filter((request) => request.sourceCountry === providerCountryFilter);
  const providerActiveShipments = offers.filter((offer) => offer.status === 'accepted' && ['in_progress', 'purchased', 'shipping'].includes(offer.request.status));
  const providerCustomerIds = new Set(offers.map((offer) => offer.request.customer?._id || offer.request.customer?.id).filter(Boolean).map(String));
  const providerCurrentMonthOffers = offers.filter((offer) => {
    const createdAt = new Date(offer.createdAt || 0);
    const now = new Date(currentTime);
    return createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
  });
  const providerAcceptedCount = offers.filter((offer) => offer.status === 'accepted').length;
  const providerAcceptanceRate = offers.length ? Math.round((providerAcceptedCount / offers.length) * 100) : 0;
  const adminRangeStart = adminPeriod === 'All time'
    ? 0
    : currentTime - (adminPeriod === '7 days' ? 7 : 30) * 24 * 60 * 60 * 1000;
  const adminRequests = adminMode
    ? requests.filter((request) => new Date(request.createdAt || 0).getTime() >= adminRangeStart)
    : requests;
  const adminOffers = adminMode
    ? offers.filter((offer) => new Date(offer.createdAt || 0).getTime() >= adminRangeStart)
    : offers;
  const adminRequestStatusCounts = shipmentStatuses.map((status) => ({
    status,
    count: adminRequests.filter((request) => request.status === status).length,
  }));
  const adminSourceCountries = [...new Set(adminRequests.map((request) => request.sourceCountry).filter(Boolean))];
  const adminCustomerIds = [...new Set(adminRequests.map((request) => request.customer?._id || request.customer?.id).filter(Boolean).map(String))];
  const adminProviderIds = [...new Set(adminOffers.map((offer) => offer.provider?._id || offer.provider?.id).filter(Boolean).map(String))];
  const adminCustomers = new Set(adminCustomerIds);
  const adminProviders = new Set(adminProviderIds);
  const adminCompanyRows = [...adminOffers.reduce((companies, offer) => {
    const providerId = String(offer.provider?._id || offer.provider?.id || '');
    if (!providerId) return companies;
    const company = companies.get(providerId) || {
      id: providerId,
      name: offer.provider?.name || 'Cargo company',
      offers: 0,
      pending: 0,
      accepted: 0,
    };
    company.offers += 1;
    if (offer.status === 'pending') company.pending += 1;
    if (offer.status === 'accepted') company.accepted += 1;
    companies.set(providerId, company);
    return companies;
  }, new Map()).values()].sort((first, second) => second.offers - first.offers);
  const adminPendingOffers = adminOffers.filter((offer) => offer.status === 'pending');
  const adminRecentRequests = [...adminRequests]
    .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
    .slice(0, 4);
  const adminAttentionRequests = adminRequests.filter((request) => {
    const requestAge = currentTime - new Date(request.createdAt || currentTime).getTime();
    return ['open', 'offers_received'].includes(request.status) && !(request.offers?.length) && requestAge >= 3 * 24 * 60 * 60 * 1000;
  }).slice(0, 4);
  const adminActivity = [
    ...adminRequests.map((request) => ({
      id: `request-${request._id}`,
      title: `New request · ${request.product} × ${request.quantity}`,
      detail: `${request.customer?.name || 'Customer'} · ${request.sourceCountry} to ${request.destination}`,
      timestamp: request.createdAt,
      tone: 'current',
    })),
    ...adminOffers.map((offer) => ({
      id: `offer-${offer._id}`,
      title: offer.status === 'accepted' ? `Offer accepted · ${offer.request.product}` : `Offer submitted · ${offer.request.product}`,
      detail: `${offer.provider?.name || 'Cargo provider'} · ${formatUsd(offer.price)}`,
      timestamp: offer.status === 'accepted' ? offer.updatedAt || offer.createdAt : offer.createdAt,
      tone: offer.status === 'accepted' ? 'success' : 'current',
    })),
  ].sort((first, second) => new Date(second.timestamp || 0) - new Date(first.timestamp || 0)).slice(0, 4);
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
        const accountRole = ['cargo_provider', 'individual_cargo'].includes(account.role) ? 'provider' : account.role;
        if (accountRole !== initialRole) {
          navigate(['cargo_provider', 'individual_cargo'].includes(account.role) ? '/cargo/dashboard' : `/${account.role}/dashboard`, { replace: true });
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

  useEffect(() => {
    if (!adminMode || section !== 'users') return undefined;
    const controller = new AbortController();
    getUsers({ signal: controller.signal })
      .then(({ users: registeredUsers }) => setUsers(registeredUsers || []))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setUsersError(requestError.message);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setUsersLoading(false);
      });
    return () => controller.abort();
  }, [adminMode, section]);

  // Admin: how many verification requests are waiting (sidebar badge + overview alert).
  useEffect(() => {
    if (!adminMode || !user) return undefined;
    const controller = new AbortController();
    getVerificationRequests('pending', { signal: controller.signal })
      .then((result) => setPendingVerifications(result.pendingCount || 0))
      .catch(() => {});
    return () => controller.abort();
  }, [adminMode, user]);

  // Live events: admins hear about new verification requests, cargo accounts about review results.
  useEffect(() => {
    if (!user || !(adminMode || providerMode)) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const socket = createChatSocket(token);
    if (adminMode) {
      socket.on('verification_submitted', (request) => {
        setPendingVerifications((count) => count + 1);
        setVerificationRefreshKey((key) => key + 1);
        setMessage(`New verification request from ${request.user?.name || 'a cargo account'}. Open Verifications to review it.`);
      });
      socket.on('verification_updated', () => setVerificationRefreshKey((key) => key + 1));
    }
    if (providerMode) {
      socket.on('verification_reviewed', ({ verification }) => {
        setUser((current) => (current ? { ...current, verification } : current));
        if (verification.status === 'approved') setMessage('Good news: your account has been verified by Tayonx.');
        else setError(`Your verification needs changes: ${verification.reviewNote || 'see Settings for details.'}`);
      });
    }
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
    // Reconnect only when the signed-in account changes, not on every profile update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, adminMode, providerMode]);

  const handlePendingCountChange = useCallback((count) => setPendingVerifications(count), []);

  function hideVerificationPrompt() {
    setVerificationPromptHidden(true);
    try { sessionStorage.setItem('tayonx-hide-verification-prompt', '1'); } catch { /* storage unavailable */ }
  }

  async function refreshData() {
    const [requestResult, offerResult] = await Promise.all([
      getRequests(providerMode ? 'opportunities' : undefined),
      getOffers(),
    ]);
    setRequests(requestResult.requests || []);
    setOffers(offerResult.offers || []);
  }

  async function refreshUsers() {
    setUsersLoading(true);
    setUsersError('');
    try {
      const { users: registeredUsers } = await getUsers();
      setUsers(registeredUsers || []);
    } catch (requestError) {
      setUsersError(requestError.message);
      setError(requestError.message);
    } finally {
      setUsersLoading(false);
    }
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

  // `payload` comes from OfferForm: { unitPrice } (total calculated by the server) or { price }, plus delivery details.
  async function saveOffer(payload) {
    setSaving(true);
    setFormError('');
    try {
      const result = editingOffer
        ? await updateOffer(editingOffer._id, payload)
        : await createOffer(offerRequest._id, payload);
      await refreshData();
      setOfferRequest(null);
      setEditingOffer(null);
      const total = result?.offer?.price ? ` Total quote: ${formatUsd(result.offer.price)}.` : '';
      setMessage((editingOffer ? 'Offer updated.' : 'Offer sent to the customer.') + total);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  // `payload` is a plain object or FormData (when a profile photo is attached), built by UserForm.
  async function saveUser(payload) {
    setSaving(true);
    setUserFormError(null);
    setError('');
    setMessage('');
    try {
      const result = editingUser
        ? await updateUser(editingUser.id, payload)
        : await createUser(payload);
      setUsers((current) => editingUser
        ? current.map((account) => account.id === result.user.id ? result.user : account)
        : [result.user, ...current]);
      setUserModalOpen(false);
      setEditingUser(null);
      setMessage(editingUser ? 'User updated successfully.' : 'User created successfully.');
    } catch (requestError) {
      setUserFormError({ message: requestError.message, field: requestError.field || '' });
    } finally {
      setSaving(false);
    }
  }

  function removeUser(account) {
    if (account.id === user?.id) {
      setError('You cannot delete your own administrator account.');
      return;
    }
    if (!window.confirm(`Delete user "${account.name}"? This cannot be undone.`)) return;
    setBusyId(account.id);
    setError('');
    setMessage('');
    deleteUser(account.id)
      .then(() => {
        setUsers((current) => current.filter((item) => item.id !== account.id));
        setMessage('User deleted successfully.');
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setBusyId(''));
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
    const exportRows = adminMode && section === 'overview' ? adminRequests : requests;
    const rows = [['ID', 'Customer', 'Product', 'Source', 'Destination', 'Quantity', 'Offers', 'Status'], ...exportRows.map((request) => [
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
    setMessage(`${exportRows.length} shipping requests exported.`);
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

    if (providerMode && section === 'orders') {
      const orders = offers.filter((offer) => offer.status === 'accepted');
      return <Card><CardHeading title="Orders & shipping" subtitle="Accepted offers and their live shipment status." />{loading ? <p className="empty-table" role="status">Loading accepted orders…</p> : orders.length ? <OffersTable offers={orders} role="provider" busyId={busyId} onEdit={(offer) => { setEditingOffer(offer); setOfferRequest(null); setFormError(''); }} onDelete={deleteCargoOffer} onStatusChange={handleStatusChange} /> : <div className="empty-state"><strong>No accepted orders yet</strong><p>When a customer accepts one of your offers, the order and shipping progress will appear here.</p><button className="small-primary" onClick={() => setSection('opportunities')}>Browse requests</button></div>}</Card>;
    }

    if (section === 'messages' && user && !adminMode) {
      return <Card className="messages-card live-chat-card"><Chat user={user} /></Card>;
    }

    if (providerMode && section === 'settings') {
      return user
        ? <VerificationCenter user={user} onVerificationChange={(verification) => setUser((current) => ({ ...current, verification }))} />
        : <Card><p className="empty-table" role="status">Loading settings…</p></Card>;
    }

    if (providerMode && section === 'company') {
      const isCompany = user?.role === 'cargo_provider';
      return <Card><CardHeading title={isCompany ? 'Company profile' : 'Provider profile'} subtitle="Your account details as customers and administrators see them." action={user && <VerificationChip status={user.verification?.status} />} />{user ? <div className="customer-profile-grid"><div><span>{isCompany ? 'Company name' : 'Full name'}</span><strong>{user.name}</strong></div><div><span>Account type</span><strong>{userRoleLabel(user.role)}</strong></div><div><span>Phone number</span><strong>{user.phone || 'Not provided'}</strong></div><div><span>Email address</span><strong>{user.email}</strong></div><div><span>Country</span><strong>{user.country}</strong></div><div><span>Verification</span><strong>{VERIFICATION_LABELS[user.verification?.status || 'unverified']}{user.verification?.status !== 'approved' && <button type="button" className="link-button profile-verify-link" onClick={() => setSection('settings')}>{user.verification?.status === 'pending' ? 'View status' : 'Get verified'} <Icon name="arrow" size={13} /></button>}</strong></div></div> : <p className="empty-table" role="status">Loading company account…</p>}</Card>;
    }

    if (adminMode && section === 'verifications') {
      return <AdminVerifications refreshKey={verificationRefreshKey} onPendingCountChange={handlePendingCountChange} onMessage={setMessage} />;
    }

    if (section === 'requests') {
      return <Card><CardHeading title={title} subtitle={adminMode ? 'Review and manage requests across the marketplace.' : 'Create, edit, or cancel your shipping requests.'} action={customerMode ? <button className="primary-button" onClick={openCreateRequest}><Icon name="plus" size={16} />New request</button> : null} />{loading ? <p className="empty-table" role="status">Loading shipping requests…</p> : renderRequests(requests)}</Card>;
    }

    if (adminMode && section === 'companies') {
      return <Card><CardHeading title="Cargo companies" subtitle="Providers with quotes in the selected dashboard period." />{loading ? <p className="empty-table" role="status">Loading cargo companies…</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Company</th><th>Quotes</th><th>Pending</th><th>Accepted</th></tr></thead><tbody>{adminCompanyRows.map((company) => <tr key={company.id}><td><span className="table-primary">{company.name}</span><span className="table-secondary">Verified status is not available in this system.</span></td><td>{company.offers}</td><td>{company.pending}</td><td>{company.accepted}</td></tr>)}{!adminCompanyRows.length && <tr><td className="empty-table" colSpan="4">No cargo companies have submitted quotes in this period.</td></tr>}</tbody></table></div>}</Card>;
    }

    if (adminMode && section === 'users') {
      return <Card className="admin-users-card"><CardHeading title="Users" subtitle={`${users.length} registered account${users.length === 1 ? '' : 's'}`} action={<button className="primary-button" onClick={() => { setEditingUser(null); setUserFormError(null); setUserModalOpen(true); }}><Icon name="plus" size={15} />Create user</button>} />
        {usersLoading ? <p className="empty-table" role="status">Loading registered users…</p> : usersError ? <div className="empty-state"><strong>Could not load registered users</strong><p>{usersError}</p><button className="small-primary" onClick={refreshUsers}>Try again</button></div> : <div className="table-scroll"><table className="data-table admin-users-table"><thead><tr><th>User</th><th>Contact</th><th>Role</th><th>Verification</th><th>Country</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
          {users.map((account) => <tr key={account.id}>
            <td><span className="verification-applicant"><ProtectedAvatar fileId={account.profilePhoto} name={account.name} /><span className="table-primary">{account.name}</span></span></td>
            <td><span className="table-primary">{account.email}</span>{account.phone
              ? <a className="table-secondary table-phone" href={`tel:${account.phone}`}><Icon name="phone" size={12} />{account.phone}</a>
              : <button type="button" className="table-add-phone" title="This account was created before phone numbers were collected" onClick={() => { setEditingUser({ ...account, focusField: 'phone' }); setUserFormError(null); setUserModalOpen(true); }}><Icon name="plus" size={12} />Add phone</button>}</td>
            <td><span className={`admin-user-role admin-user-role-${account.role}`}>{userRoleLabel(account.role)}</span></td>
            <td>{['cargo_provider', 'individual_cargo'].includes(account.role) ? <VerificationChip status={account.verification?.status} /> : <span className="table-secondary">—</span>}</td>
            <td>{account.country || '—'}</td>
            <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
            <td><div className="table-buttons">
              <button className="icon-button table-action" aria-label={`Edit ${account.name}`} disabled={busyId === account.id} onClick={() => { setEditingUser(account); setUserFormError(null); setUserModalOpen(true); }}><Icon name="edit" size={16} /></button>
              <button className="icon-button table-action" aria-label={`Delete ${account.name}`} disabled={busyId === account.id || account.id === user?.id} onClick={() => removeUser(account)}><Icon name="trash" size={16} /></button>
            </div></td>
          </tr>)}
          {!users.length && <tr><td className="empty-table" colSpan="7">No registered users found.</td></tr>}
        </tbody></table></div>}
      </Card>;
    }

    if (adminMode && section === 'analytics') {
      return <div className="admin-analytics-view"><div className="admin-kpi-grid">
        <article className="admin-kpi admin-kpi-blue"><span className="admin-kpi-icon"><Icon name="box" size={16} /></span><span className="admin-kpi-content"><strong>{loading ? '—' : adminRequests.length}</strong><span>Requests</span><small>Selected period</small></span></article>
        <article className="admin-kpi admin-kpi-green"><span className="admin-kpi-icon"><Icon name="check" size={16} /></span><span className="admin-kpi-content"><strong>{loading ? '—' : adminOffers.filter((offer) => offer.status === 'accepted').length}</strong><span>Accepted offers</span><small>Live database total</small></span></article>
        <article className="admin-kpi admin-kpi-blue"><span className="admin-kpi-icon"><Icon name="mail" size={16} /></span><span className="admin-kpi-content"><strong>{loading ? '—' : adminOffers.length}</strong><span>Offers submitted</span><small>Selected period</small></span></article>
        <article className="admin-kpi admin-kpi-amber"><span className="admin-kpi-icon"><Icon name="clock" size={16} /></span><span className="admin-kpi-content"><strong>{loading ? '—' : adminPendingOffers.length}</strong><span>Awaiting response</span><small>Live database total</small></span></article>
      </div><div className="admin-insights-grid">
        <Card className="admin-insight-card"><CardHeading title="Requests by status" /><div className="admin-source-content">{adminRequestStatusCounts.filter((item) => item.count > 0).map((item) => <div className="admin-source-item" key={item.status}><span>{statusLabel(item.status)}</span><strong>{item.count}</strong><i><b style={{ width: `${adminRequests.length ? (item.count / adminRequests.length) * 100 : 0}%` }} /></i></div>)}{!adminRequests.length && <p>No request activity recorded in this period.</p>}</div></Card>
        <Card className="admin-insight-card"><CardHeading title="Requests by source" /><div className="admin-source-content">{adminSourceCountries.map((country) => { const count = adminRequests.filter((request) => request.sourceCountry === country).length; return <div className="admin-source-item" key={country}><span>{country}</span><strong>{adminRequests.length ? `${Math.round((count / adminRequests.length) * 100)}%` : '0%'}</strong><i><b style={{ width: `${adminRequests.length ? (count / adminRequests.length) * 100 : 0}%` }} /></i></div>; })}{!adminSourceCountries.length && <p>No source country data in this period.</p>}</div></Card>
        <Card className="admin-insight-card"><CardHeading title="Offer funnel" /><div className="admin-source-content"><div className="admin-source-item"><span>Requests with offers</span><strong>{adminRequests.filter((request) => request.offers?.length).length}</strong><i><b style={{ width: `${adminRequests.length ? (adminRequests.filter((request) => request.offers?.length).length / adminRequests.length) * 100 : 0}%` }} /></i></div><div className="admin-source-item"><span>Offers accepted</span><strong>{adminOffers.filter((offer) => offer.status === 'accepted').length}</strong><i><b style={{ width: `${adminOffers.length ? (adminOffers.filter((offer) => offer.status === 'accepted').length / adminOffers.length) * 100 : 0}%` }} /></i></div><div className="admin-source-item"><span>Delivered</span><strong>{adminRequestStatusCounts.find((item) => item.status === 'delivered')?.count || 0}</strong></div></div></Card>
      </div></div>;
    }

    if (adminMode && section === 'settings') {
      return <AdminSettings />;
    }

    if (adminMode && section === 'messages') {
      return <AdminChats />;
    }

    if (customerMode && section === 'companies') {
      return <Card><CardHeading title="Cargo companies" subtitle="Providers who have sent quotes for your requests." />{loading ? <p className="empty-table" role="status">Loading cargo providers…</p> : quotedProviders.length ? <div className="customer-directory-list">{quotedProviders.map((provider) => <div className="customer-company-row" key={provider.id}><Avatar name={provider.name} className="customer-company-avatar navy" /><span className="customer-row-copy"><strong>{provider.name}</strong><small>{provider.offers} quote{provider.offers === 1 ? '' : 's'} on your requests</small></span><button className="customer-outline-button" disabled={!provider.requestId} onClick={() => { setSelectedRequestId(provider.requestId); setSection('offers'); }}>View quotes</button></div>)}</div> : <div className="empty-state"><strong>No cargo companies yet</strong><p>Companies appear here after they send a quote on one of your requests.</p><button className="small-primary" onClick={() => setSection('requests')}>View requests</button></div>}</Card>;
    }

    if (customerMode && section === 'notifications') {
      return <Card><CardHeading title="Notifications" subtitle="Updates from your shipping requests." />{loading ? <p className="empty-table" role="status">Loading updates…</p> : pendingOffers.length ? <div className="customer-directory-list">{pendingOffers.map((offer) => <div className="customer-offer-row" key={offer._id}><span className="customer-company-avatar blue"><Icon name="mail" size={15} /></span><span className="customer-row-copy"><strong>New quote for {offer.request.product}</strong><small>{offer.provider?.name || 'Cargo provider'} · {formatUsd(offer.price)} · {offer.deliveryDays} days</small></span><button className="small-primary" onClick={() => { setSelectedRequestId(offer.request.id); setSection('offers'); }}>Review</button></div>)}</div> : <div className="empty-state"><strong>You’re all caught up</strong><p>New provider quotes for your requests will appear here.</p></div>}</Card>;
    }

    if (customerMode && section === 'profile') {
      return <Card><CardHeading title="Profile" subtitle="Your account details." />{user ? <><div className="profile-identity-row"><ProtectedAvatar fileId={user.profilePhoto} name={user.name} className="profile-avatar-large" /><div><strong>{user.name}</strong><span>{config.label} · {user.country}</span></div></div><div className="customer-profile-grid"><div><span>Full name</span><strong>{user.name}</strong></div><div><span>Phone number</span><strong>{user.phone || 'Not provided'}</strong></div><div><span>Email address</span><strong>{user.email}</strong></div><div><span>Country</span><strong>{user.country}</strong></div></div></> : <p className="empty-table" role="status">Loading profile…</p>}</Card>;
    }

    if (customerMode) {
      return (
        <div className="customer-dashboard">
          <div className="dashboard-stat-grid customer-stats-grid">
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
                <span className="customer-offer-amount">{formatUsd(offer.price)}{offer.unitPrice && offer.quantityCount ? <small>{offer.quantityCount.toLocaleString('en-US')} × {formatUsd(offer.unitPrice)}</small> : null}</span>
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
          <div className="dashboard-stat-grid provider-stats-grid">
            {[
              ['New requests', requests.length, 'box'],
              ['Offers sent', offers.length, 'chat'],
              ['Customers quoted', providerCustomerIds.size, 'check'],
              ['Offer win rate', `${providerAcceptanceRate}%`, 'star'],
            ].map(([label, value, icon]) => <article className="provider-stat-card" key={label} aria-busy={loading}><span className={`provider-stat-icon${icon === 'star' ? ' amber' : ''}`}><Icon name={icon} size={16} /></span><div><strong>{loading ? '—' : value}</strong><span>{label}</span></div></article>)}
          </div>
          <div className="provider-dashboard-grid">
            <Card className="provider-requests-card">
              <CardHeading title="New requests for you" action={<div className="provider-request-filters">{['All', ...providerCountries].map((country) => <button className={providerCountryFilter === country ? 'active' : ''} aria-pressed={providerCountryFilter === country} key={country} onClick={() => setProviderCountryFilter(country)}>{country}</button>)}</div>} />
              {loading ? <p className="empty-table" role="status">Loading opportunities…</p> : visibleProviderRequests.length ? <div className="provider-request-list">{visibleProviderRequests.slice(0, 8).map((request) => {
                const age = Math.max(0, dashboardLoadedAt - new Date(request.createdAt || 0).getTime());
                const timeLabel = age < 60 * 60 * 1000 ? `${Math.max(1, Math.floor(age / 60000))} min ago` : age < 24 * 60 * 60 * 1000 ? `${Math.floor(age / (60 * 60 * 1000))} hr ago` : new Date(request.createdAt).toLocaleDateString();
                return <div className="provider-request-row" key={request._id}>
                  <span className="provider-request-icon"><Icon name="laptop" size={18} /></span>
                  <div className="provider-request-info">
                    <span className="provider-request-title"><strong>{request.product} · {request.quantity}</strong>{age < 24 * 60 * 60 * 1000 && <span>New</span>}</span>
                    <small>{request.details || `${request.sourceCountry} to ${request.destination}`}</small>
                    <span className="provider-request-meta"><span><b>{request.sourceCountry.slice(0, 2).toUpperCase()}</b>{request.destination}</span><small>{timeLabel}</small></span>
                  </div>
                  <div className="provider-request-actions"><button className="customer-outline-button" disabled={busyId === request._id} onClick={() => handleDeclineRequest(request._id)}>Decline</button><button className="small-primary" disabled={busyId === request._id} onClick={() => { setOfferRequest(request); setEditingOffer(null); setFormError(''); }}>Send offer</button></div>
                </div>;
              })}</div> : <div className="empty-state"><strong>{requests.length ? `No requests from ${providerCountryFilter}` : 'No new requests right now'}</strong><p>{requests.length ? 'Choose another source country to browse available requests.' : 'New customer requests will appear here when available.'}</p></div>}
            </Card>
            <div className="provider-dashboard-aside">
              <Card className="provider-list-card">
                <CardHeading title="Recent customer activity" action={<button className="link-button" onClick={() => setSection('offers')}>My offers <Icon name="arrow" size={14} /></button>} />
                {loading ? <p className="empty-table" role="status">Loading offer activity…</p> : offers.length ? <div className="customer-compact-list">{offers.slice(0, 3).map((offer) => <div className="customer-chat-row" key={offer._id}><Avatar name={offer.request.customer?.name} className="provider-chat-avatar" /><span className="customer-row-copy"><strong>{offer.request.customer?.name || 'Customer'}</strong><small>{offer.request.product} · {offer.status === 'accepted' ? 'Offer accepted' : offer.status === 'declined' ? 'Offer declined' : 'Quote submitted'}</small></span><StatusBadge>{offer.status}</StatusBadge></div>)}</div> : <div className="empty-state"><strong>No customer activity yet</strong><p>Your submitted quotes and customer responses will appear here.</p></div>}
              </Card>
              <Card className="provider-performance-card"><CardHeading title="This month" /><div className="provider-performance">
                <div><span>Offer win rate</span><strong>{loading ? '—' : `${providerAcceptanceRate}%`}</strong><i><b style={{ width: `${providerAcceptanceRate}%` }} /></i></div>
                <div><span>Active shipments</span><strong>{loading ? '—' : providerActiveShipments.length}</strong></div>
                <div><span>Quotes sent this month</span><strong>{loading ? '—' : providerCurrentMonthOffers.length}</strong></div>
                <p>Calculated from your live offers and accepted shipments.</p>
              </div></Card>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="admin-dashboard">
        <div className="dashboard-stat-grid admin-kpi-grid">
          {[
            ['Customers', adminCustomers.size, 'users', 'admin-kpi-blue', 'Customers with requests'],
            ['Cargo companies', adminProviders.size, 'building', 'admin-kpi-green', 'Companies with quotes'],
            ['Requests', adminRequests.length, 'box', 'admin-kpi-blue', 'Shipping requests'],
            ['Awaiting response', adminPendingOffers.length, 'clock', 'admin-kpi-amber', 'Pending offers'],
          ].map(([label, value, icon, tone, note]) => <article className={`admin-kpi ${tone}`} key={label} aria-busy={loading}><span className="admin-kpi-icon"><Icon name={icon} size={16} /></span><span className="admin-kpi-content"><strong>{loading ? '—' : value}</strong><span>{label}</span><small>{loading ? 'Loading live data…' : note}</small></span></article>)}
        </div>
        <div className="admin-insights-grid">
          <Card className="admin-insight-card"><CardHeading title="Requests overview" action={<span className="admin-caption">{loading ? 'Loading…' : `${adminRequests.length} in period`}</span>} /><div className="admin-request-overview">
            <div className="admin-donut" style={{ '--admin-request-complete': `${adminRequests.length ? ((adminRequestStatusCounts.find((item) => item.status === 'delivered')?.count || 0) / adminRequests.length) * 100 : 0}%`, '--admin-request-open': `${adminRequests.length ? (adminRequestStatusCounts.filter((item) => ['open', 'offers_received'].includes(item.status)).reduce((total, item) => total + item.count, 0) / adminRequests.length) * 100 : 0}%`, '--admin-request-cancelled': `${adminRequests.length ? ((adminRequestStatusCounts.find((item) => item.status === 'cancelled')?.count || 0) / adminRequests.length) * 100 : 0}%` }}>
              <span>{adminRequests.length ? `${Math.round(((adminRequestStatusCounts.find((item) => item.status === 'delivered')?.count || 0) / adminRequests.length) * 100)}%` : '—'}</span>
            </div>
            <div className="admin-legend">
              <div><i className="complete" />Completed<strong>{adminRequestStatusCounts.find((item) => item.status === 'delivered')?.count || 0}</strong></div>
              <div><i className="open" />Open<strong>{adminRequestStatusCounts.filter((item) => ['open', 'offers_received'].includes(item.status)).reduce((total, item) => total + item.count, 0)}</strong></div>
              <div><i className="cancelled" />Cancelled<strong>{adminRequestStatusCounts.find((item) => item.status === 'cancelled')?.count || 0}</strong></div>
              <div><i className="progress" />In progress<strong>{adminRequestStatusCounts.filter((item) => ['in_progress', 'purchased', 'shipping'].includes(item.status)).reduce((total, item) => total + item.count, 0)}</strong></div>
            </div>
          </div></Card>
          <Card className="admin-insight-card"><CardHeading title="Requests by source" /><div className="admin-source-content">{adminSourceCountries.map((country) => {
            const count = adminRequests.filter((request) => request.sourceCountry === country).length;
            const abbreviation = country.split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase();
            return <div className="admin-source-item" key={country}><span><b>{abbreviation}</b>{country}</span><strong>{adminRequests.length ? `${Math.round((count / adminRequests.length) * 100)}%` : '0%'}</strong><i><b style={{ width: `${adminRequests.length ? (count / adminRequests.length) * 100 : 0}%` }} /></i></div>;
          })}{!adminSourceCountries.length && <p>No source country data in this period.</p>}</div></Card>
          <Card className="admin-insight-card"><CardHeading title="Recent activity" action={<button className="link-button" onClick={() => setSection('requests')}>All <Icon name="arrow" size={14} /></button>} />{loading ? <p className="empty-table" role="status">Loading recent activity…</p> : adminActivity.length ? <ul className="admin-activity-list">{adminActivity.map((activity) => <li className={activity.tone} key={activity.id}><i /><span><strong>{activity.title}</strong><small>{activity.detail} · {formatRelativeTime(activity.timestamp, currentTime)}</small></span></li>)}</ul> : <p className="admin-empty-note">No marketplace activity in this period.</p>}</Card>
        </div>
        <div className="admin-lower-grid">
          <Card className="admin-latest-card">
            <CardHeading title="Latest requests" action={<button className="link-button" onClick={() => setSection('requests')}>View all <Icon name="arrow" size={14} /></button>} />
            {loading ? <p className="empty-table" role="status">Loading requests…</p> : <div className="table-scroll"><table className="data-table admin-latest-table"><thead><tr><th>ID</th><th>Customer</th><th>Product</th><th>Source</th><th>Offers</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {adminRecentRequests.map((request) => <tr key={request._id}>
                <td className="admin-request-id">REQ-{request._id.slice(-4).toUpperCase()}</td><td>{request.customer?.name || 'Customer'}</td><td>{request.product} · {request.quantity}</td><td>{request.sourceCountry}</td><td>{request.offers?.length || 0}</td><td><StatusBadge>{request.status}</StatusBadge></td>
                <td><div className="table-buttons"><button className="icon-button table-action" aria-label={`Edit ${request.product}`} onClick={() => { setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}><Icon name="edit" size={14} /></button><button className="icon-button table-action" aria-label={`Delete ${request.product}`} disabled={busyId === request._id} onClick={() => deleteShippingRequest(request)}><Icon name="trash" size={14} /></button></div></td>
              </tr>)}
              {!adminRecentRequests.length && <tr><td className="empty-table" colSpan="7">No requests in this period.</td></tr>}
            </tbody></table></div>}
          </Card>
          <Card className="admin-attention-card">
            <CardHeading title="Needs attention" action={<span className="admin-attention-count">{loading ? '—' : adminAttentionRequests.length + (pendingVerifications ? 1 : 0)}</span>} />
            {pendingVerifications > 0 && <div className="admin-attention-item admin-attention-verification"><Icon name="shield" size={15} /><span><strong>{pendingVerifications} verification request{pendingVerifications === 1 ? '' : 's'} waiting</strong><small>Cargo accounts submitted documents for review.</small></span><button className="small-primary" onClick={() => setSection('verifications')}>Review</button></div>}
            {loading ? <p className="empty-table" role="status">Checking open requests…</p> : adminAttentionRequests.length ? <div className="admin-attention-list">{adminAttentionRequests.map((request) => <div className="admin-attention-item" key={request._id}><Icon name="clock" size={15} /><span><strong>Request without offers for 3+ days</strong><small>{request.product} · {request.sourceCountry} to {request.destination}</small></span><button className="customer-outline-button" onClick={() => { setSearch(request.product); setSection('requests'); }}>Review</button></div>)}</div> : !pendingVerifications && <p className="admin-empty-note">No aged open requests without offers.</p>}
          </Card>
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
              {adminMode && sectionId === 'settings' && <span className="sidebar-section-label">SYSTEM</span>}
          {providerMode && sectionId === 'company' && <span className="sidebar-section-label">COMPANY</span>}
          <button className={`nav-item${section === sectionId ? ' active' : ''}`} onClick={() => {
                if (sectionId === 'new-request') {
                  openCreateRequest();
                  setMobileNavOpen(false);
                  return;
                }
                if (sectionId === 'users' && section !== 'users') {
                  setUsersLoading(true);
                  setUsersError('');
                }
                setSection(sectionId);
                setSearch('');
                setSelectedRequestId('');
                setMobileNavOpen(false);
              }}>
                <Icon name={icon} size={16} /><span>{label}</span>
                {customerMode && sectionId === 'notifications' && pendingOffers.length > 0 && <span className="nav-count">{pendingOffers.length}</span>}
                {providerMode && sectionId === 'opportunities' && requests.length > 0 && <span className="nav-count">{requests.length}</span>}
                {adminMode && sectionId === 'verifications' && pendingVerifications > 0 && <span className="nav-count nav-count-alert" aria-label={`${pendingVerifications} pending`}>{pendingVerifications}</span>}
                {providerMode && sectionId === 'settings' && ['unverified', 'rejected'].includes(user?.verification?.status) && <span className="nav-dot" aria-label="Verification needed" />}
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
          <div className="customer-topbar-title"><strong>{title}</strong><span className="topbar-welcome">Welcome back, {displayName}{providerMode && user?.verification?.status === 'approved' && <span className="topbar-verified-badge" title={`Verified ${user.role === 'cargo_provider' ? 'cargo company' : 'cargo provider'}`}><Icon name="shield" size={13} />Verified</span>}</span></div>
          <div className="topbar-actions">
            {providerMode && <span className="provider-country-chip"><b>{user?.country?.slice(0, 2).toUpperCase() || '—'}</b>{user?.country || 'Country not set'}</span>}
            {adminMode && section === 'overview' && <div className="admin-period-switch" role="group" aria-label="Filter dashboard period">
              {['7 days', '30 days', 'All time'].map((period) => <button
                className={adminPeriod === period ? 'active' : ''}
                aria-pressed={adminPeriod === period}
                key={period}
                onClick={() => {
                  setCurrentTime(Date.now());
                  setAdminPeriod(period);
                }}
              >{period}</button>)}
            </div>}
            {adminMode && <button className="admin-export-button" onClick={exportRequests} disabled={loading}><Icon name="download" size={13} />Export</button>}
            {(section === 'requests' || section === 'opportunities') && <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests…" /></label>}
            {customerMode && <button className="notification-button" aria-label={`${pendingOffers.length} pending offer notifications`} title="Notifications" onClick={() => setSection('notifications')}><Icon name="bell" size={16} />{pendingOffers.length > 0 && <i />}</button>}
            {customerMode && section === 'overview' && <button className="primary-button" onClick={openCreateRequest}><Icon name="plus" size={16} />New request</button>}
            <Avatar name={displayName} className={`topbar-avatar${providerMode || adminMode ? ' provider-topbar-avatar' : ''}`} />
          </div>
        </header>
        <main className={`dashboard-main dashboard-main-wide${customerMode ? ' customer-dashboard-main' : ''}${providerMode ? ' provider-dashboard-main' : ''}${adminMode ? ' admin-dashboard-main' : ''}`}>
          {error && <div className="toast-message toast-error" role="alert"><Icon name="alert" size={17} />{error}<button aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={16} /></button></div>}
          {message && <div className="toast-message" role="status"><Icon name="check" size={17} />{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></div>}
          {providerMode && user && section !== 'settings' && !verificationPromptHidden && ['unverified', 'rejected'].includes(user.verification?.status) && (
            <div className={`verification-prompt${user.verification.status === 'rejected' ? ' rejected' : ''}`} role="status">
              <span className="verification-prompt-icon"><Icon name="shield" size={22} /></span>
              <div>
                <strong>{user.verification.status === 'rejected' ? 'Your verification needs changes' : `Get your ${user.role === 'cargo_provider' ? 'company' : 'account'} verified`}</strong>
                <span>
                  {user.verification.status === 'rejected'
                    ? (user.verification.reviewNote ? `Feedback: “${user.verification.reviewNote}” ` : '') + 'Update your documents in Settings and resubmit.'
                    : user.role === 'cargo_provider'
                      ? 'Want to be officially verified and approved? Upload your business license, ID/passport photo and company legal document in Settings.'
                      : 'Want to be officially verified and approved? Upload your ID/passport photo and personal details in Settings.'}
                </span>
              </div>
              <div className="verification-prompt-actions">
                <button type="button" className="small-primary" onClick={() => setSection('settings')}>{user.verification.status === 'rejected' ? 'Fix in Settings' : 'Verify now'}</button>
                <button type="button" className="text-button" onClick={hideVerificationPrompt}>Later</button>
              </div>
            </div>
          )}
          <div className={`dashboard-content dashboard-layout-wide${customerMode ? ' customer-dashboard-content' : ''}${providerMode ? ' provider-dashboard-content' : ''}${adminMode ? ' admin-dashboard-content' : ''}`}>{renderContent()}</div>
          <footer className="dashboard-footer"><span>Tayonx</span><span>Connect · Request · Ship · Get it done</span></footer>
        </main>
      </div>

      {requestModalOpen && <RequestForm request={editingRequest} saving={saving} error={formError} onSubmit={saveRequest} onClose={() => { setRequestModalOpen(false); setEditingRequest(null); setFormError(''); }} />}
      {(offerRequest || editingOffer) && <OfferForm request={offerRequest || editingOffer?.request} offer={editingOffer} saving={saving} error={formError} onSubmit={saveOffer} onClose={() => { setOfferRequest(null); setEditingOffer(null); setFormError(''); }} />}
      {userModalOpen && <UserForm key={editingUser?.id || 'new'} user={editingUser} saving={saving} error={userFormError} onSubmit={saveUser} onClose={() => { setUserModalOpen(false); setEditingUser(null); setUserFormError(null); }} />}
    </div>
  );
}
