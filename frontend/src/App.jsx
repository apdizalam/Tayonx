import { useEffect, useMemo, useState } from 'react';
import logo from './assets/tayonx-logo.png';
import './App.css';

const roles = {
  customer: {
    label: 'Customer',
    name: 'Abdi Hassan',
    initials: 'AH',
    descriptor: 'Customer workspace',
    navigation: [
      ['overview', 'Overview', 'grid'],
      ['requests', 'My requests', 'box'],
      ['offers', 'Offers to review', 'send'],
      ['companies', 'Companies', 'building'],
      ['messages', 'Messages', 'chat'],
    ],
  },
  provider: {
    label: 'Cargo provider',
    name: 'Global Cargo Ltd',
    initials: 'GC',
    descriptor: 'Provider workspace',
    navigation: [
      ['overview', 'Overview', 'grid'],
      ['opportunities', 'Opportunities', 'search'],
      ['offers', 'My offers', 'send'],
      ['messages', 'Messages', 'chat'],
      ['profile', 'Company profile', 'building'],
    ],
  },
  admin: {
    label: 'Admin',
    name: 'Tayonx Admin',
    initials: 'TA',
    descriptor: 'Admin workspace',
    navigation: [
      ['overview', 'Overview', 'grid'],
      ['verification', 'Verification', 'shield'],
      ['requests', 'All requests', 'box'],
      ['reports', 'Reports', 'chart'],
    ],
  },
};

const customerRequests = [
  { id: 'TX-2048', product: '50 business laptops', route: 'China → Hargeisa', date: 'Oct 24, 2026', offers: 4, status: 'Offers received' },
  { id: 'TX-2041', product: 'Cotton fabric · 200 yards', route: 'Turkey → Hargeisa', date: 'Oct 21, 2026', offers: 2, status: 'In progress' },
  { id: 'TX-2035', product: 'Solar panels · 20 units', route: 'China → Berbera', date: 'Oct 18, 2026', offers: 0, status: 'Open' },
  { id: 'TX-2019', product: 'Home furniture set', route: 'Turkey → Hargeisa', date: 'Oct 11, 2026', offers: 3, status: 'Delivered' },
];

const opportunities = [
  { id: 'TX-2052', product: 'LED lighting · 500 units', route: 'China → Hargeisa', date: 'Today', budget: '$4,500–$5,200', customer: 'Nimco A.' },
  { id: 'TX-2048', product: '50 business laptops', route: 'China → Hargeisa', date: '2 hours ago', budget: '$18,000–$21,000', customer: 'Abdi H.' },
  { id: 'TX-2045', product: 'Kitchen appliances · 30 units', route: 'Turkey → Berbera', date: 'Yesterday', budget: '$2,800–$3,400', customer: 'Mohamed A.' },
];

const pendingCompanies = [
  { id: 'CO-118', name: 'Eastway Logistics', country: 'China', submitted: 'Oct 25, 2026', initials: 'EL' },
  { id: 'CO-117', name: 'Anatolia Cargo', country: 'Turkey', submitted: 'Oct 24, 2026', initials: 'AC' },
  { id: 'CO-115', name: 'Silk Road Shipping', country: 'China', submitted: 'Oct 22, 2026', initials: 'SR' },
];

const conversations = [
  { initials: 'ML', name: 'Muna Logistics', message: 'We can deliver to Hargeisa in 18 days.', time: '10:42 AM', unread: 2 },
  { initials: 'OC', name: 'Orient Cargo', message: 'Offer updated — customs included.', time: 'Yesterday', unread: 0 },
  { initials: 'AC', name: 'Anatolia Cargo', message: 'Thanks! I will review the details.', time: 'Tue', unread: 0 },
];

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    box: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
    building: <><path d="M3 21h18M5 21V5l7-2 7 2v16M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" /></>,
    chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    chart: <><path d="M3 3v18h18M18 17V9m-5 8V5m-5 12v-5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" /></>,
  };
  return (
    <svg
      aria-hidden="true"
      className="icon"
      height={size}
      width={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}

function StatusBadge({ children }) {
  const statusClass = children.toLowerCase().replaceAll(' ', '-');
  return <span className={`status-badge status-${statusClass}`}>{children}</span>;
}

function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="page-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, change, icon, tone = 'blue' }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} /></span>
      <p className="stat-label">{label}</p>
      <div className="stat-value-row">
        <strong>{value}</strong>
        <span className={`stat-change ${change.startsWith('+') ? 'positive' : ''}`}>{change}</span>
      </div>
    </article>
  );
}

function Card({ children, className = '' }) {
  return <section className={`dashboard-card ${className}`}>{children}</section>;
}

function CardHeading({ title, action, subtitle }) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Avatar({ initials, className = '' }) {
  return <span className={`avatar ${className}`}>{initials}</span>;
}

