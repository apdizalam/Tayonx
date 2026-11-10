import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from './Icon.jsx';
import Chat from './Chat.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import AdminUserDetails from './AdminUserDetails.jsx';
// Report/analytics pages are loaded on demand to keep the main bundle small.
const AdminAnalytics = lazy(() => import('./AdminAnalytics.jsx'));
const AdminChats = lazy(() => import('./AdminChats.jsx'));
const AdminSettings = lazy(() => import('./AdminSettings.jsx'));
const AdminReports = lazy(() => import('./AdminReports.jsx'));
const ProviderReports = lazy(() => import('./ProviderReports.jsx'));
const pageFallback = <p className="empty-table" role="status">Loading…</p>;
import { NotificationBell, NotificationList } from './NotificationsCenter.jsx';
import { buildNotifications, readIds, writeIds } from '../lib/notifications.js';
import { CompanyDirectory, CompanyPicker, CompanyProfileModal } from './CargoCompanies.jsx';
import AccountFields from './AccountFields.jsx';
import AdminVerifications from './AdminVerifications.jsx';
import VerificationCenter from './VerificationCenter.jsx';
import { ProtectedAvatar } from './ProtectedFile.jsx';
import FilePicker from './FilePicker.jsx';
import { createChatSocket } from '../socket.js';
import { useFileUrl } from '../lib/useFileUrl.js';
import { ACCOUNT_TYPES, COUNTRIES, IMAGE_TYPES, ROLE_LABELS, VERIFICATION_LABELS, cleanText, normalizePhone, validateAccount, validateFile } from '../lib/accountFields.js';
import { calculateOfferPrice, formatUsd, offerBreakdown, parseQuantity, quantityUnitLabel, roundMoney } from '../lib/offerPricing.js';
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
  getProviders,
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
    ],
  },
  provider: {
    label: 'Cargo provider',
    sections: [
      ['overview', 'Dashboard', 'home'],
      ['opportunities', 'Requests', 'box'],
      ['offers', 'My offers', 'mail'],
      // "Orders & shipping" duplicated My offers (now filterable by Shipments); replaced by Reports.
      ['reports', 'Reports & earnings', 'chart'],
      ['messages', 'Chats', 'chat'],
      ['notifications', 'Notifications', 'bell'],
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
      ['notifications', 'Notifications', 'bell'],
      ['messages', 'Support & Disputes', 'headphones'],
      ['analytics', 'Analytics', 'chart'],
      ['reports', 'Data Exports', 'download'],
      ['settings', 'Settings', 'user'],
    ],
  },
};

const shipmentStatuses = ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'];
const dashboardLoadedAt = Date.now();

function statusLabel(status) {
  return status.replaceAll('_', ' ');
}

/** Visible status text, e.g. "offers_received" -> "Offers received" (presentation only). */
const STATUS_TEXT = { shipping: 'In transit' };
function displayStatus(status) {
  if (STATUS_TEXT[status]) return STATUS_TEXT[status];
  const label = statusLabel(String(status || ''));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Shipment lifecycle after an offer is accepted. Providers can move forward to any later
// stage (never back); "delivered" is final. Mirrors the transitions in backend/routes/requests.js.
const SHIPMENT_STAGES = ['in_progress', 'purchased', 'shipping', 'delivered'];

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
  return <span className={`status-badge status-${statusLabel(children).toLowerCase().replaceAll(' ', '-')}`}>{displayStatus(children)}</span>;
}

const DELIVERY_METHODS = {
  sea: { label: 'Ship (Maritime)', short: 'Sea', icon: 'ship' },
  air: { label: 'Aircraft (Air freight)', short: 'Air', icon: 'plane' },
};

/** "Ship (Maritime)" / "Aircraft (Air freight)" chip; nothing for older requests without a method. */
function DeliveryMethodChip({ method, compact = false }) {
  const info = DELIVERY_METHODS[method];
  if (!info) return null;
  return <span className={`delivery-method-chip delivery-${method}`} title={info.label}><Icon name={info.icon} size={13} />{compact ? info.short : info.label}</span>;
}

