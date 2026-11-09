import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getProvider } from '../lib/api.js';
import { ROLE_LABELS } from '../lib/accountFields.js';

// Cargo company directory views. Privacy: these components only ever receive public profile
// fields from /api/providers — verification documents, ID/passport photos and business
// licenses are never requested or shown here (admins see them in the user details modal).

function initialsOf(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
}

function typeLabel(role) {
  return role === 'cargo_provider' ? 'Cargo company' : ROLE_LABELS[role] || 'Cargo provider';
}

function VerifiedBadge() {
  return <span className="company-verified-badge" title="Verified by Tayonx"><Icon name="shield" size={12} />Verified</span>;
}

const STATUS_LABELS = { approved: 'Verified', pending: 'Under review', rejected: 'Needs changes', unverified: 'Not verified' };

/** Admin view: the provider's verification status (customers only ever see verified providers). */
function StatusBadge({ status = 'unverified' }) {
  if (status === 'approved') return <VerifiedBadge />;
  return <span className={`verification-chip verification-${status}`}><Icon name="shield" size={12} />{STATUS_LABELS[status] || status}</span>;
}

/** Search + type + country (+ status for admins) filters shared by the picker and the directory. */
function useCompanyFilters(providers) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [country, setCountry] = useState('all');
  const [status, setStatus] = useState('all');
  const countries = useMemo(() => [...new Set(providers.map((provider) => provider.country).filter(Boolean))].sort(), [providers]);
  const visible = providers.filter((provider) => {
    if (type !== 'all' && provider.role !== type) return false;
    if (country !== 'all' && provider.country !== country) return false;
    if (status !== 'all' && (provider.verificationStatus || 'approved') !== status) return false;
    const text = `${provider.name} ${provider.country} ${provider.email}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  return { query, setQuery, type, setType, country, setCountry, status, setStatus, countries, visible };
}

function CompanyFilters({ filters, idPrefix, showStatus = false }) {
  return (
    <div className="company-filters">
      <label className="search-box company-search">
        <Icon name="search" size={16} />
        <input id={`${idPrefix}-search`} aria-label="Search cargo companies" value={filters.query} onChange={(event) => filters.setQuery(event.target.value)} placeholder="Search by name or country…" />
      </label>
      <div className="provider-request-filters" role="group" aria-label="Provider type">
        {[['all', 'All'], ['cargo_provider', 'Companies'], ['individual_cargo', 'Individuals']].map(([value, label]) => (
          <button type="button" key={value} className={filters.type === value ? 'active' : ''} aria-pressed={filters.type === value} onClick={() => filters.setType(value)}>{label}</button>
        ))}
      </div>
      <select aria-label="Filter by country" className="company-country-filter" value={filters.country} onChange={(event) => filters.setCountry(event.target.value)}>
        <option value="all">All countries</option>
        {filters.countries.map((country) => <option key={country} value={country}>{country}</option>)}
      </select>
      {showStatus && (
        <select aria-label="Filter by verification status" className="company-country-filter" value={filters.status} onChange={(event) => filters.setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      )}
    </div>
  );
}

function ListState({ loading, error, onRetry, empty }) {
  if (loading) return <p className="empty-table" role="status">Loading verified cargo companies…</p>;
  if (error) return <div className="empty-state"><strong>Could not load cargo companies</strong><p>{error}</p>{onRetry && <button type="button" className="small-primary" onClick={onRetry}>Try again</button>}</div>;
  return <div className="empty-state"><strong>{empty.title}</strong><p>{empty.text}</p></div>;
}

/** Step 1 of a new request: choose the verified cargo company the request is sent to. */
export function CompanyPicker({ providers, loading, error, selectedId, onSelect, onRetry }) {
  const filters = useCompanyFilters(providers);
  return (
    <div className="company-picker">
      <CompanyFilters filters={filters} idPrefix="picker" />
      {loading || error || !filters.visible.length
        ? <ListState loading={loading} error={error} onRetry={onRetry} empty={providers.length ? { title: 'No matching cargo companies', text: 'Try another name, type or country.' } : { title: 'No verified cargo companies yet', text: 'Verified companies will appear here once an administrator approves them.' }} />
        : (
          <div className="company-pick-list" role="radiogroup" aria-label="Verified cargo companies">
            {filters.visible.map((provider) => {
              const selected = provider.id === selectedId;
              return (
                <button type="button" role="radio" aria-checked={selected} key={provider.id} className={`company-pick-card${selected ? ' selected' : ''}`} onClick={() => onSelect(provider)}>
                  <span className="company-avatar" aria-hidden="true">{initialsOf(provider.name)}</span>
                  <span className="company-pick-copy">
                    <strong>{provider.name}</strong>
                    <small>{typeLabel(provider.role)} · {provider.country}</small>
                    <span className="company-pick-meta"><VerifiedBadge />{provider.stats.acceptedOffers > 0 && <small>{provider.stats.acceptedOffers} shipment{provider.stats.acceptedOffers === 1 ? '' : 's'} won</small>}</span>
                  </span>
                  <span className="company-pick-check" aria-hidden="true">{selected && <Icon name="check" size={14} />}</span>
                </button>
              );
            })}
          </div>
        )}
    </div>
  );
}

/** Admin summary tiles: total providers and counts per verification status (click to filter). */
function CompanySummary({ providers, onFilter, active }) {
  const count = (status) => providers.filter((provider) => provider.verificationStatus === status).length;
  const tiles = [
    ['all', 'All providers', providers.length, 'building'],
    ['approved', 'Verified', count('approved'), 'shield'],
    ['pending', 'Under review', count('pending'), 'clock'],
    ['unverified', 'Not verified', count('unverified') + count('rejected'), 'alert'],
  ];
  return (
    <div className="company-summary">
      {tiles.map(([status, label, value, icon]) => (
        <button type="button" key={status} className={`company-summary-tile tone-${status}${active === status ? ' active' : ''}`} aria-pressed={active === status} onClick={() => onFilter(status)}>
          <span className="company-summary-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>
          <span><strong>{value}</strong><small>{label}</small></span>
        </button>
      ))}
    </div>
  );
}

/**
 * "Cargo companies" page.
 *  - customer (default): verified companies only, any country; View profile + Send request.
 *  - admin: every provider with its verification status; View details (+ Review when pending).
 */
export function CompanyDirectory({ providers, loading, error, onView, onRequest, onReview, onRetry, admin = false }) {
  const filters = useCompanyFilters(providers);
  return (
    <>
      {admin && <CompanySummary providers={providers} onFilter={filters.setStatus} active={filters.status} />}
      <CompanyFilters filters={filters} idPrefix="directory" showStatus={admin} />
      {loading || error || !filters.visible.length
        ? <ListState loading={loading} error={error} onRetry={onRetry} empty={providers.length ? { title: 'No matching cargo companies', text: `Try another name, type${admin ? ', status' : ''} or country.` } : admin ? { title: 'No cargo providers yet', text: 'Cargo companies and individual providers appear here after they register.' } : { title: 'No verified cargo companies yet', text: 'Companies appear here after an administrator verifies them.' }} />
        : (
          <div className="company-directory-grid">
            {filters.visible.map((provider) => (
              <article key={provider.id} className="company-directory-card" tabIndex={0} role="button" aria-label={`View ${provider.name} ${admin ? 'details' : 'profile'}`}
                onClick={() => onView(provider)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onView(provider); } }}>
                <div className="company-directory-head">
                  <span className="company-avatar large" aria-hidden="true">{initialsOf(provider.name)}</span>
                  <div>
                    <strong>{provider.name}</strong>
                    <small>{typeLabel(provider.role)}</small>
                  </div>
                  {admin ? <StatusBadge status={provider.verificationStatus} /> : <VerifiedBadge />}
                </div>
                {admin && <p className="company-directory-contact"><Icon name="mail" size={13} /><span>{provider.email}</span>{provider.phone && <><Icon name="phone" size={13} /><span>{provider.phone}</span></>}</p>}
                <dl className="company-directory-facts">
                  <div><dt><Icon name="globe" size={13} />Country</dt><dd>{provider.country}</dd></div>
                  <div><dt><Icon name="mail" size={13} />Offers sent</dt><dd>{provider.stats.offers}</dd></div>
                  <div><dt><Icon name="check" size={13} />Shipments won</dt><dd>{provider.stats.acceptedOffers}</dd></div>
                </dl>
                <div className="company-directory-actions">
                  <button type="button" className="customer-outline-button" onClick={(event) => { event.stopPropagation(); onView(provider); }}><Icon name="eye" size={14} />{admin ? 'View details' : 'View profile'}</button>
                  {admin
                    ? provider.verificationStatus === 'pending' && onReview && <button type="button" className="small-primary" onClick={(event) => { event.stopPropagation(); onReview(provider); }}><Icon name="shield" size={14} />Review</button>
                    : <button type="button" className="small-primary" onClick={(event) => { event.stopPropagation(); onRequest(provider); }}><Icon name="plus" size={14} />Send request</button>}
                </div>
              </article>
            ))}
          </div>
        )}
    </>
  );
}

/** Public profile of one verified company. No verification documents — admin-only. */
export function CompanyProfileModal({ provider: summary, onClose, onRequest }) {
  const [state, setState] = useState({ id: '', provider: null, error: '' });
  const closeRef = useRef(null);
  const providerId = summary.id;

  useEffect(() => {
    const controller = new AbortController();
    getProvider(providerId, { signal: controller.signal })
      .then((data) => setState({ id: providerId, provider: data.provider, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ id: providerId, provider: null, error: error.message }); });
    return () => controller.abort();
  }, [providerId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loaded = state.id === providerId;
  const provider = { ...summary, ...(loaded && state.provider ? state.provider : {}) };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="request-modal offer-details-modal company-profile-modal" role="dialog" aria-modal="true" aria-labelledby="company-profile-title">
        <header className="user-details-header">
          <span className="user-details-avatar" aria-hidden="true">{initialsOf(provider.name)}</span>
          <div className="user-details-identity">
            <p className="eyebrow">Cargo company</p>
            <h2 id="company-profile-title">{provider.name}</h2>
            <div className="user-details-chips">
              <span className={`admin-user-role admin-user-role-${provider.role}`}>{typeLabel(provider.role)}</span>
              <VerifiedBadge />
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </header>

        {loaded && state.error && <p className="signin-message" role="alert">{state.error}</p>}

        <div className="offer-details-grid">
          <section className="offer-details-section">
            <h3>Contact</h3>
            <dl>
              <div><dt>{provider.role === 'cargo_provider' ? 'Company name' : 'Full name'}</dt><dd>{provider.name}</dd></div>
              <div><dt>Email</dt><dd><a href={`mailto:${provider.email}`}>{provider.email}</a></dd></div>
              <div><dt>Phone</dt><dd>{provider.phone ? <a href={`tel:${provider.phone}`}>{provider.phone}</a> : 'Not provided'}</dd></div>
              <div><dt>Country</dt><dd>{provider.country}</dd></div>
            </dl>
          </section>
          <section className="offer-details-section">
            <h3>On Tayonx</h3>
            <dl>
              <div><dt>Provider type</dt><dd>{typeLabel(provider.role)}</dd></div>
              <div><dt>Verified</dt><dd>{provider.verifiedAt ? formatDate(provider.verifiedAt) : 'Yes'}</dd></div>
              <div><dt>Member since</dt><dd>{formatDate(provider.memberSince)}</dd></div>
            </dl>
          </section>
        </div>

        <div className="user-details-stats company-profile-stats">
          <div><strong>{provider.stats?.offers ?? 0}</strong><span>Offers sent</span></div>
          <div><strong>{provider.stats?.acceptedOffers ?? 0}</strong><span>Shipments won</span></div>
          <div><strong>{provider.stats?.completedShipments ?? 0}</strong><span>Delivered</span></div>
        </div>

        <p className="company-privacy-note"><Icon name="shield" size={14} />This company’s identity and business documents were checked by the Tayonx team. Documents are kept private.</p>

        <footer className="offer-details-footer">
          <button type="button" className="customer-outline-button" onClick={onClose}>Close</button>
          <button type="button" className="primary-button" onClick={() => onRequest(provider)}><Icon name="plus" size={15} />Send a request to {provider.name}</button>
        </footer>
      </section>
    </div>
  );
}