function RequestTable({ rows, onSelect, search }) {
  const filteredRows = rows.filter((row) =>
    `${row.id} ${row.product} ${row.route} ${row.status}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr><th>Request</th><th>Route</th><th>Date</th><th>Offers</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.id}>
              <td><span className="table-primary">{row.product}</span><span className="table-secondary">{row.id}</span></td>
              <td>{row.route}</td>
              <td>{row.date}</td>
              <td>{row.offers ? <button className="text-button" onClick={() => onSelect('offers', row.id)}>{row.offers} offers</button> : '—'}</td>
              <td><StatusBadge>{row.status}</StatusBadge></td>
              <td><button className="icon-button table-action" aria-label={`Open ${row.id}`} onClick={() => onSelect('offers', row.id)}><Icon name="arrow" size={17} /></button></td>
            </tr>
          ))}
          {!filteredRows.length && <tr><td className="empty-table" colSpan="6">No requests match your search.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ActivityFeed({ items }) {
  return (
    <div className="activity-feed">
      {items.map((item) => (
        <div className="activity-item" key={`${item.title}-${item.time}`}>
          <span className={`activity-dot ${item.tone || ''}`} />
          <div><p>{item.title}</p><span>{item.detail}</span></div>
          <time>{item.time}</time>
        </div>
      ))}
    </div>
  );
}

function OverviewChart() {
  const bars = [35, 54, 42, 69, 48, 77, 58, 88, 63, 74, 54, 96];
  return (
    <div className="chart-area" aria-label="Requests increased over the last 12 months">
      <div className="chart-y-labels"><span>120</span><span>80</span><span>40</span><span>0</span></div>
      <div className="chart">
        {bars.map((height, index) => (
          <span className="chart-column" key={index}>
            <i style={{ height: `${height}%` }} />
            <small>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index]}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Overview({ role, onNavigate, onAction, search, verifiedCompanies }) {
  if (role === 'customer') {
    return (
      <>
        <div className="stats-grid">
          <StatCard label="Active requests" value="3" change="+1 this month" icon="box" />
          <StatCard label="Offers to review" value="6" change="+2 new today" icon="send" tone="green" />
          <StatCard label="Orders in progress" value="1" change="On schedule" icon="clock" tone="amber" />
          <StatCard label="Completed orders" value="12" change="+3 this month" icon="check" tone="navy" />
        </div>
        <div className="dashboard-columns">
          <Card className="wide-card">
            <CardHeading title="Recent requests" subtitle="Keep track of your sourcing requests" action={<button className="link-button" onClick={() => onNavigate('requests')}>View all <Icon name="arrow" size={16} /></button>} />
            <RequestTable
              rows={customerRequests}
              onSelect={role === 'admin' ? () => onAction('request:details') : onNavigate}
              search={search}
            />
          </Card>
          <Card>
            <CardHeading title="Recent activity" action={<button className="icon-button" aria-label="More activity"><Icon name="dots" /></button>} />
            <ActivityFeed items={[
              { title: 'New offer received', detail: 'Muna Logistics · TX-2048', time: '12 min', tone: 'blue' },
              { title: 'Request is now in progress', detail: 'Cotton fabric · TX-2041', time: '2 hr', tone: 'green' },
              { title: 'Message from Orient Cargo', detail: 'Customs are included in the offer.', time: 'Yesterday', tone: 'amber' },
            ]} />
            <button className="secondary-button full-button" onClick={() => onNavigate('messages')}>Open messages <Icon name="arrow" size={16} /></button>
          </Card>
        </div>
        <Card className="welcome-strip">
          <div className="welcome-mark"><Icon name="globe" size={23} /></div>
          <div><strong>Ready to source something new?</strong><p>Tell verified cargo companies what you need and compare offers in one place.</p></div>
          <button className="secondary-button" onClick={() => onAction('new-request')}>Create a request <Icon name="arrow" size={16} /></button>
        </Card>
      </>
    );
  }

  if (role === 'provider') {
    return (
      <>
        <div className="stats-grid">
          <StatCard label="Matching opportunities" value="8" change="+3 new today" icon="search" />
          <StatCard label="Offers sent" value="14" change="+4 this month" icon="send" tone="green" />
          <StatCard label="Active shipments" value="6" change="2 arriving soon" icon="box" tone="amber" />
          <StatCard label="Average rating" value="4.8" change="+0.2 this month" icon="check" tone="navy" />
        </div>
        <div className="dashboard-columns">
          <Card className="wide-card">
            <CardHeading title="Matching opportunities" subtitle="Requests that match your routes and services" action={<button className="link-button" onClick={() => onNavigate('opportunities')}>View all <Icon name="arrow" size={16} /></button>} />
            <div className="opportunity-list compact-list">
              {opportunities.slice(0, 3).map((item) => (
                <article className="opportunity-row" key={item.id}>
                  <span className="opportunity-icon"><Icon name="box" /></span>
                  <div className="opportunity-info"><strong>{item.product}</strong><span>{item.route} <i /> {item.date}</span></div>
                  <div className="opportunity-budget"><span>Customer budget</span><strong>{item.budget}</strong></div>
                  <button className="small-primary" onClick={() => onAction(`offer:${item.id}`)}>Send offer</button>
                </article>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeading title="Recent activity" />
            <ActivityFeed items={[
              { title: 'Your offer was viewed', detail: 'TX-2048 · 50 business laptops', time: '20 min', tone: 'blue' },
              { title: 'New matching request', detail: 'LED lighting · Hargeisa', time: '1 hr', tone: 'green' },
              { title: 'Customer sent a message', detail: 'Abdi Hassan · TX-2041', time: 'Yesterday', tone: 'amber' },
            ]} />
          </Card>
        </div>
        <Card className="profile-progress">
          <div className="profile-progress-copy"><span className="eyebrow">Company profile</span><strong>Complete your profile</strong><p>Add your service routes and business license to build customer trust.</p></div>
          <div className="progress-meter"><div><span>Profile strength</span><strong>72%</strong></div><i><b /></i></div>
          <button className="secondary-button" onClick={() => onNavigate('profile')}>Review profile <Icon name="arrow" size={16} /></button>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total requests" value="1,284" change="+12.8% this month" icon="box" />
        <StatCard label="Active companies" value="86" change="+6 this month" icon="building" tone="green" />
        <StatCard label="Pending verification" value={String(verifiedCompanies.length)} change="Needs review" icon="shield" tone="amber" />
        <StatCard label="Completed orders" value="942" change="+8.4% this month" icon="check" tone="navy" />
      </div>
      <div className="dashboard-columns admin-columns">
        <Card className="wide-card">
          <CardHeading title="Request activity" subtitle="Marketplace requests over the last 12 months" action={<button className="select-button">Last 12 months <span>⌄</span></button>} />
          <OverviewChart />
        </Card>
        <Card>
          <CardHeading title="Recent activity" />
          <ActivityFeed items={[
            { title: 'Company submitted for review', detail: 'Eastway Logistics · China', time: '8 min', tone: 'amber' },
            { title: 'Request marked delivered', detail: 'TX-2019 · Hargeisa', time: '35 min', tone: 'green' },
            { title: 'New customer request', detail: 'LED lighting · 500 units', time: '1 hr', tone: 'blue' },
          ]} />
        </Card>
      </div>
      <Card>
        <CardHeading title="Companies awaiting verification" subtitle="Review documents before providers can send offers" action={<button className="link-button" onClick={() => onNavigate('verification')}>Review all <Icon name="arrow" size={16} /></button>} />
        <CompanyTable
          companies={verifiedCompanies.slice(0, 3)}
          onReview={() => onNavigate('verification')}
          onVerify={() => onNavigate('verification')}
          onReject={() => onNavigate('verification')}
        />
      </Card>
    </>
  );
}

function CompanyTable({ companies, onReview, onVerify, onReject }) {
  if (!companies.length) {
    return <div className="empty-state"><span className="empty-state-icon"><Icon name="check" size={22} /></span><strong>All caught up</strong><p>There are no companies waiting for verification.</p></div>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table company-table">
        <thead><tr><th>Company</th><th>Country</th><th>Submitted</th><th>Documents</th><th>Action</th></tr></thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id}>
              <td><span className="company-cell"><Avatar initials={company.initials} /><span><b>{company.name}</b><small>{company.id}</small></span></span></td>
              <td><span className="country-chip">{company.country}</span></td>
              <td>{company.submitted}</td>
              <td><button className="text-button" onClick={onReview}><Icon name="download" size={15} /> Business license</button></td>
              <td><div className="table-buttons"><button className="approve-button" onClick={() => onVerify?.(company.id)}>Approve</button><button className="reject-button" onClick={() => onReject?.(company.id)}>Reject</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestsPage({ role, search, onNavigate, onAction }) {
  return (
    <Card>
      <CardHeading title={role === 'admin' ? 'All marketplace requests' : 'Your sourcing requests'} subtitle={role === 'admin' ? 'Monitor requests across the marketplace' : 'Manage requests and review cargo company offers'} action={<span className="results-count">{customerRequests.length} requests</span>} />
      <RequestTable rows={customerRequests} onSelect={onNavigate} search={search} />
      {role === 'customer' && <button className="secondary-button page-bottom-action" onClick={() => onAction('new-request')}><Icon name="plus" size={17} />Create a new request</button>}
    </Card>
  );
}

function CompaniesPage() {
  const directory = [
    { name: 'Muna Logistics', initials: 'ML', country: 'China', rating: '4.9', shipments: 128, route: 'Guangzhou → Hargeisa', tag: 'Verified' },
    { name: 'Orient Cargo', initials: 'OC', country: 'China', rating: '4.8', shipments: 96, route: 'Yiwu → Berbera', tag: 'Verified' },
    { name: 'Anatolia Cargo', initials: 'AC', country: 'Turkey', rating: '4.7', shipments: 74, route: 'Istanbul → Hargeisa', tag: 'Verified' },
  ];
  return (
    <div className="company-grid">
      {directory.map((company) => (
        <Card className="directory-card" key={company.name}>
          <div className="directory-top"><Avatar initials={company.initials} className="large-avatar" /><span className="verified-badge"><Icon name="check" size={13} />{company.tag}</span></div>
          <h2>{company.name}</h2>
          <p className="company-location">{company.country} <i /> {company.route}</p>
          <div className="company-metrics"><span><strong>{company.rating}</strong> rating</span><span><strong>{company.shipments}</strong> shipments</span></div>
          <button className="secondary-button full-button">View company <Icon name="arrow" size={16} /></button>
        </Card>
      ))}
    </div>
  );
}

function OpportunitiesPage({ search, onAction }) {
  const filtered = opportunities.filter((item) => `${item.product} ${item.route} ${item.customer}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="opportunity-list">
      {filtered.map((item) => (
        <Card className="opportunity-card" key={item.id}>
          <div className="opportunity-card-top"><span className="opportunity-icon"><Icon name="box" /></span><StatusBadge>Open</StatusBadge><span className="opportunity-date"><Icon name="clock" size={15} />{item.date}</span></div>
          <h2>{item.product}</h2>
          <div className="opportunity-details"><span><Icon name="globe" size={16} />{item.route}</span><span>Customer: {item.customer}</span><span>Budget: <b>{item.budget}</b></span></div>
          <div className="opportunity-card-footer"><span>Request <b>{item.id}</b></span><button className="primary-button" onClick={() => onAction(`offer:${item.id}`)}>Send an offer <Icon name="arrow" size={16} /></button></div>
        </Card>
      ))}
      {!filtered.length && <Card className="empty-state"><strong>No matching opportunities</strong><p>Try changing your search.</p></Card>}
    </div>
  );
}