/** Product photo of a request (protected upload), or a box icon when there is none. */
function RequestThumb({ photoId, product = '', size = 'md', icon = 'box' }) {
  const { url } = useFileUrl(photoId);
  return (
    <span className={`request-thumb request-thumb-${size}${url ? ' has-photo' : ''}`}>
      {url ? <img src={url} alt={product ? `Photo of ${product}` : 'Product photo'} /> : <Icon name={icon} size={size === 'sm' ? 15 : 18} />}
    </span>
  );
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

/** Which cargo company a request was sent to ("Sent to you" for that provider). */
function RequestTargetChip({ request, role }) {
  const target = request.targetProvider;
  if (!target) return null;
  if (role === 'provider') return <span className="request-target-chip mine" title="The customer chose your company for this request"><Icon name="check" size={11} />Sent to you</span>;
  return <span className="request-target-chip" title="Cargo company this request was sent to"><Icon name="building" size={11} />To {target.name || 'cargo company'}</span>;
}

/** When the request last changed status ("since Nov 9"), from the recorded stage history. */
function statusSince(request) {
  const at = request.statusHistory?.at?.(-1)?.at;
  return at ? new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function RequestTable({ requests, role, search, busyId, onView, onEdit, onDelete, onSelectOffers, onCreateOffer, onDeclineRequest }) {
  const visibleRequests = requests.filter((request) =>
    `${request.product} ${request.sourceCountry} ${request.destination} ${statusLabel(request.status)} ${displayStatus(request.status)} ${request.targetProvider?.name || ''} ${request.customer?.name || ''}`
      .toLowerCase().includes(search.toLowerCase()),
  );
  const customer = role === 'customer';
  const admin = role === 'admin';
  // Customers and admins see status read-only; only the assigned cargo provider updates it.
  const readOnly = customer || admin;

  return (
    <div className="table-scroll">
      <table className={`data-table${readOnly ? ' customer-requests-table' : ''}${admin ? ' admin-requests-table' : ''}`}>
        <thead><tr><th>Shipping request</th>{admin && <th>Customer</th>}<th>Route</th><th>Posted</th><th>Offers</th><th>Status</th><th className={readOnly ? 'offer-actions-col' : undefined} scope="col">Actions</th></tr></thead>
        <tbody>
          {visibleRequests.map((request) => {
            const canEdit = admin || customer;
            if (readOnly) {
              const since = statusSince(request);
              const offerCount = request.offers?.length || 0;
              return (
                <tr key={request._id} className="request-row-clickable" onClick={() => onView?.(request)}>
                  <td><span className="request-cell"><RequestThumb photoId={request.productPhoto} product={request.product} size="sm" /><span><span className="table-primary">{request.product} · {request.quantity}</span><span className="table-secondary">REQ-{request._id.slice(-6).toUpperCase()}</span><span className="request-chip-row"><DeliveryMethodChip method={request.deliveryMethod} compact /><RequestTargetChip request={request} role={role} /></span></span></span></td>
                  {admin && <td><span className="request-customer"><span className="request-customer-avatar" aria-hidden="true">{(request.customer?.name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>{request.customer?.name || 'Customer'}</span></td>}
                  <td><span className="request-route">{request.sourceCountry}<Icon name="arrow" size={12} />{request.destination}</span></td>
                  <td className="table-date">{new Date(request.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td onClick={(event) => event.stopPropagation()}>{offerCount
                    ? (customer
                      ? <button type="button" className="request-offers-link" onClick={() => onSelectOffers(request._id)}>{offerCount} offer{offerCount === 1 ? '' : 's'}<Icon name="arrow" size={13} /></button>
                      : <span className="request-offers-count">{offerCount} offer{offerCount === 1 ? '' : 's'}</span>)
                    : <span className="table-secondary">No offers yet</span>}</td>
                  <td><span className="request-status-cell"><StatusBadge>{request.status}</StatusBadge>{since && <small>since {since}</small>}</span></td>
                  <td className="offer-actions-col" onClick={(event) => event.stopPropagation()}><div className="table-buttons offer-actions">
                    <button type="button" className="offer-action-btn view" aria-label={`View details for ${request.product}`} title="View details" onClick={() => onView?.(request)}><Icon name="eye" size={15} /><span>View</span></button>
                    <button type="button" className="offer-action-btn edit" aria-label={`Edit ${request.product}`} title="Edit request" onClick={() => onEdit(request)}><Icon name="edit" size={15} /><span>Edit</span></button>
                    <button type="button" className="offer-action-btn delete" aria-label={`Delete ${request.product}`} title="Delete request" disabled={busyId === request._id} onClick={() => onDelete(request)}><Icon name="trash" size={15} /><span>Delete</span></button>
                  </div></td>
                </tr>
              );
            }
            return (
              <tr key={request._id}>
                <td><span className="request-cell"><RequestThumb photoId={request.productPhoto} product={request.product} size="sm" /><span><span className="table-primary">{request.product} · {request.quantity}</span><span className="table-secondary">{request._id}</span><DeliveryMethodChip method={request.deliveryMethod} compact /><RequestTargetChip request={request} role={role} /></span></span></td>
                <td>{request.sourceCountry} → {request.destination}</td>
                <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                <td>{request.offers?.length || '—'}</td>
                <td><StatusBadge>{request.status}</StatusBadge></td>
                <td><div className="table-buttons">
                  {canEdit && <button className="icon-button table-action" aria-label={`Edit ${request.product}`} onClick={() => onEdit(request)}><Icon name="edit" size={16} /></button>}
                  {role === 'provider' && ['open', 'offers_received'].includes(request.status) && <><button className="customer-outline-button" disabled={busyId === request._id} onClick={() => onDeclineRequest(request._id)}>Decline</button><button className="small-primary" disabled={busyId === request._id} onClick={() => onCreateOffer(request)}>Send offer</button></>}
                </div></td>
              </tr>
            );
          })}
          {!visibleRequests.length && <tr><td className="empty-table" colSpan={admin ? 7 : 6}>{search ? 'No requests match your search.' : role === 'provider' ? 'No open requests from your country right now.' : 'No shipping requests yet.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What each role may do with an offer (mirrors the server rules):
 *  - customer: accept/decline pending, reconsider declined (while nothing is accepted),
 *              remove pending/declined, chat on accepted;
 *  - provider: edit/withdraw own pending offers;
 *  - admin:    read-only.
 */
function offerPermissions(offer, role) {
  const requestOpen = ['open', 'offers_received'].includes(offer.request?.status);
  return {
    canRespond: role === 'customer' && offer.status === 'pending',
    canReconsider: role === 'customer' && offer.status === 'declined' && requestOpen,
    canRemove: role === 'customer' && ['pending', 'declined'].includes(offer.status) && offer.request?.status !== 'cancelled',
    canChat: offer.status === 'accepted' && (
      (role === 'customer' && Boolean(offer.provider))
      || (role === 'provider' && Boolean(offer.request?.customer))
    ),
    canEdit: role === 'provider' && offer.status === 'pending',
    canWithdraw: role === 'provider' && offer.status === 'pending',
  };
}

/** Why Edit/Delete is unavailable for this offer (shown as the disabled button's tooltip). */
function lockedReason(offer, action) {
  if (offer.status === 'accepted') return action === 'edit' ? 'Accepted offers can’t be edited' : 'Accepted offers can’t be deleted while the shipment is in progress';
  if (offer.status === 'declined') return action === 'edit' ? 'Declined offers can’t be edited' : 'This offer can’t be deleted';
  return action === 'edit' ? 'This offer can’t be edited' : 'This offer can’t be deleted';
}

/**
 * Action buttons for one offer, in the same order in every dashboard:
 * View → Edit → Delete → decision (Accept / Decline / Reconsider) → Chat.
 * In tables, Edit/Delete stay in place (disabled, with a reason) so columns line up.
 * Used in the table rows and in the details modal (inModal).
 */
function OfferActions({ offer, role, busy, onView, onEdit, onDelete, onRespond, onReconsider, onRemove, onChat, inModal = false }) {
  const can = offerPermissions(offer, role);
  const otherParty = role === 'provider' ? offer.request?.customer?.name || 'the customer' : offer.provider?.name || 'the cargo provider';
  const stop = (handler) => (event) => { event.stopPropagation(); handler(offer); };
  const product = offer.request?.product || 'this request';

  // Delete means "withdraw" for the provider who sent the offer and "remove" for the customer who received it.
  const deleteHandler = role === 'provider' ? onDelete : role === 'customer' ? onRemove : null;
  const canDelete = role === 'provider' ? can.canWithdraw : can.canRemove;
  const deleteLabel = role === 'provider' ? 'Withdraw offer' : 'Remove offer';
  const showEdit = role === 'provider' && onEdit && (!inModal || can.canEdit);
  const showDelete = Boolean(deleteHandler) && (!inModal || canDelete);

  return (
    <div className={`table-buttons offer-actions${inModal ? ' offer-actions-modal' : ''}`}>
      {!inModal && onView && (
        <button type="button" className="offer-action-btn view" aria-label={`View offer details for ${product}`} title="View details" onClick={stop(onView)}><Icon name="eye" size={15} /><span>View</span></button>
      )}
      {showEdit && (
        <button type="button" className={inModal ? 'customer-outline-button' : 'offer-action-btn edit'} aria-label={`Edit offer for ${product}`} title={can.canEdit ? 'Edit offer' : lockedReason(offer, 'edit')} disabled={!can.canEdit || busy} onClick={stop(onEdit)}><Icon name="edit" size={15} /><span>{inModal ? 'Edit offer' : 'Edit'}</span></button>
      )}
      {showDelete && (
        <button type="button" className={inModal ? 'reject-button' : 'offer-action-btn delete'} aria-label={`${deleteLabel}${role === 'customer' ? ` from ${otherParty}` : ` for ${product}`}`} title={canDelete ? deleteLabel : lockedReason(offer, 'delete')} disabled={!canDelete || busy} onClick={stop(deleteHandler)}><Icon name="trash" size={15} /><span>{inModal ? deleteLabel : 'Delete'}</span></button>
      )}
      {can.canRespond && onRespond && <>
        <button type="button" className="reject-button" disabled={busy} onClick={stop((item) => onRespond(item, 'declined'))}>Decline</button>
        <button type="button" className="approve-button" disabled={busy} onClick={stop((item) => onRespond(item, 'accepted'))}>Accept</button>
      </>}
      {can.canReconsider && onReconsider && <button type="button" className="customer-outline-button" disabled={busy} title="Move this offer back to pending" onClick={stop(onReconsider)}><Icon name="refresh" size={15} />Reconsider</button>}
      {can.canChat && onChat && (
        <button type="button" className="offer-chat-button" onClick={stop(onChat)} aria-label={`Chat with ${otherParty} about ${product}`} title={`Chat with ${otherParty}`}>
          <Icon name="chat" size={15} />Chat
        </button>
      )}
    </div>
  );
}

function OffersTable({ offers, role, busyId, onView, onEdit, onDelete, onRespond, onReconsider, onRemove, onStatusChange, onChat }) {
  if (!offers.length) {
    return <p className="empty-table">{role === 'customer' ? 'No offers have been submitted for your requests.' : role === 'admin' ? 'No offers have been submitted on the marketplace yet.' : 'You have not sent any offers yet.'}</p>;
  }

  return (
    <div className="table-scroll">
      <table className={`data-table offers-table${role === 'admin' ? ' admin-offers-table' : ''}`}>
        <thead><tr><th>Request</th><th>{role === 'customer' || role === 'admin' ? 'Cargo provider' : 'Customer'}</th>{role === 'admin' && <th>Customer</th>}<th>Quote</th><th>Delivery</th><th>Status / shipment</th><th className="offer-actions-col" scope="col">Actions</th></tr></thead>
        <tbody>{offers.map((offer) => {
          const stageIndex = SHIPMENT_STAGES.indexOf(offer.request.status);
          // The provider can still update progress until the shipment is delivered.
          const nextStatus = stageIndex >= 0 && stageIndex < SHIPMENT_STAGES.length - 1;
          return (
            <tr key={offer._id} className={onView ? 'offer-row-clickable' : undefined} onClick={onView ? () => onView(offer) : undefined}>
              <td><span className="request-cell"><RequestThumb photoId={offer.request.productPhoto} product={offer.request.product} size="sm" /><span><span className="table-primary">{offer.request.product}</span><span className="table-secondary">{offer.request.quantity}</span><DeliveryMethodChip method={offer.request.deliveryMethod} compact /></span></span></td>
              <td>{role === 'customer' || role === 'admin' ? offer.provider?.name || 'Cargo provider' : offer.request.customer?.name || 'Customer'}</td>
              {role === 'admin' && <td>{offer.request.customer?.name || 'Customer'}</td>}
              <td><OfferPriceBreakdown offer={offer} /></td>
              <td>{offer.deliveryDays} days</td>
              <td onClick={(event) => event.stopPropagation()}>{role === 'provider' && offer.status === 'accepted' && nextStatus
                ? <select className="shipment-status-select" aria-label={`Update shipment progress for ${offer.request.product}`} value={offer.request.status} disabled={busyId === offer.request.id} onChange={(event) => onStatusChange(offer.request.id, event.target.value, offer.request.product)}>
                  {SHIPMENT_STAGES.map((stage, index) => <option key={stage} value={stage} disabled={index < stageIndex}>{displayStatus(stage)}</option>)}
                </select>
                : role === 'admin' && offer.status === 'accepted'
                  ? <span className="request-status-cell"><StatusBadge>{offer.status}</StatusBadge><small>Shipment: {displayStatus(offer.request.status)}</small></span>
                  : <StatusBadge>{role === 'provider' && offer.status === 'accepted' ? offer.request.status : offer.status}</StatusBadge>}</td>
              <td className="offer-actions-col"><OfferActions offer={offer} role={role} busy={busyId === offer._id} onView={onView} onEdit={onEdit} onDelete={onDelete} onRespond={onRespond} onReconsider={onReconsider} onRemove={onRemove} onChat={onChat} /></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/** Shown to cargo providers instead of incoming requests until an admin approves their account. */
function VerificationGate({ status = 'unverified', isCompany, country, onVerify }) {
  const pending = status === 'pending';
  const rejected = status === 'rejected';
  return (
    <div className={`verification-gate${pending ? ' pending' : ''}${rejected ? ' rejected' : ''}`} role="status">
      <span className="verification-gate-icon" aria-hidden="true"><Icon name={pending ? 'clock' : 'shield'} size={26} /></span>
      <strong>{pending ? 'Your verification is being reviewed' : rejected ? 'Your verification needs changes' : `Verify your ${isCompany ? 'company' : 'account'} to see requests`}</strong>
      <p>
        {pending
          ? 'An administrator is checking your documents. Shipping requests will appear here as soon as your account is approved.'
          : `Only verified cargo providers can see and quote on shipping requests${country ? ` from ${country}` : ''}. ${rejected ? 'Update your documents in Settings and resubmit.' : 'Upload your documents in Settings to get approved.'}`}
      </p>
      <button type="button" className="small-primary" onClick={onVerify}>{pending ? 'View status' : rejected ? 'Fix in Settings' : 'Verify now'}<Icon name="arrow" size={14} /></button>
    </div>
  );
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

// Admin "Shipping requests" status tabs.
const ADMIN_REQUEST_GROUPS = [
  { id: 'all', label: 'All', statuses: ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'] },
  { id: 'awaiting', label: 'Awaiting offers', statuses: ['open', 'offers_received'] },
  { id: 'active', label: 'In progress', statuses: ['in_progress', 'purchased', 'shipping'] },
  { id: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

const TIMELINE_STAGES = ['Offer accepted', 'Item purchased', 'In transit', 'Delivered'];
const TIMELINE_STAGES_SHORT = ['Accepted', 'Purchased', 'In transit', 'Delivered'];

/** Shipment progress (Offer accepted → Item purchased → In transit → Delivered) with stage dates. */
function ShipmentTimeline({ request, compact = false }) {
  const stageIndex = Math.max(0, SHIPMENT_STAGES.indexOf(request.status));
  const delivered = request.status === 'delivered';
  const reachedAt = (stage) => [...(request.statusHistory || [])].reverse().find((entry) => entry.status === stage)?.at;
  const shortDate = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <ol className={`shipment-tracking${compact ? ' compact' : ''}`}>
      {(compact ? TIMELINE_STAGES_SHORT : TIMELINE_STAGES).map((stage, index) => {
        const done = delivered || index < stageIndex;
        const current = !delivered && index === stageIndex;
        const when = reachedAt(SHIPMENT_STAGES[index]);
        // Compact (dashboard): just the date under each reached stage; full: "Current status · since …".
        const note = compact
          ? (when && (done || current) ? shortDate(when) : current ? 'Now' : '')
          : current ? `Current status${when ? ` · since ${shortDate(when)}` : ''}` : done && when ? shortDate(when) : '';
        return <li className={done ? 'complete' : current ? 'current' : ''} key={stage} aria-current={current ? 'step' : undefined}><i /><span><strong>{stage}</strong>{note && <small>{note}</small>}</span></li>;
      })}
    </ol>
  );
}

/**
 * Customer "View details" for one shipping request: photo, route, delivery method, chosen
 * company, offers and live shipment progress. Status is read-only (the cargo provider updates
 * it); the customer may cancel the request before the item is purchased.
 * Admins (role="admin") get the same view plus the customer, with status read-only and no Cancel.
 */
function RequestDetailsModal({ request, role = 'customer', busy, onClose, onEdit, onDelete, onCancel, onViewOffers }) {
  const admin = role === 'admin';
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const shipment = SHIPMENT_STAGES.includes(request.status);
  const canCancel = !admin && ['open', 'offers_received', 'in_progress'].includes(request.status);
  const offersCount = request.offers?.length || 0;
  const accepted = request.offers?.find((offer) => offer.status === 'accepted');

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="request-modal offer-details-modal request-details-modal" role="dialog" aria-modal="true" aria-labelledby="request-details-title">
        <div className="modal-heading offer-modal-heading">
          <div className="offer-request-summary">
            <RequestThumb photoId={request.productPhoto} product={request.product} size="lg" />
            <div>
              <p className="eyebrow">SHIPPING REQUEST · REQ-{request._id.slice(-6).toUpperCase()}</p>
              <h2 id="request-details-title">{request.product}</h2>
              <span className="offer-details-chips"><StatusBadge>{request.status}</StatusBadge><DeliveryMethodChip method={request.deliveryMethod} /></span>
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>

        {admin && <p className="offer-readonly-note"><Icon name="eye" size={15} />Status is read-only · shipment progress is updated by the assigned cargo provider.</p>}

        <div className="offer-details-grid">
          <section className="offer-details-section">
            <h3>Request</h3>
            <dl>
              {admin && <div><dt>Customer</dt><dd>{request.customer?.name || '—'}</dd></div>}
              <div><dt>Item</dt><dd>{request.product}</dd></div>
              <div><dt>Quantity</dt><dd>{request.quantity}</dd></div>
              <div><dt>Route</dt><dd>{request.sourceCountry} → {request.destination}</dd></div>
              <div><dt>Shipping</dt><dd>{DELIVERY_METHODS[request.deliveryMethod]?.label || '—'}</dd></div>
              <div><dt>Posted</dt><dd>{formatDateTime(request.createdAt)}</dd></div>
            </dl>
          </section>
          <section className="offer-details-section">
            <h3>Cargo company</h3>
            <dl>
              <div><dt>Sent to</dt><dd>{request.targetProvider?.name || 'Open to providers in the source country'}</dd></div>
              <div><dt>Offers</dt><dd>{offersCount ? `${offersCount} offer${offersCount === 1 ? '' : 's'}` : 'No offers yet'}</dd></div>
              <div><dt>Handling</dt><dd>{accepted?.provider?.name || (shipment ? 'Accepted provider' : '—')}</dd></div>
              <div><dt>Status</dt><dd>{displayStatus(request.status)}</dd></div>
            </dl>
          </section>
        </div>

        {request.details && <section className="offer-details-section"><h3>Additional details</h3><p className="request-details-note">{request.details}</p></section>}

        <section className="offer-details-section request-progress-section">
          <h3>Shipment progress</h3>
          {shipment
            ? <><ShipmentTimeline request={request} /><p className="offer-details-hint"><Icon name="shield" size={14} />Progress is updated by {admin ? 'the assigned' : 'your'} cargo provider and shown here in real time.</p></>
            : <p className="offer-details-hint">{request.status === 'cancelled' ? 'This request was cancelled.' : admin ? 'Tracking starts when the customer accepts an offer.' : 'Tracking starts when you accept an offer.'}</p>}
        </section>

        <footer className="offer-details-footer request-details-footer">
          {offersCount > 0 && <button type="button" className="customer-outline-button" onClick={() => onViewOffers(request)}><Icon name="mail" size={15} />View offers</button>}
          <button type="button" className="customer-outline-button" onClick={() => onEdit(request)}><Icon name="edit" size={15} />Edit</button>
          {canCancel && <button type="button" className="reject-button" disabled={busy} onClick={() => onCancel(request)}><Icon name="close" size={15} />Cancel request</button>}
          <button type="button" className="reject-button" disabled={busy} onClick={() => onDelete(request)}><Icon name="trash" size={15} />Delete</button>
        </footer>
      </section>
    </div>
  );
}

/** Full breakdown of one offer. Admins get a read-only view (no actions). */
function OfferDetailsModal({ offer, role, busy, onClose, ...actions }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const price = offerBreakdown(offer);
  const request = offer.request || {};
  const unitLabel = quantityUnitLabel(request.quantity, price.quantityCount);
  const showCustomer = role !== 'customer';
  const showProvider = role !== 'provider';
  const can = offerPermissions(offer, role);
  const hasActions = Object.values(can).some(Boolean);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="request-modal offer-details-modal" role="dialog" aria-modal="true" aria-labelledby="offer-details-title">
        <div className="modal-heading offer-modal-heading">
          <div className="offer-request-summary">
            <RequestThumb photoId={request.productPhoto} product={request.product} size="lg" />
            <div>
              <p className="eyebrow">OFFER DETAILS</p>
              <h2 id="offer-details-title">{request.product}</h2>
              <span className="offer-details-chips"><StatusBadge>{offer.status}</StatusBadge><DeliveryMethodChip method={request.deliveryMethod} /></span>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>

        {role === 'admin' && <p className="offer-readonly-note"><Icon name="eye" size={15} />Read-only · administrators can review offers but not change them.</p>}

        <div className="offer-details-grid">
          <section className="offer-details-section">
            <h3>Request</h3>
            <dl>
              <div><dt>Item</dt><dd>{request.product}</dd></div>
              <div><dt>Quantity</dt><dd>{request.quantity || '—'}</dd></div>
              <div><dt>Route</dt><dd>{request.sourceCountry || '—'} → {request.destination || '—'}</dd></div>
              <div><dt>Shipping</dt><dd>{request.deliveryMethod ? <DeliveryMethodChip method={request.deliveryMethod} /> : 'Not specified'}</dd></div>
              <div><dt>Request status</dt><dd>{request.status ? displayStatus(request.status) : '—'}</dd></div>
              {showCustomer && <div><dt>Customer</dt><dd>{request.customer?.name || 'Customer'}</dd></div>}
            </dl>
          </section>
          <section className="offer-details-section">
            <h3>Offer</h3>
            <dl>
              {showProvider && <div><dt>Cargo provider</dt><dd>{offer.provider?.name || 'Cargo provider'}</dd></div>}
              <div><dt>Delivery time</dt><dd>{offer.deliveryDays} day{offer.deliveryDays === 1 ? '' : 's'}</dd></div>
              <div><dt>Submitted</dt><dd>{formatDateTime(offer.createdAt)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDateTime(offer.updatedAt)}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge>{offer.status}</StatusBadge></dd></div>
            </dl>
          </section>
        </div>

        <section className="offer-summary offer-details-pricing" aria-label="Price breakdown">
          {price.hasUnits ? (
            <>
              <div><span>Unit price<small>Price per item</small></span><strong>{formatUsd(price.unitPrice)}</strong></div>
              <div><span>Product subtotal<small>{price.quantityCount.toLocaleString('en-US')} {unitLabel} × {formatUsd(price.unitPrice)}</small></span><strong>{formatUsd(price.subtotal)}</strong></div>
              <div><span>Delivery fee</span><strong>{price.deliveryFee === null ? 'Included' : price.deliveryFee > 0 ? formatUsd(price.deliveryFee) : 'Free'}</strong></div>
            </>
          ) : (
            <div><span>Quote<small>This offer was sent before itemised pricing, so only the total is available.</small></span><strong>{formatUsd(price.total)}</strong></div>
          )}
          <div className="offer-summary-total"><span>Total quote</span><strong>{formatUsd(price.total)}</strong></div>
        </section>

        <section className="offer-details-section">
          <h3>Included services</h3>
          <p className="offer-details-services">{offer.includes?.trim() || 'No services listed.'}</p>
        </section>

        {offer.status === 'accepted' && role === 'customer' && <p className="offer-details-hint"><Icon name="check" size={15} />You accepted this offer. The shipment is in progress, so it can’t be removed. Use Chat to coordinate with the provider.</p>}
        {offer.status === 'declined' && role === 'customer' && !can.canReconsider && <p className="offer-details-hint"><Icon name="alert" size={15} />You accepted another offer for this request, so this one can’t be reconsidered.</p>}

        {role !== 'admin' && hasActions && (
          <div className="offer-details-footer">
            <OfferActions offer={offer} role={role} busy={busy} inModal {...actions} />
          </div>
        )}
      </section>
    </div>
  );
}

/** The request's current product photo in the edit form, with a remove/undo toggle. */
function CurrentProductPhoto({ photoId, product, removed, onToggle }) {
  const { url } = useFileUrl(removed ? null : photoId);
  return (
    <div className={`current-product-photo${removed ? ' removed' : ''}`}>
      <span className="request-thumb request-thumb-lg">{url ? <img src={url} alt={`Current photo of ${product}`} /> : <Icon name="image" size={20} />}</span>
      <span><strong>{removed ? 'Photo will be removed' : 'Current photo'}</strong><small>{removed ? 'Save to remove it, or undo.' : 'Upload a new photo below to replace it.'}</small></span>
      <button type="button" className="text-button" onClick={onToggle}>{removed ? 'Undo' : 'Remove'}</button>
    </div>
  );
}

/**
 * New requests are company-first: step 1 picks a verified cargo company, step 2 collects the
 * shipping details for that company. Editing an existing request skips straight to the details.
 */
function RequestForm({ request, saving, error, onSubmit, onClose, companies = {}, initialCompany = null }) {
  const isNew = !request;
  const [company, setCompany] = useState(initialCompany);
  const [step, setStep] = useState(isNew && !initialCompany ? 'company' : 'details');
  const [values, setValues] = useState({
    product: request?.product || '',
    sourceCountry: request?.sourceCountry || initialCompany?.country || 'China',
    destination: request?.destination || '',
    quantity: request?.quantity || '',
    deliveryMethod: request?.deliveryMethod || '',
    details: request?.details || '',
  });
  const [photo, setPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState({});

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const next = {};
    // Providers price offers per item, so the quantity needs a whole number.
    if (!parseQuantity(values.quantity)) next.quantity = 'Include a whole number, e.g. “50 laptops”.';
    if (!DELIVERY_METHODS[values.deliveryMethod]) next.deliveryMethod = 'Choose how the item should be shipped.';
    const photoError = validateFile(photo, IMAGE_TYPES);
    if (photoError) next.productPhoto = photoError;
    setErrors(next);
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      document.getElementById(`request-${firstInvalid}`)?.focus();
      return;
    }

    if (isNew && !company) {
      setStep('company');
      return;
    }

    // Multipart so the optional product photo can be uploaded with the request.
    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.append(key, value.trim());
    if (isNew) body.append('targetProvider', company.id);
    if (photo) body.append('productPhoto', photo);
    else if (removePhoto) body.append('removeProductPhoto', 'true');
    onSubmit(body);
  }

  const fieldError = (name) => errors[name] && <span className="offer-field-error" id={`request-${name}-error`} role="alert">{errors[name]}</span>;

  function chooseCompany(next) {
    setCompany(next);
    // Default the source country to where the chosen company operates (still editable).
    if (!values.product && !values.quantity) setValues((current) => ({ ...current, sourceCountry: next.country || current.sourceCountry }));
  }

  const stepper = isNew && (
    <ol className="request-steps" aria-label="New request steps">
      <li className={step === 'company' ? 'current' : 'done'}><span>{step === 'company' ? '1' : <Icon name="check" size={12} />}</span>Choose a cargo company</li>
      <li className={step === 'details' ? 'current' : ''}><span>2</span>Shipping details</li>
    </ol>
  );

  if (isNew && step === 'company') {
    return (
      <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="request-modal shipping-request-modal company-step-modal" role="dialog" aria-modal="true" aria-labelledby="request-company-title">
          <div className="modal-heading"><div><p className="eyebrow">NEW SHIPPING REQUEST</p><h2 id="request-company-title">Which cargo company should handle it?</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
          {stepper}
          <p className="company-step-hint">Only verified companies are listed. Your request is sent to the company you choose.</p>
          <CompanyPicker providers={companies.list || []} loading={companies.loading} error={companies.error} selectedId={company?.id} onSelect={chooseCompany} onRetry={companies.retry} />
          <div className="company-step-footer">
            <button type="button" className="customer-outline-button" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-button" disabled={!company} onClick={() => setStep('details')}>Continue<Icon name="arrow" size={15} /></button>
          </div>
        </section>
      </div>
    );
  }

  const target = isNew ? company : request?.targetProvider;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal shipping-request-modal" onSubmit={handleSubmit} noValidate>
        <div className="modal-heading"><div><p className="eyebrow">{request ? 'EDIT SHIPPING REQUEST' : 'NEW SHIPPING REQUEST'}</p><h2>{request ? 'Update your request' : 'What are you looking for?'}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        {stepper}
        {target?.name && (
          <div className="request-target-banner">
            <span className="company-avatar" aria-hidden="true">{target.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
            <span><small>{isNew ? 'Sending this request to' : 'Sent to'}</small><strong>{target.name}</strong><small>{target.role === 'cargo_provider' ? 'Cargo company' : 'Individual cargo'}{target.country ? ` · ${target.country}` : ''}</small></span>
            {isNew && <button type="button" className="link-button" onClick={() => setStep('company')}>Change</button>}
          </div>
        )}
        <label>Product or item<input name="product" value={values.product} onChange={change} maxLength="160" required placeholder="e.g. 50 business laptops" /></label>
        <div className="form-row"><label>Source country<select name="sourceCountry" value={values.sourceCountry} onChange={change}>{[...new Set([...COUNTRIES, values.sourceCountry, 'Other'])].filter(Boolean).map((country) => <option key={country} value={country}>{country}</option>)}</select></label><label>Delivery to<input name="destination" value={values.destination} onChange={change} maxLength="160" required placeholder="City, country" /></label></div>
        <div className="form-row">
          <label>Quantity<input id="request-quantity" name="quantity" value={values.quantity} onChange={change} maxLength="100" required placeholder="e.g. 50 laptops" aria-invalid={Boolean(errors.quantity)} aria-describedby="request-quantity-help" />
            <small id="request-quantity-help" className="offer-field-help">Number of items — providers quote a price per item.</small>
            {fieldError('quantity')}
          </label>
          <label>Delivery method
            <select id="request-deliveryMethod" name="deliveryMethod" value={values.deliveryMethod} onChange={change} required aria-invalid={Boolean(errors.deliveryMethod)} aria-describedby={errors.deliveryMethod ? 'request-deliveryMethod-error' : 'request-deliveryMethod-help'}>
              <option value="" disabled>Choose a method</option>
              {Object.entries(DELIVERY_METHODS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
            </select>
            <small id="request-deliveryMethod-help" className="offer-field-help">{values.deliveryMethod === 'air' ? 'Faster, usually more expensive.' : values.deliveryMethod === 'sea' ? 'Slower, best for large or heavy orders.' : 'How the cargo should travel.'}</small>
            {fieldError('deliveryMethod')}
          </label>
        </div>

        <div className="request-photo-field">
          {request?.productPhoto && !photo && (
            <CurrentProductPhoto photoId={request.productPhoto} product={request.product} removed={removePhoto} onToggle={() => setRemovePhoto((current) => !current)} />
          )}
          <FilePicker
            id="request-productPhoto"
            label={request?.productPhoto ? 'Replace product photo' : 'Product photo (optional)'}
            hint="JPG, PNG or WebP · max 5 MB"
            accept="image/jpeg,image/png,image/webp"
            file={photo}
            error={errors.productPhoto}
            onChange={(file) => { setPhoto(file); setErrors((current) => ({ ...current, productPhoto: '' })); }}
          />
        </div>

        <label>Additional details<textarea name="details" value={values.details} onChange={change} maxLength="2000" rows="3" /></label>
        {error && <p className="signin-message" role="alert">{error}</p>}
        <button className="primary-button full-button" disabled={saving} type="submit">{saving ? 'Saving…' : request ? 'Save changes' : `Send request${company ? ` to ${company.name}` : ''}`}</button>
      </form>
    </div>
  );
}

/**
 * Price breakdown of a stored offer, shown to customers, providers and admins.
 * Older offers without itemised pricing show only their total.
 */
function OfferPriceBreakdown({ offer }) {
  const price = offerBreakdown(offer);
  return (
    <span className="offer-breakdown">
      <b className="offer-breakdown-total">{formatUsd(price.total)}</b>
      {price.hasUnits && <span>{price.quantityCount.toLocaleString('en-US')} × {formatUsd(price.unitPrice)} = {formatUsd(price.subtotal)}</span>}
      {price.deliveryFee !== null && <span>{price.deliveryFee > 0 ? `+ ${formatUsd(price.deliveryFee)} delivery` : 'Free delivery'}</span>}
    </span>
  );
}


function blankIfMissing(value) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Send / update offer. The requested quantity comes from the shipping request (read-only);
 * the provider enters the price per item, delivery fee and delivery time, and the subtotal and
 * total are calculated live with the same formula the server uses to store them.
 */
function OfferForm({ request, offer, saving, error, onSubmit, onClose }) {
  const quantity = request?.quantity || offer?.request?.quantity || '';
  const count = parseQuantity(quantity);
  const unitLabel = quantityUnitLabel(quantity, count);
  // Older offers may only have a total; prefill the price per item when it divides evenly.
  const legacyUnitPrice = offer?.price && count && roundMoney(offer.price / count) * count === offer.price ? roundMoney(offer.price / count) : '';
  const [values, setValues] = useState({
    unitPrice: blankIfMissing(offer?.unitPrice ?? legacyUnitPrice),
    deliveryFee: blankIfMissing(offer?.deliveryFee),
    deliveryDays: blankIfMissing(offer?.deliveryDays),
    includes: offer?.includes || '',
  });
  const [errors, setErrors] = useState({});

  const unitPrice = Number(values.unitPrice);
  const deliveryFee = Number(values.deliveryFee);
  const unitPriceValid = values.unitPrice !== '' && Number.isFinite(unitPrice) && unitPrice > 0;
  const deliveryFeeValid = values.deliveryFee !== '' && Number.isFinite(deliveryFee) && deliveryFee >= 0;
  const subtotal = count && unitPriceValid ? calculateOfferPrice(count, unitPrice).subtotal : null;
  const total = subtotal !== null && deliveryFeeValid ? calculateOfferPrice(count, unitPrice, deliveryFee).total : null;

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  }

  function validate() {
    const next = {};
    if (!unitPriceValid) next.unitPrice = 'Enter a price per item greater than $0.';
    else if (roundMoney(unitPrice) !== unitPrice) next.unitPrice = 'Use at most 2 decimals (cents).';
    const days = Number(values.deliveryDays);
    if (values.deliveryDays === '' || !Number.isInteger(days) || days < 1 || days > 365) next.deliveryDays = 'Enter a whole number of days from 1 to 365.';
    if (!deliveryFeeValid) next.deliveryFee = 'Enter a delivery fee of $0 or more (0 = free delivery).';
    else if (roundMoney(deliveryFee) !== deliveryFee) next.deliveryFee = 'Use at most 2 decimals (cents).';
    return next;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) {
      document.getElementById(`offer-${firstInvalid}`)?.focus();
      return;
    }
    // Only the provider's inputs are sent; the server calculates subtotal and total itself.
    onSubmit({ unitPrice, deliveryFee, deliveryDays: Number(values.deliveryDays), includes: values.includes.trim() });
  }

  const fieldError = (name) => errors[name] && <span className="offer-field-error" id={`offer-${name}-error`} role="alert">{errors[name]}</span>;
  const describedBy = (name, help) => [help, errors[name] && `offer-${name}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal offer-modal" onSubmit={handleSubmit} noValidate>
        <div className="modal-heading offer-modal-heading">
          <div className="offer-request-summary">
            <RequestThumb photoId={(request || offer?.request)?.productPhoto} product={request?.product || offer?.request?.product} size="lg" />
            <div><p className="eyebrow">{offer ? 'UPDATE OFFER' : 'SEND OFFER'}</p><h2>{request?.product || offer?.request?.product}</h2><DeliveryMethodChip method={(request || offer?.request)?.deliveryMethod} /></div>
          </div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>

        {!count ? (
          <div className="offer-blocked" role="alert">
            <Icon name="alert" size={18} />
            <div><strong>This request can’t be priced yet</strong><span>Its quantity (“{quantity || 'not specified'}”) doesn’t include a number. Ask the customer to update it, e.g. “50 laptops”.</span></div>
          </div>
        ) : (
          <>
            <fieldset className="offer-section">
              <legend>Product pricing</legend>
              <div className="offer-grid">
                <label htmlFor="offer-quantity">Requested quantity
                  <span className="offer-readonly"><Icon name="box" size={15} /><input id="offer-quantity" value={quantity} readOnly aria-readonly="true" tabIndex={-1} aria-describedby="offer-quantity-help" /></span>
                  <small id="offer-quantity-help" className="offer-field-help">Set by the customer’s request</small>
                </label>
                <label htmlFor="offer-unitPrice">Price per item (USD)
                  <span className="offer-money"><span aria-hidden="true">$</span><input id="offer-unitPrice" name="unitPrice" type="number" min="0.01" step="0.01" inputMode="decimal" value={values.unitPrice} onChange={change} aria-invalid={Boolean(errors.unitPrice)} aria-describedby={describedBy('unitPrice', 'offer-unitPrice-help')} autoFocus /></span>
                  <small id="offer-unitPrice-help" className="offer-field-help">For one of the {count.toLocaleString('en-US')} {unitLabel}</small>
                  {fieldError('unitPrice')}
                </label>
              </div>
            </fieldset>

            <fieldset className="offer-section">
              <legend>Delivery details</legend>
              <div className="offer-grid">
                <label htmlFor="offer-deliveryDays">Estimated delivery time (days)
                  <input id="offer-deliveryDays" name="deliveryDays" type="number" min="1" max="365" step="1" inputMode="numeric" value={values.deliveryDays} onChange={change} aria-invalid={Boolean(errors.deliveryDays)} aria-describedby={describedBy('deliveryDays')} />
                  {fieldError('deliveryDays')}
                </label>
                <label htmlFor="offer-deliveryFee">Delivery fee (USD)
                  <span className="offer-money"><span aria-hidden="true">$</span><input id="offer-deliveryFee" name="deliveryFee" type="number" min="0" step="0.01" inputMode="decimal" value={values.deliveryFee} onChange={change} aria-invalid={Boolean(errors.deliveryFee)} aria-describedby={describedBy('deliveryFee', 'offer-deliveryFee-help')} /></span>
                  <small id="offer-deliveryFee-help" className="offer-field-help">Enter 0 for free delivery</small>
                  {fieldError('deliveryFee')}
                </label>
              </div>
            </fieldset>

            <section className="offer-summary" aria-label="Pricing summary" aria-live="polite">
              <div>
                <span>Product subtotal<small>{count.toLocaleString('en-US')} {unitLabel} × {unitPriceValid ? formatUsd(unitPrice) : '$—'}</small></span>
                <strong>{subtotal === null ? '—' : formatUsd(subtotal)}</strong>
              </div>
              <div>
                <span>Delivery fee</span>
                <strong>{deliveryFeeValid ? formatUsd(deliveryFee) : '—'}</strong>
              </div>
              <div className="offer-summary-total">
                <span>Total offer price</span>
                <strong>{total === null ? '—' : formatUsd(total)}</strong>
              </div>
            </section>
          </>
        )}

        <label htmlFor="offer-includes">Included services<textarea id="offer-includes" name="includes" value={values.includes} onChange={change} maxLength="500" rows="3" placeholder="Shipping, customs, final-mile delivery" /></label>
        {error && <p className="signin-message" role="alert">{error}</p>}
        <button className="primary-button full-button" disabled={saving || !count} type="submit">{saving ? 'Saving…' : `${offer ? 'Update offer' : 'Send offer'}${total !== null ? ` · ${formatUsd(total)}` : ''}`}</button>
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
  // Verified cargo companies for the customer's directory and the company-first request flow.
  const [companies, setCompanies] = useState({ list: [], loading: false, error: '' });
  const [requestCompany, setRequestCompany] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const closeCompanyProfile = useCallback(() => setViewingCompany(null), []);
  const loadCompanies = useCallback(() => {
    setCompanies((current) => ({ ...current, loading: true, error: '' }));
    return getProviders()
      .then((data) => setCompanies({ list: data.providers || [], loading: false, error: '' }))
      .catch((loadError) => setCompanies((current) => ({ ...current, loading: false, error: loadError.message })));
  }, []);
  const [editingRequest, setEditingRequest] = useState(null);
  const [offerRequest, setOfferRequest] = useState(null);
  const [editingOffer, setEditingOffer] = useState(null);
  const [formError, setFormError] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  // Conversation to open when going to Chat from an accepted offer.
  const [chatContactId, setChatContactId] = useState('');
  // Offer shown in the details modal (looked up from `offers` so it stays fresh after changes).
  const [viewingOfferId, setViewingOfferId] = useState('');
  const [viewingUserId, setViewingUserId] = useState('');
  const closeUserDetails = useCallback(() => setViewingUserId(''), []);
  const [confirmState, setConfirmState] = useState(null);
  const viewingOffer = viewingOfferId ? offers.find((offer) => offer._id === viewingOfferId) || null : null;
  // Customer "View details" for a shipping request (always read from the latest `requests`).
  const [viewingRequestId, setViewingRequestId] = useState('');
  const closeRequestDetails = useCallback(() => setViewingRequestId(''), []);
  const viewingRequest = viewingRequestId ? requests.find((request) => request._id === viewingRequestId) || null : null;
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
  const [adminRequestGroup, setAdminRequestGroup] = useState('all');
  const [currentTime, setCurrentTime] = useState(dashboardLoadedAt);
  const [providerMethodFilter, setProviderMethodFilter] = useState('all');
  const [providerOfferFilter, setProviderOfferFilter] = useState('all');
  // Notifications: ids the user has seen / dismissed (remembered per user in this browser).
  const [notificationSeen, setNotificationSeen] = useState(() => new Set());
  const [notificationDismissed, setNotificationDismissed] = useState(() => new Set());
  const config = roleConfig[initialRole];
  // Cargo providers see their exact account type: "Cargo Company" or "Individual".
  const isIndividualProvider = initialRole === 'provider' && user?.role === 'individual_cargo';
  const roleTitle = initialRole !== 'provider' || !user
    ? config.label
    : user.role === 'individual_cargo' ? 'Individual' : user.role === 'cargo_provider' ? 'Cargo Company' : config.label;
  const displayName = user?.name || roleTitle;
  useEffect(() => {
    if (user) document.title = `Tayonx | ${roleTitle} dashboard`;
  }, [roleTitle, user]);
  const customerMode = initialRole === 'customer';
  const providerMode = initialRole === 'provider';
  const adminMode = initialRole === 'admin';
  const title = useMemo(() => ({
    overview: 'Dashboard',
    requests: adminMode ? 'All shipping requests' : 'My shipping requests',
    opportunities: 'Matching requests',
    offers: customerMode ? 'Offers to review' : adminMode ? 'All marketplace offers' : 'My offers',
    companies: 'Cargo companies',
    messages: adminMode ? 'Support & Disputes' : 'Chat',
    notifications: 'Notifications',
    profile: 'Profile',
    users: 'Users',
    verifications: 'Verifications',
    analytics: 'Analytics',
    settings: 'Settings',
    reports: adminMode ? 'Data Exports' : 'Reports & earnings',
    company: 'Company profile',
  })[section], [section, adminMode, customerMode]);
  const requestStatusCounts = shipmentStatuses.map((status) => ({
    status,
    count: requests.filter((request) => request.status === status).length,
  }));
  const activeShipments = requests.filter((request) => ['in_progress', 'purchased', 'shipping'].includes(request.status));
  // Shipment tracking card: active shipments first, then recently delivered ones (shown as completed).
  const lastChange = (request) => new Date(request.statusHistory?.at?.(-1)?.at || request.updatedAt || 0).getTime();
  const trackedShipments = [
    ...activeShipments,
    ...requests.filter((request) => request.status === 'delivered').sort((first, second) => lastChange(second) - lastChange(first)),
  ];
  const pendingOffers = offers.filter((offer) => offer.status === 'pending');
  // The server only sends providers requests shipped from their profile country;
  // the dashboard tabs then narrow that list by delivery method.
  const providerCountry = user?.country || '';
  // Requests are only shown to approved providers (the server enforces this too).
  const providerVerified = user?.verification?.status === 'approved';
  const providerGate = providerMode && user && !providerVerified
    ? <VerificationGate status={user.verification?.status} isCompany={user.role === 'cargo_provider'} country={providerCountry} onVerify={() => setSection('settings')} />
    : null;
  const visibleProviderRequests = providerMethodFilter === 'all'
    ? requests
    : requests.filter((request) => request.deliveryMethod === providerMethodFilter);
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
  const adminPendingOffers = adminOffers.filter((offer) => offer.status === 'pending');

  // ---- Notifications (all roles) ----
  const notifications = useMemo(
    () => buildNotifications({ role: initialRole, requests, offers, now: currentTime, pendingVerifications })
      .filter((item) => !notificationDismissed.has(item.id)),
    [initialRole, requests, offers, currentTime, pendingVerifications, notificationDismissed],
  );
  const unreadNotifications = notifications.filter((item) => !notificationSeen.has(item.id)).length;
  const userId = user?.id || '';
  useEffect(() => {
    if (!userId) return;
    setNotificationSeen(readIds(userId, 'seen'));
    setNotificationDismissed(readIds(userId, 'dismissed'));
  }, [userId]);

  function markNotificationsSeen(items) {
    setNotificationSeen((current) => {
      const next = new Set(current);
      items.forEach((item) => next.add(item.id));
      if (userId) writeIds(userId, 'seen', next);
      return next;
    });
  }

  function dismissNotification(item) {
    setNotificationDismissed((current) => {
      const next = new Set(current).add(item.id);
      if (userId) writeIds(userId, 'dismissed', next);
      return next;
    });
  }

  // Follow a notification's action: open the request details, or the right section/filter.
  function openNotification(item) {
    markNotificationsSeen([item]);
    const action = item.action || {};
    setMobileNavOpen(false);
    if (action.section) {
      if (providerMode && action.section === 'offers' && action.offerId) setProviderOfferFilter('shipments');
      if (customerMode && action.requestId) setSelectedRequestId(action.requestId);
      setSection(action.section);
      return;
    }
    if (action.requestId && (customerMode || adminMode)) setViewingRequestId(action.requestId);
  }
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

  // Customers: load verified cargo companies for the directory and the New Request flow.
  useEffect(() => {
    if (customerMode && localStorage.getItem('token')) loadCompanies();
  }, [customerMode, loadCompanies]);

  // Admins: (re)load every cargo provider when the Cargo companies page opens, and after
  // users are edited or deleted (`users` changes) so the cards stay current.
  useEffect(() => {
    if (adminMode && section === 'companies' && localStorage.getItem('token')) loadCompanies();
  }, [adminMode, section, users, loadCompanies]);

  // The admin user-details modal can be opened from the Users table or a Cargo company card.
  const viewingUserAccount = viewingUserId
    ? users.find((account) => account.id === viewingUserId) || (() => {
      const provider = companies.list.find((item) => item.id === viewingUserId);
      return provider && {
        id: provider.id,
        name: provider.name,
        email: provider.email,
        phone: provider.phone,
        role: provider.role,
        country: provider.country,
        profilePhoto: null,
        verification: { status: provider.verificationStatus || 'unverified' },
        createdAt: provider.memberSince,
      };
    })()
    : null;

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

  // Returns true when the change succeeded (used to close confirmation dialogs).
  async function performMutation(id, action, successMessage) {
    setBusyId(id || 'all');
    setError('');
    setMessage('');
    try {
      await action();
      await refreshData();
      setMessage(successMessage);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setBusyId('');
    }
  }

  // Shows the confirmation dialog; `run` performs the change and returns true on success.
  function askToConfirm(options) {
    setConfirmState({ ...options, busy: false });
  }

  async function runConfirmed() {
    if (!confirmState) return;
    setConfirmState((current) => ({ ...current, busy: true }));
    const ok = await confirmState.run();
    setConfirmState(ok ? null : (current) => current && { ...current, busy: false });
  }

  // Opens the company-first New Request flow. Passing a company (from the directory or a
  // company profile) skips the "choose a company" step. Click events are ignored.
  function openCreateRequest(company) {
    setRequestCompany(company && typeof company === 'object' && 'stats' in company ? company : null);
    setViewingCompany(null);
    setEditingRequest(null);
    setFormError('');
    setRequestModalOpen(true);
    if (!companies.list.length && !companies.loading) loadCompanies();
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
      setMessage(editingRequest ? 'Shipping request updated.' : 'Shipping request sent to the cargo company.');
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
    askToConfirm({
      title: 'Delete this user?',
      message: `${account.name} (${account.email}) will be permanently deleted. This can’t be undone.`,
      confirmLabel: 'Delete user',
      tone: 'danger',
      run: async () => {
        setBusyId(account.id);
        setError('');
        setMessage('');
        try {
          await deleteUser(account.id);
          setUsers((current) => current.filter((item) => item.id !== account.id));
          setViewingUserId((current) => (current === account.id ? '' : current));
          setMessage('User deleted successfully.');
          return true;
        } catch (requestError) {
          setError(requestError.message);
          return false;
        } finally {
          setBusyId('');
        }
      },
    });
  }

  function deleteShippingRequest(request) {
    askToConfirm({
      title: 'Delete this request?',
      message: `“${request.product}” and all of its offers will be permanently deleted. This can’t be undone.`,
      confirmLabel: 'Delete request',
      tone: 'danger',
      run: async () => {
        const ok = await performMutation(request._id, () => deleteRequest(request._id), 'Shipping request deleted.');
        if (ok) setViewingRequestId((current) => (current === request._id ? '' : current));
        return ok;
      },
    });
  }

  // Customers can cancel a request until the item is purchased (status is otherwise read-only).
  function cancelShippingRequest(request) {
    askToConfirm({
      title: 'Cancel this request?',
      message: `“${request.product}” will be cancelled${request.status === 'in_progress' ? ' and the accepted cargo provider will stop working on it' : ''}. This can’t be undone.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep request',
      tone: 'danger',
      run: () => performMutation(request._id, () => updateShipmentStatus(request._id, 'cancelled'), `“${request.product}” was cancelled.`),
    });
  }

  // Provider withdraws their own pending offer.
  function deleteCargoOffer(offer) {
    askToConfirm({
      title: 'Withdraw this offer?',
      message: `Your ${formatUsd(offer.price)} offer for “${offer.request?.product}” will be removed and the customer will no longer see it.`,
      confirmLabel: 'Withdraw offer',
      tone: 'danger',
      run: async () => {
        const ok = await performMutation(offer._id, () => deleteOffer(offer._id), 'Offer withdrawn.');
        if (ok) setViewingOfferId('');
        return ok;
      },
    });
  }

  // Customer removes a pending or declined offer from their own request.
  function removeCustomerOffer(offer) {
    askToConfirm({
      title: 'Remove this offer?',
      message: `The ${formatUsd(offer.price)} offer from ${offer.provider?.name || 'this cargo provider'} for “${offer.request?.product}” will be removed from your request. This can’t be undone.`,
      confirmLabel: 'Remove offer',
      tone: 'danger',
      run: async () => {
        const ok = await performMutation(offer._id, () => deleteOffer(offer._id), 'Offer removed.');
        if (ok) setViewingOfferId('');
        return ok;
      },
    });
  }

  // Customer moves a declined offer back to pending to decide again.
  function reconsiderOffer(offer) {
    performMutation(offer._id, () => respondToOffer(offer._id, 'pending'), `Offer from ${offer.provider?.name || 'the provider'} is pending again.`);
  }

  function handleStatusChange(id, status, product = '') {
    const run = () => performMutation(id, () => updateShipmentStatus(id, status), status === 'delivered'
      ? `${product ? `“${product}”` : 'Shipment'} marked as delivered.`
      : `Shipment status changed to ${displayStatus(status).toLowerCase()}.`);
    // Delivered is the final stage and can't be undone, so ask first (admins can still change anything).
    if (status === 'delivered' && !adminMode) {
      askToConfirm({
        title: 'Mark as delivered?',
        message: `${product ? `“${product}”` : 'This shipment'} will be marked as delivered and the shipment will be completed for the customer and the cargo provider. This can’t be changed afterwards.`,
        confirmLabel: 'Mark delivered',
        tone: 'primary',
        run,
      });
      return;
    }
    run();
  }

  // Accepted offer → open the direct chat with the other party
  // (customers chat with the cargo provider, providers with the customer).
  function openChatWithProvider(offer) {
    const other = providerMode ? offer.request?.customer : offer.provider;
    const contactId = String(other?._id || other?.id || '');
    if (!contactId) return;
    setChatContactId(contactId);
    setSection('messages');
    setMobileNavOpen(false);
  }

  function handleOfferResponse(offer, status) {
    if (status === 'accepted') {
      // Accepting is a big step: it starts the shipment and declines the other offers.
      askToConfirm({
        title: 'Accept this offer?',
        message: `You’re accepting ${formatUsd(offer.price)} from ${offer.provider?.name || 'this cargo provider'} for “${offer.request?.product}”. Other pending offers for this request will be declined and the shipment will start.`,
        confirmLabel: 'Accept offer',
        tone: 'primary',
        run: () => performMutation(offer._id, () => respondToOffer(offer._id, 'accepted'), 'Offer accepted. The shipment is now in progress.'),
      });
      return;
    }
    performMutation(offer._id, () => respondToOffer(offer._id, status), 'Offer declined. You can reconsider it while no other offer is accepted.');
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
      onView={(request) => setViewingRequestId(request._id)}
      onEdit={(request) => { setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}
      onDelete={deleteShippingRequest}
      onSelectOffers={(id) => { setSelectedRequestId(id); setSection('offers'); }}
      onCreateOffer={(request) => { setOfferRequest(request); setEditingOffer(null); setFormError(''); }}
      onDeclineRequest={handleDeclineRequest}
    />;
  }

  function renderContent() {
    if (section === 'offers') {
      // Providers can filter My offers (Shipments = accepted offers, the former Orders & shipping view).
      const providerTabs = [
        ['all', 'All', () => true],
        ['pending', 'Pending', (offer) => offer.status === 'pending'],
        ['shipments', 'Shipments', (offer) => offer.status === 'accepted'],
        ['declined', 'Declined', (offer) => offer.status === 'declined'],
      ];
      const activeProviderTab = providerTabs.find(([id]) => id === providerOfferFilter) || providerTabs[0];
      const selectedOffers = customerMode && selectedRequestId
        ? offers.filter((offer) => offer.request.id === selectedRequestId)
        : providerMode ? offers.filter(activeProviderTab[2]) : offers;
      const offersSubtitle = customerMode
        ? 'Click an offer to see the full breakdown, then accept, decline or chat with the provider.'
        : adminMode
          ? 'Read-only overview of every offer on the marketplace. Click an offer to audit its details.'
          : 'Manage pending quotes and update shipment progress. Use Shipments for accepted orders.';
      return <Card><CardHeading title={title} subtitle={offersSubtitle} action={adminMode ? <span className="offer-readonly-chip"><Icon name="eye" size={14} />Read-only</span> : null} />{providerMode && <div className="admin-request-tabs provider-offer-tabs" role="tablist" aria-label="Filter my offers">{providerTabs.map(([id, label, match]) => <button type="button" role="tab" key={id} aria-selected={activeProviderTab[0] === id} className={`admin-request-tab tone-${id === 'shipments' ? 'delivered' : id === 'declined' ? 'cancelled' : id === 'pending' ? 'awaiting' : 'all'}${activeProviderTab[0] === id ? ' active' : ''}`} onClick={() => setProviderOfferFilter(id)}><span>{label}</span><b>{loading ? '—' : offers.filter(match).length}</b></button>)}</div>}{loading ? <p className="empty-table" role="status">Loading offers…</p> : <OffersTable
        offers={selectedOffers}
        role={initialRole}
        busyId={busyId}
        onView={(offer) => setViewingOfferId(offer._id)}
        onEdit={(offer) => { setEditingOffer(offer); setOfferRequest(null); setFormError(''); }}
        onDelete={deleteCargoOffer}
        onRespond={handleOfferResponse}
        onReconsider={reconsiderOffer}
        onRemove={removeCustomerOffer}
        onStatusChange={handleStatusChange}
        onChat={openChatWithProvider}
      />}</Card>;
    }

    if (section === 'opportunities') {
      return <Card><CardHeading title={title} subtitle={`Requests shipped from ${providerCountry || 'your profile country'}. Send a real quote or decline requests you cannot fulfil.`} action={providerCountry ? <span className="provider-country-scope" title="Based on the country in your profile"><Icon name="globe" size={13} />{providerCountry}</span> : null} />{providerGate || (loading ? <p className="empty-table" role="status">Loading matching requests…</p> : renderRequests(requests))}</Card>;
    }

    if (providerMode && section === 'reports') {
      return <Suspense fallback={pageFallback}><ProviderReports offers={offers} loading={loading} now={currentTime} onViewShipments={() => { setProviderOfferFilter('shipments'); setSection('offers'); }} /></Suspense>;
    }

    if (adminMode && section === 'reports') {
      return <Suspense fallback={pageFallback}><AdminReports requests={requests} offers={offers} loading={loading} now={currentTime} /></Suspense>;
    }

    if (section === 'messages' && user && !adminMode) {
      return <Card className="messages-card live-chat-card"><Chat key={chatContactId || 'chat'} user={user} initialContactId={chatContactId} /></Card>;
    }

    if (providerMode && section === 'settings') {
      return user
        ? <VerificationCenter user={user} onVerificationChange={(verification) => setUser((current) => ({ ...current, verification }))} />
        : <Card><p className="empty-table" role="status">Loading settings…</p></Card>;
    }

    if (providerMode && section === 'company') {
      const isCompany = user?.role === 'cargo_provider';
      return <Card><CardHeading title={isCompany ? 'Company profile' : 'My profile'} subtitle="Your account details as customers and administrators see them." action={user && <VerificationChip status={user.verification?.status} />} />{user ? <div className="customer-profile-grid"><div><span>{isCompany ? 'Company name' : 'Full name'}</span><strong>{user.name}</strong></div><div><span>Account type</span><strong>{roleTitle}</strong></div><div><span>Phone number</span><strong>{user.phone || 'Not provided'}</strong></div><div><span>Email address</span><strong>{user.email}</strong></div><div><span>Country</span><strong>{user.country}</strong></div><div><span>Verification</span><strong>{VERIFICATION_LABELS[user.verification?.status || 'unverified']}{user.verification?.status !== 'approved' && <button type="button" className="link-button profile-verify-link" onClick={() => setSection('settings')}>{user.verification?.status === 'pending' ? 'View status' : 'Get verified'} <Icon name="arrow" size={13} /></button>}</strong></div></div> : <p className="empty-table" role="status">Loading company account…</p>}</Card>;
    }

    if (adminMode && section === 'verifications') {
      return <AdminVerifications refreshKey={verificationRefreshKey} onPendingCountChange={handlePendingCountChange} onMessage={setMessage} />;
    }

    if (adminMode && section === 'requests') {
      const groups = ADMIN_REQUEST_GROUPS.map((group) => ({ ...group, count: requests.filter((request) => group.statuses.includes(request.status)).length }));
      const active = groups.find((group) => group.id === adminRequestGroup) || groups[0];
      const rows = requests.filter((request) => active.statuses.includes(request.status));
      return <Card className="admin-requests-card">
        <CardHeading title="Shipping requests" subtitle="Every request on the marketplace. Status is read-only — it is updated by the assigned cargo provider." action={<span className="offer-readonly-chip"><Icon name="eye" size={14} />Status read-only</span>} />
        <div className="admin-request-tabs" role="tablist" aria-label="Filter requests by status">
          {groups.map((group) => <button type="button" role="tab" key={group.id} aria-selected={active.id === group.id} className={`admin-request-tab tone-${group.id}${active.id === group.id ? ' active' : ''}`} onClick={() => setAdminRequestGroup(group.id)}><span>{group.label}</span><b>{loading ? '—' : group.count}</b></button>)}
        </div>
        {loading ? <p className="empty-table" role="status">Loading shipping requests…</p> : renderRequests(rows)}
      </Card>;
    }

    if (section === 'requests') {
      return <Card><CardHeading title={title} subtitle="Create, edit, or cancel your shipping requests." action={customerMode ? <button className="primary-button" onClick={openCreateRequest}><Icon name="plus" size={16} />New request</button> : null} />{loading ? <p className="empty-table" role="status">Loading shipping requests…</p> : renderRequests(requests)}</Card>;
    }

    if (adminMode && section === 'companies') {
      return <Card className="company-directory-card-wrap"><CardHeading title="Cargo companies" subtitle="Every cargo company and individual provider, with verification status and activity. Open a card for full details and documents." />
        <CompanyDirectory admin providers={companies.list} loading={companies.loading && !companies.list.length} error={companies.error} onRetry={loadCompanies} onView={(provider) => setViewingUserId(provider.id)} onReview={() => setSection('verifications')} />
      </Card>;
    }

    if (adminMode && section === 'users') {
      return <Card className="admin-users-card"><CardHeading title="Users" subtitle={`${users.length} registered account${users.length === 1 ? '' : 's'}`} action={<button className="primary-button" onClick={() => { setEditingUser(null); setUserFormError(null); setUserModalOpen(true); }}><Icon name="plus" size={15} />Create user</button>} />
        {usersLoading ? <p className="empty-table" role="status">Loading registered users…</p> : usersError ? <div className="empty-state"><strong>Could not load registered users</strong><p>{usersError}</p><button className="small-primary" onClick={refreshUsers}>Try again</button></div> : <div className="table-scroll"><table className="data-table admin-users-table"><thead><tr><th>User</th><th>Contact</th><th>Role</th><th>Verification</th><th>Country</th><th>Joined</th><th className="offer-actions-col" scope="col">Actions</th></tr></thead><tbody>
          {users.map((account) => <tr key={account.id} className="user-row-clickable" onClick={() => setViewingUserId(account.id)}>
            <td><span className="verification-applicant"><ProtectedAvatar fileId={account.profilePhoto} name={account.name} /><span className="table-primary">{account.name}</span></span></td>
            <td><span className="table-primary">{account.email}</span>{account.phone
              ? <a className="table-secondary table-phone" href={`tel:${account.phone}`} onClick={(event) => event.stopPropagation()}><Icon name="phone" size={12} />{account.phone}</a>
              : <button type="button" className="table-add-phone" title="This account was created before phone numbers were collected" onClick={(event) => { event.stopPropagation(); setEditingUser({ ...account, focusField: 'phone' }); setUserFormError(null); setUserModalOpen(true); }}><Icon name="plus" size={12} />Add phone</button>}</td>
            <td><span className={`admin-user-role admin-user-role-${account.role}`}>{userRoleLabel(account.role)}</span></td>
            <td>{['cargo_provider', 'individual_cargo'].includes(account.role) ? <VerificationChip status={account.verification?.status} /> : <span className="table-secondary">—</span>}</td>
            <td>{account.country || '—'}</td>
            <td>{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : '—'}</td>
            <td className="offer-actions-col" onClick={(event) => event.stopPropagation()}><div className="table-buttons offer-actions user-actions">
              <button type="button" className="offer-action-btn view" aria-label={`View details for ${account.name}`} title="View details" onClick={() => setViewingUserId(account.id)}><Icon name="eye" size={15} /><span>View</span></button>
              <button type="button" className="offer-action-btn edit" aria-label={`Edit ${account.name}`} title="Edit user" disabled={busyId === account.id} onClick={() => { setEditingUser(account); setUserFormError(null); setUserModalOpen(true); }}><Icon name="edit" size={15} /><span>Edit</span></button>
              <button type="button" className="offer-action-btn delete" aria-label={`Delete ${account.name}`} title={account.id === user?.id ? 'You cannot delete your own account' : 'Delete user'} disabled={busyId === account.id || account.id === user?.id} onClick={() => removeUser(account)}><Icon name="trash" size={15} /><span>Delete</span></button>
            </div></td>
          </tr>)}
          {!users.length && <tr><td className="empty-table" colSpan="7">No registered users found.</td></tr>}
        </tbody></table></div>}
      </Card>;
    }

    if (adminMode && section === 'analytics') {
      return <Suspense fallback={pageFallback}><AdminAnalytics requests={requests} offers={offers} period={adminPeriod} rangeStart={adminRangeStart} now={currentTime} loading={loading} /></Suspense>;
    }

    if (adminMode && section === 'settings') {
      return <Suspense fallback={pageFallback}><AdminSettings /></Suspense>;
    }

    if (adminMode && section === 'messages') {
      return <Suspense fallback={pageFallback}><AdminChats /></Suspense>;
    }

    if (customerMode && section === 'companies') {
      return <Card className="company-directory-card-wrap"><CardHeading title="Cargo companies" subtitle="Verified cargo companies and providers from every country. Open a profile or send a request directly." action={<span className="company-verified-badge large"><Icon name="shield" size={13} />Verified only</span>} />
        <CompanyDirectory providers={companies.list} loading={companies.loading && !companies.list.length} error={companies.error} onRetry={loadCompanies} onView={setViewingCompany} onRequest={openCreateRequest} />
      </Card>;
    }

    if (section === 'notifications') {
      const subtitle = customerMode ? 'New quotes, shipment milestones and reminders when it’s time to receive your order.'
        : providerMode ? 'New orders, dispatch milestones and reminders when deliveries are due.'
          : 'Overdue and due-today shipments, requests without offers and pending verifications.';
      const urgent = notifications.filter((item) => ['danger', 'warning'].includes(item.tone)).length;
      return <Card className="notifications-card"><CardHeading title="Notifications" subtitle={subtitle} action={unreadNotifications > 0 ? <button type="button" className="customer-outline-button" onClick={() => markNotificationsSeen(notifications)}><Icon name="check" size={14} />Mark all as read</button> : null} />
        {!loading && notifications.length > 0 && <div className="notification-summary"><span><b>{notifications.length}</b> total</span><span className="unread"><b>{unreadNotifications}</b> unread</span>{urgent > 0 && <span className="urgent"><b>{urgent}</b> need attention</span>}</div>}
        {loading ? <p className="empty-table" role="status">Loading updates…</p> : <NotificationList items={notifications} seen={notificationSeen} now={currentTime} onAction={openNotification} onDismiss={dismissNotification} />}
      </Card>;
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
                {recentRequests.map((request) => (
                  <div className="customer-request-row request-row-clickable" key={request._id} role="button" tabIndex={0} aria-label={`View details for ${request.product}`}
                    onClick={() => setViewingRequestId(request._id)}
                    onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setViewingRequestId(request._id); } }}>
                    <RequestThumb photoId={request.productPhoto} product={request.product} />
                    <span className="customer-row-copy"><strong>{request.product}</strong><small>{request.quantity} · {request.sourceCountry} to {request.destination}</small><small className="request-row-meta">{request.offers?.length || 0} quote{request.offers?.length === 1 ? '' : 's'}<DeliveryMethodChip method={request.deliveryMethod} compact /></small></span>
                    <StatusBadge>{request.status}</StatusBadge>
                    <span className="customer-row-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <button type="button" className="icon-button table-action" aria-label={`View details for ${request.product}`} title="View details" onClick={() => setViewingRequestId(request._id)}><Icon name="eye" size={15} /></button>
                      <button type="button" className="icon-button table-action" aria-label={`Edit ${request.product}`} title="Edit request" onClick={() => { setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}><Icon name="edit" size={15} /></button>
                      <button type="button" className="icon-button table-action" aria-label={`Delete ${request.product}`} title="Delete request" disabled={busyId === request._id} onClick={() => deleteShippingRequest(request)}><Icon name="trash" size={15} /></button>
                    </span>
                  </div>
                ))}
              </div> : <div className="empty-state"><strong>No shipping requests yet</strong><p>Create a request to receive quotes from cargo providers.</p><button className="small-primary" onClick={openCreateRequest}>Create request</button></div>}
            </Card>
            <Card className="customer-tracking-card">
              <CardHeading title="Shipment tracking" subtitle="Live progress for your shipments" />
              {loading ? <p className="empty-table" role="status">Loading shipment progress…</p> : trackedShipments.length ? <div className="customer-tracking-list">{trackedShipments.slice(0, 3).map((request) => {
                const delivered = request.status === 'delivered';
                const deliveredAt = delivered ? [...(request.statusHistory || [])].reverse().find((entry) => entry.status === 'delivered')?.at : null;
                return <section className={`customer-tracking-item${delivered ? ' delivered' : ''}`} key={request._id}>
                  <div className="customer-tracking-heading"><span><strong>{request.product}</strong><small>{request.destination} · {delivered ? <span className="tracking-delivered-label"><Icon name="check" size={12} />Delivered{deliveredAt ? ` ${new Date(deliveredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</span> : displayStatus(request.status)}</small></span><span className="customer-row-actions">
                    <button type="button" className="icon-button table-action" aria-label={`View details for ${request.product}`} title="View details" onClick={() => setViewingRequestId(request._id)}><Icon name="eye" size={15} /></button>
                  </span></div>
                  <ShipmentTimeline request={request} compact />
                </section>;
              })}</div> : <div className="empty-state"><strong>No shipments yet</strong><p>Accepted offers will appear here as your shipments progress.</p></div>}
            </Card>
          </div>
          {/* The old "Cargo providers" and "Latest offers" cards duplicated the Cargo companies and
              Offers pages; this row now shows timely alerts instead. */}
          <div className="customer-dashboard-grid customer-dashboard-grid-secondary customer-alerts-row">
            <Card className="customer-list-card customer-alerts-card">
              <CardHeading title="Updates & alerts" subtitle="Quotes, shipment milestones and reminders when it’s time to receive your order" action={<button className="link-button" onClick={() => setSection('notifications')}>View all <Icon name="arrow" size={15} /></button>} />
              {loading ? <p className="empty-table" role="status">Loading updates…</p> : <NotificationList items={notifications} seen={notificationSeen} now={currentTime} onAction={openNotification} onDismiss={dismissNotification} limit={4} empty={{ title: 'No new updates', text: 'We’ll let you know about new quotes, shipment progress and deliveries.' }} />}
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
              <CardHeading title="New requests for you" subtitle={providerCountry ? <span className="provider-country-scope" title="Based on the country in your profile"><Icon name="globe" size={13} />Shipping from {providerCountry}</span> : null} action={providerGate ? null : <div className="provider-request-filters" role="group" aria-label="Filter by delivery method">{[['all', 'All'], ...Object.entries(DELIVERY_METHODS).map(([value, info]) => [value, info.short])].map(([value, label]) => <button type="button" className={providerMethodFilter === value ? 'active' : ''} aria-pressed={providerMethodFilter === value} key={value} onClick={() => setProviderMethodFilter(value)}>{label}</button>)}</div>} />
              {providerGate ? providerGate : loading ? <p className="empty-table" role="status">Loading opportunities…</p> : visibleProviderRequests.length ? <div className="provider-request-list">{visibleProviderRequests.slice(0, 8).map((request) => {
                const age = Math.max(0, dashboardLoadedAt - new Date(request.createdAt || 0).getTime());
                const timeLabel = age < 60 * 60 * 1000 ? `${Math.max(1, Math.floor(age / 60000))} min ago` : age < 24 * 60 * 60 * 1000 ? `${Math.floor(age / (60 * 60 * 1000))} hr ago` : new Date(request.createdAt).toLocaleDateString();
                return <div className="provider-request-row" key={request._id}>
                  <RequestThumb photoId={request.productPhoto} product={request.product} icon="laptop" />
                  <div className="provider-request-info">
                    <span className="provider-request-title"><strong>{request.product} · {request.quantity}</strong>{age < 24 * 60 * 60 * 1000 && <span>New</span>}<RequestTargetChip request={request} role="provider" /></span>
                    <small>{request.details || `${request.sourceCountry} to ${request.destination}`}</small>
                    <span className="provider-request-meta"><span><b>{request.sourceCountry.slice(0, 2).toUpperCase()}</b>{request.destination}</span><DeliveryMethodChip method={request.deliveryMethod} /><small>{timeLabel}</small></span>
                  </div>
                  <div className="provider-request-actions"><button className="customer-outline-button" disabled={busyId === request._id} onClick={() => handleDeclineRequest(request._id)}>Decline</button><button className="small-primary" disabled={busyId === request._id} onClick={() => { setOfferRequest(request); setEditingOffer(null); setFormError(''); }}>Send offer</button></div>
                </div>;
              })}</div> : <div className="empty-state"><strong>{requests.length ? `No ${DELIVERY_METHODS[providerMethodFilter]?.short.toLowerCase() || ''} freight requests right now` : `No new requests from ${providerCountry || 'your country'}`}</strong><p>{requests.length ? 'Choose another delivery method to see the other requests.' : `You only see requests shipped from ${providerCountry || 'the country in your profile'}. New ones will appear here.`}</p></div>}
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
        <div className="workspace-role-picker"><span className="customer-role-label">{roleTitle.toUpperCase()}</span></div>
        <nav className="side-nav" aria-label={`${roleTitle} navigation`}>
          {config.sections.map(([sectionId, sectionLabel, icon]) => {
            // Individual providers have a personal profile, not a company one.
            const label = providerMode && sectionId === 'company' && isIndividualProvider ? 'My profile' : sectionLabel;
            return (
            <Fragment key={sectionId}>
              {adminMode && sectionId === 'settings' && <span className="sidebar-section-label">SYSTEM</span>}
          {providerMode && sectionId === 'company' && <span className="sidebar-section-label">{isIndividualProvider ? 'ACCOUNT' : 'COMPANY'}</span>}
          <button className={`nav-item${section === sectionId ? ' active' : ''}`} onClick={() => {
                if (sectionId === 'users' && section !== 'users') {
                  setUsersLoading(true);
                  setUsersError('');
                }
                setSection(sectionId);
                setSearch('');
                setSelectedRequestId('');
                setChatContactId('');
                setViewingOfferId('');
                setViewingRequestId('');
                setViewingUserId('');
                setMobileNavOpen(false);
              }}>
                <Icon name={icon} size={16} /><span>{label}</span>
                {sectionId === 'notifications' && unreadNotifications > 0 && <span className="nav-count" aria-label={`${unreadNotifications} unread`}>{unreadNotifications}</span>}
                {providerMode && sectionId === 'opportunities' && requests.length > 0 && <span className="nav-count">{requests.length}</span>}
                {adminMode && sectionId === 'verifications' && pendingVerifications > 0 && <span className="nav-count nav-count-alert" aria-label={`${pendingVerifications} pending`}>{pendingVerifications}</span>}
                {providerMode && sectionId === 'settings' && ['unverified', 'rejected'].includes(user?.verification?.status) && <span className="nav-dot" aria-label="Verification needed" />}
              </button>
            </Fragment>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="customer-signout" onClick={signOut}><Icon name="arrow" size={15} />Log out</button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Icon name="menu" /></button>
          <div className="customer-topbar-title"><strong>{title}</strong><span className="topbar-welcome">Welcome back, {displayName}{providerMode && user && <span className={`topbar-role-badge${isIndividualProvider ? ' individual' : ''}`} title={`Account type: ${roleTitle}`}><Icon name={isIndividualProvider ? 'user' : 'building'} size={13} />{roleTitle}</span>}{providerMode && user?.verification?.status === 'approved' && <span className="topbar-verified-badge" title={`Verified ${isIndividualProvider ? 'individual provider' : 'cargo company'}`}><Icon name="shield" size={13} />Verified</span>}</span></div>
          <div className="topbar-actions">
            {providerMode && <span className="provider-country-chip"><b>{user?.country?.slice(0, 2).toUpperCase() || '—'}</b>{user?.country || 'Country not set'}</span>}
            {adminMode && (section === 'overview' || section === 'analytics') && <div className="admin-period-switch" role="group" aria-label="Filter dashboard period">
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
            {adminMode && (section === 'overview' || section === 'requests') && <button className="admin-export-button" onClick={exportRequests} disabled={loading}><Icon name="download" size={13} />Export</button>}
            {(section === 'requests' || section === 'opportunities') && <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests…" /></label>}
            {user && <NotificationBell items={notifications} seen={notificationSeen} now={currentTime} onAction={openNotification} onDismiss={dismissNotification} onMarkAllRead={() => markNotificationsSeen(notifications)} onViewAll={() => setSection('notifications')} />}
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

      {viewingOffer && (
        <OfferDetailsModal
          offer={viewingOffer}
          role={initialRole}
          busy={busyId === viewingOffer._id}
          onClose={() => setViewingOfferId('')}
          onEdit={(offer) => { setViewingOfferId(''); setEditingOffer(offer); setOfferRequest(null); setFormError(''); }}
          onDelete={deleteCargoOffer}
          onRespond={handleOfferResponse}
          onReconsider={reconsiderOffer}
          onRemove={removeCustomerOffer}
          onChat={(offer) => { setViewingOfferId(''); openChatWithProvider(offer); }}
        />
      )}
      {(customerMode || adminMode) && viewingRequest && (
        <RequestDetailsModal
          request={viewingRequest}
          role={initialRole}
          busy={busyId === viewingRequest._id}
          onClose={closeRequestDetails}
          onEdit={(request) => { setViewingRequestId(''); setEditingRequest(request); setRequestModalOpen(true); setFormError(''); }}
          onDelete={deleteShippingRequest}
          onCancel={cancelShippingRequest}
          onViewOffers={(request) => { setViewingRequestId(''); setSelectedRequestId(request._id); setSection('offers'); }}
        />
      )}
      {customerMode && viewingCompany && <CompanyProfileModal provider={viewingCompany} onClose={closeCompanyProfile} onRequest={openCreateRequest} />}
      {requestModalOpen && <RequestForm request={editingRequest} saving={saving} error={formError} onSubmit={saveRequest} companies={{ ...companies, retry: loadCompanies }} initialCompany={editingRequest ? null : requestCompany} onClose={() => { setRequestModalOpen(false); setEditingRequest(null); setRequestCompany(null); setFormError(''); }} />}
      {(offerRequest || editingOffer) && <OfferForm request={offerRequest || editingOffer?.request} offer={editingOffer} saving={saving} error={formError} onSubmit={saveOffer} onClose={() => { setOfferRequest(null); setEditingOffer(null); setFormError(''); }} />}
      {adminMode && viewingUserAccount && (
        <AdminUserDetails
          account={viewingUserAccount}
          isSelf={viewingUserId === user?.id}
          busy={busyId === viewingUserId}
          onClose={closeUserDetails}
          onEdit={(account) => { setViewingUserId(''); setEditingUser(account); setUserFormError(null); setUserModalOpen(true); }}
          onDelete={removeUser}
          onReviewVerification={() => { setViewingUserId(''); setSection('verifications'); }}
        />
      )}
      {userModalOpen && <UserForm key={editingUser?.id || 'new'} user={editingUser} saving={saving} error={userFormError} onSubmit={saveUser} onClose={() => { setUserModalOpen(false); setEditingUser(null); setUserFormError(null); }} />}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          tone={confirmState.tone}
          busy={confirmState.busy}
          onConfirm={runConfirmed}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