function OffersPage({ onAction }) {
  const offers = [
    { id: 'TX-2048', product: '50 business laptops', customer: 'Abdi Hassan', amount: '$19,400', date: 'Oct 25, 2026', status: 'Under review' },
    { id: 'TX-2038', product: 'Home furniture set', customer: 'Hodan M.', amount: '$2,250', date: 'Oct 19, 2026', status: 'Accepted' },
    { id: 'TX-2028', product: 'Phone accessories · 300 units', customer: 'Sahra A.', amount: '$1,180', date: 'Oct 14, 2026', status: 'Declined' },
  ];
  return <Card><CardHeading title="Offers sent" subtitle="Track customer responses to your quotes" /><div className="table-scroll"><table className="data-table"><thead><tr><th>Request</th><th>Customer</th><th>Your offer</th><th>Sent</th><th>Status</th><th /></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}><td><span className="table-primary">{offer.product}</span><span className="table-secondary">{offer.id}</span></td><td>{offer.customer}</td><td><b>{offer.amount}</b></td><td>{offer.date}</td><td><StatusBadge>{offer.status}</StatusBadge></td><td><button className="icon-button table-action" aria-label={`View offer ${offer.id}`} onClick={() => onAction(`message:${offer.id}`)}><Icon name="arrow" size={17} /></button></td></tr>)}</tbody></table></div></Card>;
}

function CustomerOffersPage({ onAction }) {
  const offers = [
    { id: 'OF-884', company: 'Muna Logistics', initials: 'ML', rating: '4.9', amount: '$19,400', delivery: '18–22 days', includes: 'Shipping, customs & delivery' },
    { id: 'OF-882', company: 'Orient Cargo', initials: 'OC', rating: '4.8', amount: '$20,150', delivery: '15–20 days', includes: 'Shipping & customs clearance' },
    { id: 'OF-879', company: 'Silk Road Shipping', initials: 'SR', rating: '4.7', amount: '$18,950', delivery: '22–28 days', includes: 'Shipping to Hargeisa' },
  ];
  return (
    <div className="offer-review-layout">
      <Card>
        <CardHeading title="50 business laptops" subtitle="Request TX-2048 · China → Hargeisa · 50 units" action={<StatusBadge>Offers received</StatusBadge>} />
        <div className="offer-review-list">
          {offers.map((offer, index) => (
            <article className={`offer-review-card${index === 0 ? ' recommended' : ''}`} key={offer.id}>
              <div className="offer-company">
                <Avatar initials={offer.initials} />
                <div><strong>{offer.company}</strong><span>★ {offer.rating} rating <i /> {offer.id}</span></div>
                {index === 0 && <span className="recommend-label">BEST MATCH</span>}
              </div>
              <div className="offer-price"><strong>{offer.amount}</strong><span>Total estimated cost</span></div>
              <div className="offer-facts"><span><Icon name="clock" size={15} />{offer.delivery}</span><span><Icon name="check" size={15} />{offer.includes}</span></div>
              <div className="offer-actions"><button className="secondary-button" onClick={() => onAction(`message:${offer.id}`)}>Chat with company</button><button className="primary-button" onClick={() => onAction(`accept:${offer.id}`)}>Accept offer <Icon name="arrow" size={15} /></button></div>
            </article>
          ))}
        </div>
      </Card>
      <Card className="offer-summary"><CardHeading title="Your request" /><div className="summary-item"><span>Product</span><strong>Business laptops</strong></div><div className="summary-item"><span>Quantity</span><strong>50 units</strong></div><div className="summary-item"><span>Ship to</span><strong>Hargeisa, Somaliland</strong></div><div className="summary-item"><span>Offers received</span><strong>4 companies</strong></div><button className="secondary-button full-button" onClick={() => onAction('request:TX-2048')}>View request details</button></Card>
    </div>
  );
}

function MessagesPage({ onAction }) {
  const [selected, setSelected] = useState(0);
  return (
    <Card className="messages-card">
      <div className="conversation-list">
        <div className="conversation-heading"><h2>Conversations</h2><button className="icon-button" aria-label="New message" onClick={() => onAction('message:new')}><Icon name="plus" /></button></div>
        {conversations.map((conversation, index) => (
          <button className={`conversation-row${selected === index ? ' selected' : ''}`} key={conversation.name} onClick={() => setSelected(index)}>
            <Avatar initials={conversation.initials} />
            <span className="conversation-copy"><b>{conversation.name}</b><small>{conversation.message}</small></span>
            <span className="conversation-meta"><time>{conversation.time}</time>{conversation.unread > 0 && <i>{conversation.unread}</i>}</span>
          </button>
        ))}
      </div>
      <div className="chat-pane">
        <div className="chat-heading"><Avatar initials={conversations[selected].initials} /><span><b>{conversations[selected].name}</b><small><i /> Online · China</small></span><button className="icon-button" aria-label="Conversation details"><Icon name="dots" /></button></div>
        <div className="chat-context"><span>Request TX-2048</span><b>50 business laptops</b><button onClick={() => onAction('request:TX-2048')}>View request</button></div>
        <div className="chat-history"><p className="chat-day">TODAY</p><div className="chat-message received">Hello Abdi, we found the laptop model you requested. I’ve sent a detailed quote.<time>10:34 AM</time></div><div className="chat-message sent">Thanks! Does that include shipping to Hargeisa and customs?<time>10:38 AM</time></div><div className="chat-message received">Yes, the quote includes door-to-door shipping and customs clearance.<time>10:42 AM</time></div></div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); onAction('message:sent'); event.currentTarget.reset(); }}><input aria-label="Write a message" placeholder="Write a message…" required /><button className="primary-button" type="submit" aria-label="Send message"><Icon name="send" size={17} /></button></form>
      </div>
    </Card>
  );
}

function ProfilePage({ onAction }) {
  return (
    <div className="profile-layout">
      <Card className="profile-card"><div className="profile-identity"><Avatar initials="GC" className="profile-avatar" /><div><h2>Global Cargo Ltd</h2><p>Guangzhou, China · Member since 2024</p></div><StatusBadge>Verified</StatusBadge></div><p className="profile-description">Trusted sourcing and cargo partner connecting businesses across China and Somaliland. Our team supports procurement, quality checks, and reliable door-to-door delivery.</p><div className="profile-metrics"><span><b>4.8</b>Average rating</span><span><b>126</b>Completed orders</span><span><b>98%</b>Response rate</span></div><button className="secondary-button" onClick={() => onAction('profile:edit')}>Edit company profile</button></Card><Card><CardHeading title="Services & routes" /><div className="service-list"><span><Icon name="check" size={16} />Product sourcing</span><span><Icon name="check" size={16} />Quality inspection</span><span><Icon name="check" size={16} />Air and sea freight</span><span><Icon name="check" size={16} />Customs clearance</span></div><p className="eyebrow route-label">ACTIVE ROUTES</p><div className="route-chips"><span>Guangzhou → Hargeisa</span><span>Yiwu → Berbera</span></div></Card></div>
  );
}

function ReportsPage() {
  return <><div className="stats-grid"><StatCard label="New accounts" value="348" change="+16.2% vs last month" icon="building" /><StatCard label="Requests posted" value="512" change="+12.8% vs last month" icon="box" tone="green" /><StatCard label="Offer conversion" value="68.4%" change="+4.1% vs last month" icon="chart" tone="amber" /><StatCard label="Avg. time to match" value="4.2 hrs" change="−18% vs last month" icon="clock" tone="navy" /></div><Card><CardHeading title="Marketplace request growth" subtitle="Monthly request volume across the platform" action={<button className="secondary-button"><Icon name="download" size={16} />Export report</button>} /><OverviewChart /></Card></>;
}

function RequestForm({ onClose, onCreated }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="request-modal" onSubmit={(event) => { event.preventDefault(); onCreated(); }}>
        <div className="modal-heading"><div><p className="eyebrow">NEW SOURCING REQUEST</p><h2>What are you looking for?</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>
        <p className="page-description">Share a few details and verified companies can prepare an offer for you.</p>
        <label>Product or item<input required placeholder="e.g. 50 business laptops" /></label>
        <div className="form-row"><label>Source country<select defaultValue="China"><option>China</option><option>Turkey</option></select></label><label>Delivery to<input required defaultValue="Hargeisa, Somaliland" /></label></div>
        <label>Quantity<input required placeholder="e.g. 50 units" /></label>
        <label>Additional details<textarea rows="3" placeholder="Specifications, preferred brands, or other requirements" /></label>
        <button className="primary-button full-button" type="submit">Post request <Icon name="arrow" size={17} /></button>
      </form>
    </div>
  );
}

function SignInPage() {
  const [message, setMessage] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('Sign-in is not connected yet. Your account session was cleared.');
  }

  return (
    <main className="signin-page">
      <a className="signin-brand" href="/" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></a>
      <form className="signin-card" onSubmit={handleSubmit}>
        <p className="eyebrow">CUSTOMER PORTAL</p>
        <h1>Welcome back</h1>
        <p className="page-description">You have been signed out. Sign in to continue to your Tayonx workspace.</p>
        <label htmlFor="signin-email">Email address<input autoComplete="email" id="signin-email" name="email" placeholder="you@example.com" required type="email" /></label>
        <label htmlFor="signin-password">Password<input autoComplete="current-password" id="signin-password" name="password" placeholder="Enter your password" required type="password" /></label>
        <button className="primary-button full-button" type="submit">Sign in</button>
        <a className="secondary-button full-button auth-link-button" href="/register">Create an account</a>
        <p className="signin-message" aria-live="polite">{message}</p>
      </form>
      <p className="signin-footnote">Connect · Request · Chat · Get it done</p>
    </main>
  );
}

function RegisterPage() {
  const [message, setMessage] = useState('');
  const [role, setRole] = useState('customer');
  const [country, setCountry] = useState('Somaliland');
  const isCustomer = role === 'customer';
  const countries = isCustomer ? ['Somaliland', 'Somalia', 'Other'] : ['China', 'Turkey'];

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('Registration is ready. Account creation is not connected yet.');
  }

  return (
    <main className="signup-page">
      <aside className="signup-welcome">
        <a className="signup-brand" href="/" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></a>
        <div className="signup-welcome-copy">
          <h1>Connect. Request. Chat. Get it done.</h1>
          <p>One account to source products from China and Turkey, or to serve customers in Somaliland.</p>
          <ul>
            <li><Icon name="check" size={17} />Verified cargo companies</li>
            <li><Icon name="check" size={17} />Real-time chat</li>
            <li><Icon name="check" size={17} />Track every order</li>
          </ul>
        </div>
        <p className="signup-panel-footnote">Everything you need, all in one place.</p>
      </aside>

      <section className="signup-form-panel">
        <form className="signup-form" onSubmit={handleSubmit}>
          <header className="signup-heading">
            <h2>Create your account</h2>
            <p>Already have one? <a href="/login">Sign in</a></p>
          </header>

          <fieldset className="signup-role-picker">
            <legend>I am a…</legend>
            <button
              aria-pressed={isCustomer}
              className={`signup-role-option${isCustomer ? ' selected' : ''}`}
              onClick={() => {
                setRole('customer');
                setCountry('Somaliland');
                setMessage('');
              }}
              type="button"
            >
              <span className="signup-role-icon customer">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              </span>
              <span><b>Customer</b><small>I want to buy products from China or Turkey.</small></span>
            </button>
            <button
              aria-pressed={!isCustomer}
              className={`signup-role-option${!isCustomer ? ' selected' : ''}`}
              onClick={() => {
                setRole('provider');
                setCountry('China');
                setMessage('');
              }}
              type="button"
            >
              <span className="signup-role-icon provider">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17h18l-2 4H5l-2-4Z" />
                  <path d="M5 17V9h14v8M9 9V5h6v4" />
                </svg>
              </span>
              <span><b>Cargo company</b><small>I source and ship products for customers.</small></span>
            </button>
          </fieldset>

          <div className="signup-name-country">
            <label htmlFor="register-name">
              {isCustomer ? 'Full name' : 'Company name'}
              <input
                autoComplete={isCustomer ? 'name' : 'organization'}
                id="register-name"
                name="name"
                placeholder={isCustomer ? 'Abdi Hassan' : 'Global Cargo Ltd'}
                required
              />
            </label>
            <label htmlFor="register-country">
              Country
              <select
                id="register-country"
                name="country"
                onChange={(event) => setCountry(event.target.value)}
                value={country}
              >
                {countries.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <label htmlFor="register-contact">
            Phone or email
            <input id="register-contact" name="contact" placeholder="+252 63 … or name@email.com" required />
          </label>
          <label htmlFor="register-password">
            Password
            <input autoComplete="new-password" id="register-password" minLength={8} name="password" placeholder="At least 8 characters" required type="password" />
          </label>

          {!isCustomer && (
            <div className="signup-verification-note">
              <Icon name="shield" size={20} />
              <div><b>Verification required</b><p>You&apos;ll upload your business license next. You can send offers once an admin approves you.</p></div>
            </div>
          )}

          <button className="primary-button signup-submit" type="submit">Create account</button>
          <p className="signup-legal">By continuing you agree to the <a href="#terms">terms</a> and <a href="#privacy">privacy policy</a>.</p>
          <p className="signin-message" aria-live="polite">{message}</p>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [isLoginRoute] = useState(() => window.location.pathname.replace(/\/+$/, '') === '/login');
  const [isRegisterRoute] = useState(() => window.location.pathname.replace(/\/+$/, '') === '/register');
  const [activeRole, setActiveRole] = useState('customer');
  const [activeSection, setActiveSection] = useState('overview');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [verifiedCompanies, setVerifiedCompanies] = useState(pendingCompanies);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const currentRole = roles[activeRole];
  useEffect(() => {
    document.title = isLoginRoute
      ? 'Tayonx | Sign in'
      : isRegisterRoute
        ? 'Tayonx | Create account'
        : 'Tayonx | Marketplace dashboards';
  }, [isLoginRoute, isRegisterRoute]);
  const pageDetails = useMemo(() => {
    const titles = {
      overview: ['Good morning,', 'Here’s what’s happening with your marketplace today.'],
      requests: ['Requests', 'Keep every sourcing request moving forward.'],
      companies: ['Cargo companies', 'Discover verified partners for your next order.'],
      messages: ['Messages', 'Your conversations with customers and cargo partners.'],
      opportunities: ['Matching opportunities', 'Find requests that match your routes and services.'],
      offers: ['My offers', 'Follow up on quotes you have sent to customers.'],
      customerOffers: ['Offers to review', 'Compare cargo company quotes and choose the right partner.'],
      profile: ['Company profile', 'Manage the details customers see about your business.'],
      verification: ['Company verification', 'Review submitted documents and approve trusted providers.'],
      reports: ['Marketplace reports', 'A snapshot of activity and growth across Tayonx.'],
    };
    if (activeSection === 'offers' && activeRole === 'customer') return titles.customerOffers;
    return titles[activeSection] || titles.overview;
  }, [activeRole, activeSection]);

  function navigate(section) {
    setActiveSection(section);
    setMobileNavOpen(false);
  }

  function selectRole(role) {
    setActiveRole(role);
    setActiveSection('overview');
    setSearch('');
    setMessage('');
    setMobileNavOpen(false);
  }

  function handleAction(action) {
    if (action === 'new-request') {
      setRequestModalOpen(true);
      return;
    }
    if (action.startsWith('offer:')) {
      setMessage(`Offer form opened for ${action.split(':')[1]}.`);
    } else if (action.startsWith('accept:')) {
      setMessage(`Offer ${action.split(':')[1]} accepted. The company can now coordinate your order.`);
    } else if (action.startsWith('message:')) {
      setMessage(action === 'message:sent' ? 'Message sent.' : 'Conversation opened.');
    } else if (action.startsWith('profile:')) {
      setMessage('Profile editing will be available when your account is connected.');
    } else {
      setMessage('Request details opened.');
    }
  }

  function approveCompany(id, approved) {
    const company = verifiedCompanies.find((item) => item.id === id);
    setVerifiedCompanies((current) => current.filter((item) => item.id !== id));
    if (company) setMessage(`${company.name} ${approved ? 'approved' : 'declined'}.`);
  }

  function renderSection() {
    if (activeSection === 'overview') {
      return <Overview role={activeRole} onNavigate={navigate} onAction={handleAction} search={search} verifiedCompanies={verifiedCompanies} />;
    }
    if (activeSection === 'requests') return <RequestsPage role={activeRole} search={search} onNavigate={navigate} onAction={handleAction} />;
    if (activeSection === 'offers' && activeRole === 'customer') return <CustomerOffersPage onAction={handleAction} />;
    if (activeSection === 'offers' && activeRole === 'provider') return <OffersPage onAction={handleAction} />;
    if (activeSection === 'companies') return <CompaniesPage />;
    if (activeSection === 'messages') return <MessagesPage onAction={handleAction} />;
    if (activeSection === 'opportunities') return <OpportunitiesPage search={search} onAction={handleAction} />;
    if (activeSection === 'profile') return <ProfilePage onAction={handleAction} />;
    if (activeSection === 'verification') return <Card><CardHeading title="Pending company applications" subtitle="Business details and licenses submitted for review" action={<span className="results-count">{verifiedCompanies.length} to review</span>} /><CompanyTable companies={verifiedCompanies} onReview={() => setMessage('Business license preview opened.')} onVerify={(id) => approveCompany(id, true)} onReject={(id) => approveCompany(id, false)} /></Card>;
    if (activeSection === 'reports') return <ReportsPage />;
    return null;
  }

  const title = activeSection === 'overview'
    ? `${pageDetails[0]} ${currentRole.name.split(' ')[0]}`
    : pageDetails[0];
  const showSearch = ['overview', 'requests', 'opportunities', 'verification'].includes(activeSection);
  const headerAction = activeRole === 'customer' && ['overview', 'requests'].includes(activeSection)
    ? <button className="primary-button" onClick={() => handleAction('new-request')}><Icon name="plus" size={17} />New request</button>
    : activeRole === 'provider' && activeSection === 'opportunities'
      ? <button className="secondary-button" onClick={() => navigate('offers')}>View my offers <Icon name="arrow" size={16} /></button>
      : null;

  if (isLoginRoute) return <SignInPage />;
  if (isRegisterRoute) return <RegisterPage />;

  function handleSignOut() {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
        <a className="sidebar-brand" href="#home" aria-label="Tayonx dashboard home" onClick={() => navigate('overview')}><img src={logo} alt="Tayonx" /></a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="role-switcher" aria-label="Choose dashboard">
          {Object.entries(roles).map(([role, config]) => (
            <button className={`role-switch${activeRole === role ? ' active' : ''}`} key={role} onClick={() => selectRole(role)}>
              <Avatar initials={config.initials} className="role-avatar" /><span>{config.label}</span>{activeRole === role && <span className="active-role-dot" />}
            </button>
          ))}
        </div>
        <div className="nav-divider" />
        <p className="nav-caption">{currentRole.descriptor}</p>
        <nav className="side-nav" aria-label={`${currentRole.label} navigation`}>
          {currentRole.navigation.map(([section, label, icon]) => (
            <button className={`nav-item${activeSection === section ? ' active' : ''}`} key={section} onClick={() => navigate(section)}>
              <Icon name={icon} size={19} /><span>{label}</span>{label === 'Messages' && <i className="nav-count">2</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span><Icon name="shield" size={18} /></span><div><b>Need a hand?</b><small>Visit our help center</small></div><Icon name="arrow" size={15} /></div>
          {showDropdown && (
            <div className="account-dropdown" role="menu">
              <button className="signout-button" onClick={handleSignOut} role="menuitem">
                <span>Sign out</span>
              </button>
            </div>
          )}
          <div className="sidebar-user">
            <Avatar initials={currentRole.initials} />
            <span><b>{currentRole.name}</b><small>{currentRole.label}</small></span>
            <button
              aria-expanded={showDropdown}
              aria-haspopup="menu"
              aria-label="Open account menu"
              className="account-menu-button"
              onClick={() => setShowDropdown((isOpen) => !isOpen)}
            >
              <Icon name="dots" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumb"><span>{currentRole.label}</span><Icon name="arrow" size={14} /><b>{pageDetails[0]}</b></div>
          <div className="topbar-actions">
            {showSearch && <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything…" /><kbd>⌘ K</kbd></label>}
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /><i /></button>
            <Avatar initials={currentRole.initials} className="topbar-avatar" />
          </div>
        </header>

        <main className="dashboard-main">
          <PageTitle eyebrow={`${currentRole.label} dashboard`} title={title} description={pageDetails[1]} action={headerAction} />
          {message && <div className="toast-message" role="status"><Icon name="check" size={17} />{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></div>}
          <div className="dashboard-content">{renderSection()}</div>
          <footer className="dashboard-footer"><span>© 2026 Tayonx</span><span>Connect · Request · Chat · Get it done</span><button onClick={() => setMessage('Help center opened.')}>Help & support</button></footer>
        </main>
      </div>

      {requestModalOpen && <RequestForm onClose={() => setRequestModalOpen(false)} onCreated={() => { setRequestModalOpen(false); setMessage('Your request has been saved as a draft.'); }} />}
    </div>
  );
}

export default App;
