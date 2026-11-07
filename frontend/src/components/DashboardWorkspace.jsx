import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from './Icon.jsx';
import '../App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const dashboardPaths = {
  admin: '/admin/dashboard',
  customer: '/customer/dashboard',
  cargo_provider: '/cargo/dashboard',
};

const roles = {
  customer: {
    label: 'Customer',
    name: 'Abdi Hassan',
    initials: 'AH',
    descriptor: 'Customer workspace',
    navigation: [
      ['overview', 'Dashboard', 'home'],
      ['requests', 'My requests', 'box'],
      ['new-request', 'New request', 'plus'],
      ['companies', 'Cargo companies', 'building'],
      ['messages', 'Chat', 'chat'],
      ['notifications', 'Notifications', 'bell'],
      ['profile', 'Profile', 'user'],
    ],
  },
  provider: {
    label: 'Cargo provider',
    name: 'Global Cargo Ltd',
    initials: 'GC',
    descriptor: 'Provider workspace',
    navigation: [
      ['overview', 'Dashboard', 'home'],
      ['opportunities', 'Requests', 'box'],
      ['offers', 'My offers', 'mail'],
      ['messages', 'Chats', 'chat'],
      ['profile', 'Company profile', 'building'],
    ],
  },
  admin: {
    label: 'Admin',
    name: 'Tayonx Admin',
    initials: 'SA',
    descriptor: 'Admin workspace',
    navigation: [
      ['overview', 'Dashboard', 'home'],
      ['requests', 'Requests', 'box'],
      ['companies', 'Cargo companies', 'building'],
      ['users', 'Users', 'users'],
      ['messages', 'Chats & reports', 'chat'],
      ['reports', 'Analytics', 'chart'],
      ['settings', 'Settings', 'settings'],
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

function CustomerDashboard({ onNavigate, onAction }) {
  const requests = [
    { name: 'Laptops · 50 pcs', detail: 'From China · posted Nov 4, 2026', icon: 'laptop', status: '3 offers', tone: 'info' },
    { name: 'Wireless earbuds · 200 pcs', detail: 'From China · Oct 30, 2026', icon: 'headphones', status: 'In progress', tone: 'warning' },
    { name: 'Textiles · 2 rolls', detail: 'From Turkey · Oct 12, 2026', icon: 'package', status: 'Delivered', tone: 'success' },
  ];
  const companies = [
    { initials: 'GC', name: 'Global Cargo Trade', meta: '4.8 (120 reviews) · China', tone: 'navy' },
    { initials: 'IS', name: 'Istanbul Express Cargo', meta: '4.6 (84 reviews) · Turkey', tone: 'blue' },
  ];
  const chats = [
    { initials: 'GC', name: 'Global Cargo Trade', message: 'Yes! We can help you. Please tell us the model...', time: '10:22', unread: true },
    { initials: 'IS', name: 'Istanbul Express Cargo', message: 'Fabric samples are ready.', time: 'Yesterday', unread: false },
  ];

  return (
    <div className="customer-dashboard">
      <div className="customer-stats-grid">
        {[
          { label: 'Active requests', value: '2', icon: 'box' },
          { label: 'Offers waiting', value: '3', icon: 'mail' },
          { label: 'Active chat', value: '1', icon: 'chat' },
          { label: 'Completed', value: '1', icon: 'check' },
        ].map((stat) => (
          <article className="customer-stat-card" key={stat.label}>
            <span className="customer-stat-icon"><Icon name={stat.icon} size={17} /></span>
            <div><strong>{stat.value}</strong><span>{stat.label}</span></div>
          </article>
        ))}
      </div>

      <section className="offers-notice">
        <Icon name="mail" size={18} />
        <div><strong>3 offers for “50 × laptops”</strong><span>Compare price, delivery time and rating before you accept.</span></div>
        <button className="small-primary" onClick={() => onNavigate('offers')}>Compare offers</button>
      </section>

      <div className="customer-dashboard-grid customer-dashboard-grid-main">
        <Card className="customer-list-card">
          <CardHeading
            title="My recent requests"
            action={<button className="link-button" onClick={() => onNavigate('requests')}>View all <Icon name="arrow" size={15} /></button>}
          />
          <div className="customer-request-list">
            {requests.map((request) => (
              <button className="customer-request-row" key={request.name} onClick={() => onNavigate('requests')}>
                <span className="customer-request-icon"><Icon name={request.icon} size={19} /></span>
                <span className="customer-row-copy"><strong>{request.name}</strong><small>{request.detail}</small></span>
                <span className={`customer-status customer-status-${request.tone}`}>{request.status}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="customer-tracking-card">
          <CardHeading title="Tracking: earbuds" action={<span className="customer-status customer-status-warning">In progress</span>} />
          <ol className="shipment-tracking">
            <li className="complete"><i /><span><strong>Offer accepted</strong><small>Global Cargo Trade · Oct 31</small></span></li>
            <li className="complete"><i /><span><strong>Goods purchased</strong><small>Shenzhen · Nov 2</small></span></li>
            <li className="current"><i /><span><strong>Shipping to Berbera</strong><small>Est. arrival · Confirm</small></span></li>
            <li><i /><span><strong>Delivered to Hargeisa</strong></span></li>
          </ol>
        </Card>
      </div>

      <div className="customer-dashboard-grid customer-dashboard-grid-secondary">
        <Card className="customer-list-card">
          <CardHeading
            title="Top cargo companies"
            action={<button className="link-button" onClick={() => onNavigate('companies')}>View all <Icon name="arrow" size={15} /></button>}
          />
          <div className="customer-compact-list">
            {companies.map((company) => (
              <div className="customer-company-row" key={company.name}>
                <Avatar initials={company.initials} className={`customer-company-avatar ${company.tone}`} />
                <span className="customer-row-copy"><strong>{company.name} <i>✓ Verified</i></strong><small><b>★</b> {company.meta}</small></span>
                <button className="customer-outline-button" onClick={() => { onNavigate('messages'); onAction('message:opened'); }}>Chat</button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="customer-list-card">
          <CardHeading
            title="Recent chats"
            action={<button className="link-button" onClick={() => onNavigate('messages')}>Open chat <Icon name="arrow" size={15} /></button>}
          />
          <div className="customer-compact-list">
            {chats.map((chat) => (
              <button className="customer-chat-row" key={chat.name} onClick={() => onNavigate('messages')}>
                <Avatar initials={chat.initials} className={`customer-company-avatar ${chat.initials === 'GC' ? 'navy' : 'blue'}`} />
                <span className="customer-row-copy"><strong>{chat.name}</strong><small>{chat.message}</small></span>
                <span className="customer-chat-time">{chat.time}{chat.unread && <i>1</i>}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <p className="customer-sample-note">All names and numbers are <span>SAMPLE</span> data from the concept.</p>
    </div>
  );
}

function ProviderDashboard({ onNavigate, onAction }) {
  const [requestFilter, setRequestFilter] = useState('China');
  const requests = [
    { id: 'TX-2055', product: 'MacBook Pro · 20 pcs', detail: '14-inch, M-series · budget [$–] · needed by Dec 20', location: 'Hargeisa', time: '12 min ago', icon: 'laptop', country: 'China' },
    { id: 'TX-2054', product: 'Laptops · 50 pcs', detail: 'Core i5, 16 GB · sea freight OK', location: 'Hargeisa', time: '2 h ago', icon: 'laptop', country: 'China' },
    { id: 'TX-2053', product: 'Solar panels · 40 pcs', detail: '400 W mono · to Berbera port', location: 'Borama', time: 'Yesterday', icon: 'package', country: 'China' },
    { id: 'TX-2052', product: 'Phone cases · 1,000 pcs', detail: 'Mixed models · air freight', location: 'Burao', time: 'Yesterday', icon: 'user', country: 'China' },
    { id: 'TX-2051', product: 'Cotton fabric · 200 yards', detail: 'Woven cotton · delivery to Hargeisa', location: 'Hargeisa', time: 'Yesterday', icon: 'package', country: 'Turkey' },
  ];
  const chats = [
    { initials: 'AH', name: 'Abdi Hassan', message: 'Thanks for your response!', time: '10:24', unread: '2' },
    { initials: 'AA', name: 'Ahmed Ali', message: 'Okay, thank you!', time: 'Yesterday' },
  ];
  const visibleRequests = requests.filter((request) => requestFilter === 'All' || request.country === requestFilter);

  return (
    <div className="provider-dashboard">
      <div className="provider-stats-grid">
        {[
          { label: 'New requests', value: '8', icon: 'box' },
          { label: 'Active chats', value: '5', icon: 'chat' },
          { label: 'Customers served', value: '12', icon: 'check' },
          { label: 'Rating · 120 reviews', value: '4.8', icon: 'star', tone: 'amber' },
        ].map((stat) => (
          <article className="provider-stat-card" key={stat.label}>
            <span className={`provider-stat-icon${stat.tone ? ` ${stat.tone}` : ''}`}><Icon name={stat.icon} size={16} /></span>
            <div><strong>{stat.value}</strong><span>{stat.label}</span></div>
          </article>
        ))}
      </div>

      <div className="provider-dashboard-grid">
        <Card className="provider-requests-card">
          <CardHeading
            title="New requests for you"
            action={<div className="provider-request-filters">{['China', 'All'].map((filter) => <button className={requestFilter === filter ? 'active' : ''} key={filter} onClick={() => setRequestFilter(filter)}>{filter}</button>)}</div>}
          />
          <div className="provider-request-list">
            {visibleRequests.map((request) => (
              <article className="provider-request-row" key={request.id}>
                <span className="customer-request-icon"><Icon name={request.icon} size={19} /></span>
                <button className="provider-request-info" onClick={() => onNavigate('opportunities')}>
                  <div className="provider-request-title"><strong>{request.product}</strong><span>● New</span></div>
                  <small>{request.detail}</small>
                  <div className="provider-request-meta"><span><b>SO</b>{request.location}</span><small>{request.time}</small></div>
                </button>
                <div className="provider-request-actions">
                  <button className="customer-outline-button" onClick={() => onAction(`decline:${request.id}`)}>Decline</button>
                  <button className="small-primary" onClick={() => onAction(`offer:${request.id}`)}>Send offer</button>
                </div>
              </article>
            ))}
          </div>
        </Card>

        <div className="provider-dashboard-aside">
          <Card className="provider-list-card">
            <CardHeading title="Chats" action={<button className="link-button" onClick={() => onNavigate('messages')}>View all <Icon name="arrow" size={14} /></button>} />
            <div className="customer-compact-list">
              {chats.map((chat) => (
                <button className="customer-chat-row" key={chat.name} onClick={() => onNavigate('messages')}>
                  <Avatar initials={chat.initials} className="provider-chat-avatar" />
                  <span className="customer-row-copy"><strong>{chat.name}</strong><small>{chat.message}</small></span>
                  <span className="customer-chat-time">{chat.time}{chat.unread && <i>{chat.unread}</i>}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="provider-performance-card">
            <CardHeading title="This month" />
            <div className="provider-performance">
              <div><span>Offer win rate</span><strong>42%</strong><i><b style={{ width: '42%' }} /></i></div>
              <div><span>Reply within 1 hour</span><strong>88%</strong><i><b style={{ width: '88%' }} /></i></div>
              <p>Fast replies rank you higher for customers. <span>SAMPLE</span></p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate, onAction, period }) {
  const latestRequests = [
    { id: 'REQ-1051', customer: 'Abdi Hassan', product: 'MacBook Pro × 20', source: 'China', offers: 4, status: 'Open' },
    { id: 'REQ-1042', customer: 'Abdi Hassan', product: 'Laptops × 50', source: 'China', offers: 3, status: 'Offers received' },
    { id: 'REQ-1037', customer: 'Ahmed Ali', product: 'Textiles × 2 rolls', source: 'Turkey', offers: 2, status: 'In progress' },
    { id: 'REQ-1029', customer: 'Hodan Yusuf', product: 'Solar panels × 40', source: 'China', offers: 5, status: 'Delivered' },
  ];

  return (
    <div className="admin-dashboard" data-period={period}>
      <div className="admin-kpi-grid">
        {[
          { label: 'Customers', value: '1.2K', detail: 'Up 8% this month', icon: 'users', tone: 'blue' },
          { label: 'Cargo companies', value: '350', detail: '12 new', icon: 'building', tone: 'green' },
          { label: 'Requests', value: '2.4K', detail: 'Up 15%', icon: 'box', tone: 'navy' },
          { label: 'Awaiting verification', value: '6', detail: 'Review now', icon: 'shield', tone: 'amber', action: true },
        ].map((stat) => (
          <button className={`admin-kpi admin-kpi-${stat.tone}`} key={stat.label} onClick={stat.action ? () => onNavigate('companies') : undefined}>
            <span className="admin-kpi-icon"><Icon name={stat.icon} size={16} /></span>
            <span className="admin-kpi-content"><strong>{stat.value}</strong><span>{stat.label}</span><small>{stat.action ? <><u>Review now</u></> : stat.detail}</small></span>
          </button>
        ))}
      </div>

      <div className="admin-insights-grid">
        <Card className="admin-insight-card">
          <CardHeading title="Requests overview" action={<span className="admin-caption">1,600 total</span>} />
          <div className="admin-request-overview">
            <div className="admin-donut" role="img" aria-label="Requests: 53% completed, 33% open, 14% cancelled"><span>53%</span></div>
            <div className="admin-legend">
              <div><i className="completed" />Completed<strong>850</strong></div>
              <div><i className="open" />Open<strong>520</strong></div>
              <div><i className="cancelled" />Cancelled<strong>230</strong></div>
            </div>
          </div>
        </Card>

        <Card className="admin-insight-card">
          <CardHeading title="Requests by source" />
          <div className="admin-source-content">
            <div className="admin-source-item"><span><b>CN</b>China</span><strong>72%</strong><i><b style={{ width: '72%' }} /></i></div>
            <div className="admin-source-item"><span><b>TR</b>Turkey</span><strong>28%</strong><i><b className="turkey" style={{ width: '28%' }} /></i></div>
            <p>Top categories: Electronics · Textiles · Household</p>
          </div>
        </Card>

        <Card className="admin-insight-card">
          <CardHeading title="Recent activity" action={<button className="link-button" onClick={() => onNavigate('messages')}>All <Icon name="arrow" size={14} /></button>} />
          <ol className="admin-activity-list">
            <li className="current"><i /><span><strong>New request · Laptops × 50</strong><small>Abdi Hassan · 2 min ago</small></span></li>
            <li className="success"><i /><span><strong>Offer accepted</strong><small>Global Cargo Trade · 5 min ago</small></span></li>
            <li><i /><span><strong>Company applied</strong><small>Anatolia Freight · 8 min ago</small></span></li>
          </ol>
        </Card>
      </div>

      <div className="admin-lower-grid">
        <Card className="admin-latest-card">
          <CardHeading title="Latest requests" action={<button className="link-button" onClick={() => onNavigate('requests')}>View all <Icon name="arrow" size={14} /></button>} />
          <div className="table-scroll">
            <table className="data-table admin-latest-table">
              <thead><tr><th>ID</th><th>Customer</th><th>Product</th><th>Source</th><th>Offers</th><th>Status</th></tr></thead>
              <tbody>{latestRequests.map((request) => (
                <tr key={request.id} onClick={() => onNavigate('requests')}>
                  <td className="admin-request-id">{request.id}</td><td>{request.customer}</td><td>{request.product}</td><td>{request.source}</td><td className="admin-offer-count">{request.offers}</td>
                  <td><span className={`customer-status ${request.status === 'In progress' ? 'customer-status-warning' : request.status === 'Delivered' ? 'customer-status-success' : 'customer-status-info'}`}>{request.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>

        <Card className="admin-attention-card">
          <CardHeading title="Needs attention" action={<span className="admin-danger-count">● 2</span>} />
          <div className="admin-attention-item">
            <Icon name="alert" size={16} />
            <span><strong>Chat reported by a customer</strong><small>Possible payment outside Tayonx · Mersin Shipping</small></span>
            <button onClick={() => onAction('attention:chat')}>Review</button>
          </div>
          <div className="admin-attention-item warning">
            <Icon name="clock" size={16} />
            <span><strong>Request with no offers for 3 days</strong><small>REQ-1018 · Building tiles · Turkey</small></span>
            <button onClick={() => onAction('attention:request')}>Review</button>
          </div>
        </Card>
      </div>

      <p className="admin-sample-note">All figures are <span>SAMPLE</span> data from the concept.</p>
    </div>
  );
}

function Overview({ role, onNavigate, onAction, verifiedCompanies, adminPeriod }) {
  if (role === 'customer') {
    return <CustomerDashboard onNavigate={onNavigate} onAction={onAction} />;
  }

  if (role === 'provider') {
    return <ProviderDashboard onNavigate={onNavigate} onAction={onAction} />;
  }

  if (role === 'admin') {
    return <AdminDashboard onNavigate={onNavigate} onAction={onAction} period={adminPeriod} />;
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

function DashboardWorkspace({ initialRole }) {
  const routerNavigate = useRouterNavigate();
  const [activeRole, setActiveRole] = useState(initialRole);
  const [activeSection, setActiveSection] = useState('overview');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [verifiedCompanies, setVerifiedCompanies] = useState(pendingCompanies);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [adminPeriod, setAdminPeriod] = useState('30 days');
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const currentRole = roles[activeRole];
  useEffect(() => {
    document.title = 'Tayonx | Marketplace dashboards';
  }, []);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    let isCurrent = true;
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!isCurrent) return;
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setMessage('Your session expired. Please sign in again.');
          } else {
            setMessage(result.error || 'Could not verify your account session.');
          }
          return;
        }

        setAuthenticatedUser(result.user);
        const role = result.user.role === 'cargo_provider' ? 'provider' : result.user.role;
        if (roles[role] && role !== initialRole) {
          routerNavigate(dashboardPaths[result.user.role], { replace: true });
        }
      })
      .catch(() => {
        if (isCurrent) setMessage('Unable to verify your account session. Check that the backend is running.');
      });

    return () => {
      isCurrent = false;
    };
  }, [initialRole, routerNavigate]);
  const pageDetails = useMemo(() => {
    const titles = {
      overview: ['Dashboard', 'Welcome back, Abdi Hassan'],
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
    if (section === 'new-request') {
      handleAction('new-request');
      setMobileNavOpen(false);
      return;
    }
    setActiveSection(section);
    setMobileNavOpen(false);
  }

  function selectRole(role) {
    if (role === 'admin' && authenticatedUser?.role !== 'admin') {
      setMessage('Sign in with an admin account to open the admin dashboard.');
      return;
    }
    setActiveRole(role);
    setActiveSection('overview');
    setSearch('');
    setMessage('');
    setMobileNavOpen(false);
    const pathRole = role === 'provider' ? 'cargo_provider' : role;
    routerNavigate(dashboardPaths[pathRole]);
  }

  function handleAction(action) {
    if (action === 'new-request') {
      setRequestModalOpen(true);
      return;
    }
    if (action.startsWith('offer:')) {
      setMessage(`Offer form opened for ${action.split(':')[1]}.`);
    } else if (action.startsWith('decline:')) {
      setMessage(`Request ${action.split(':')[1]} declined.`);
    } else if (action.startsWith('accept:')) {
      setMessage(`Offer ${action.split(':')[1]} accepted. The company can now coordinate your order.`);
    } else if (action.startsWith('message:')) {
      setMessage(action === 'message:sent' ? 'Message sent.' : 'Conversation opened.');
    } else if (action.startsWith('profile:')) {
      setMessage('Profile editing will be available when your account is connected.');
    } else if (action === 'report:exported') {
      const rows = [
        ['ID', 'Customer', 'Product', 'Source', 'Offers', 'Status'],
        ['REQ-1051', 'Abdi Hassan', 'MacBook Pro x 20', 'China', '4', 'Open'],
        ['REQ-1042', 'Abdi Hassan', 'Laptops x 50', 'China', '3', 'Offers received'],
        ['REQ-1037', 'Ahmed Ali', 'Textiles x 2 rolls', 'Turkey', '2', 'In progress'],
        ['REQ-1029', 'Hodan Yusuf', 'Solar panels x 40', 'China', '5', 'Delivered'],
      ];
      const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tayonx-admin-requests.csv';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage('Admin request report exported.');
    } else if (action.startsWith('attention:')) {
      setMessage('Attention item opened for review.');
    } else if (action === 'notifications') {
      setMessage('You have 3 unread notifications.');
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
      return <Overview role={activeRole} onNavigate={navigate} onAction={handleAction} verifiedCompanies={verifiedCompanies} adminPeriod={adminPeriod} />;
    }
    if (activeSection === 'requests') return <RequestsPage role={activeRole} search={search} onNavigate={navigate} onAction={handleAction} />;
    if (activeSection === 'offers' && activeRole === 'customer') return <CustomerOffersPage onAction={handleAction} />;
    if (activeSection === 'offers' && activeRole === 'provider') return <OffersPage onAction={handleAction} />;
    if (activeSection === 'companies' && activeRole === 'admin') return <Card><CardHeading title="Companies awaiting verification" subtitle="Review company documents before providers can send offers" action={<span className="results-count">{verifiedCompanies.length} pending</span>} /><CompanyTable companies={verifiedCompanies} onReview={() => setMessage('Business license preview opened.')} onVerify={(id) => approveCompany(id, true)} onReject={(id) => approveCompany(id, false)} /></Card>;
    if (activeSection === 'companies') return <CompaniesPage />;
    if (activeSection === 'messages') return <MessagesPage onAction={handleAction} />;
    if (activeSection === 'opportunities') return <OpportunitiesPage search={search} onAction={handleAction} />;
    if (activeSection === 'profile') return <ProfilePage onAction={handleAction} />;
    if (activeSection === 'verification') return <Card><CardHeading title="Pending company applications" subtitle="Business details and licenses submitted for review" action={<span className="results-count">{verifiedCompanies.length} to review</span>} /><CompanyTable companies={verifiedCompanies} onReview={() => setMessage('Business license preview opened.')} onVerify={(id) => approveCompany(id, true)} onReject={(id) => approveCompany(id, false)} /></Card>;
    if (activeSection === 'reports') return <ReportsPage />;
    if (activeSection === 'users') return <Card><CardHeading title="Marketplace users" subtitle="Customer and cargo provider accounts" /><div className="admin-users-summary"><div><strong>1,200</strong><span>Customers</span></div><div><strong>350</strong><span>Cargo companies</span></div><p>User management details are sample data for this concept.</p></div></Card>;
    if (activeSection === 'settings') return <Card><CardHeading title="System settings" subtitle="Admin workspace configuration" /><div className="admin-users-summary"><p>System settings are managed by the Tayonx operations team.</p></div></Card>;
    return null;
  }

  const title = activeSection === 'overview'
    ? `${pageDetails[0]} ${currentRole.name.split(' ')[0]}`
    : pageDetails[0];
  const showSearch = ['overview', 'requests', 'opportunities', 'verification'].includes(activeSection);
  const customerMode = activeRole === 'customer';
  const providerMode = activeRole === 'provider';
  const adminMode = activeRole === 'admin';
  const customerDashboardHeader = customerMode && activeSection === 'overview';
  const providerDashboardHeader = providerMode && activeSection === 'overview';
  const adminDashboardHeader = adminMode && activeSection === 'overview';
  const dashboardHeader = customerDashboardHeader || providerDashboardHeader || adminDashboardHeader;
  const headerAction = activeRole === 'customer' && ['overview', 'requests'].includes(activeSection)
    ? <button className="primary-button" onClick={() => handleAction('new-request')}><Icon name="plus" size={17} />New request</button>
    : activeRole === 'provider' && activeSection === 'opportunities'
      ? <button className="secondary-button" onClick={() => navigate('offers')}>View my offers <Icon name="arrow" size={16} /></button>
      : null;

  function handleSignOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    routerNavigate('/login');
  }

  return (
    <div className={`app-shell${customerMode ? ' customer-shell' : ''}${providerMode ? ' provider-shell' : ''}${adminMode ? ' admin-shell' : ''}`}>
      <aside className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}`}>
        <a className="sidebar-brand" href="#home" aria-label="Tayonx dashboard home" onClick={() => navigate('overview')}><img src={logo} alt="Tayonx" /></a>
        {customerMode || providerMode || adminMode ? (
          <div className="workspace-role-picker">
            <button className="customer-role-label" aria-expanded={showRoleMenu} aria-haspopup="menu" onClick={() => setShowRoleMenu((open) => !open)}>
              {providerMode ? 'CARGO PROVIDER' : adminMode ? 'ADMIN' : 'CUSTOMER'}
            </button>
            {showRoleMenu && <div className="role-choice-menu" role="menu">{Object.entries(roles).map(([role, config]) => (
              <button key={role} role="menuitem" onClick={() => { selectRole(role); setShowRoleMenu(false); }}>{config.label}</button>
            ))}</div>}
          </div>
        ) : (
          <>
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
          </>
        )}
        <nav className="side-nav" aria-label={`${currentRole.label} navigation`}>
          {currentRole.navigation.map(([section, label, icon]) => (
            <Fragment key={section}>
              {customerMode && section === 'profile' && <p className="nav-caption customer-account-caption">Account</p>}
              {providerMode && section === 'profile' && <p className="nav-caption customer-account-caption">Company</p>}
              {adminMode && section === 'settings' && <p className="nav-caption customer-account-caption">System</p>}
              <button
                className={`nav-item${activeSection === section ? ' active' : ''}`}
                key={section}
                onClick={() => section === 'notifications' ? handleAction('notifications') : navigate(section)}
              >
                <Icon name={icon} size={customerMode || providerMode || adminMode ? 16 : 19} />
                <span>{label}</span>
                {section === 'messages' && !adminMode && <i className="nav-count">{customerMode ? '1' : '5'}</i>}
                {providerMode && section === 'opportunities' && <i className="nav-count">8</i>}
                {adminMode && section === 'companies' && <i className="nav-count">6</i>}
                {section === 'notifications' && <i className="nav-count">3</i>}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!customerMode && !providerMode && !adminMode && <div className="sidebar-help"><span><Icon name="shield" size={18} /></span><div><b>Need a hand?</b><small>Visit our help center</small></div><Icon name="arrow" size={15} /></div>}
          {showDropdown && (
            <div className="account-dropdown" role="menu">
              <button className="signout-button" onClick={handleSignOut} role="menuitem">
                <span>Sign out</span>
              </button>
            </div>
          )}
          {customerMode || providerMode || adminMode ? (
            <button className="customer-signout" onClick={handleSignOut}><Icon name="arrow" size={15} />Log out</button>
          ) : <div className="sidebar-user">
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
          </div>}
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Icon name="menu" /></button>
          {customerDashboardHeader ? (
            <div className="customer-topbar-title"><strong>Dashboard</strong><span>Welcome back, Abdi Hassan</span></div>
          ) : providerDashboardHeader ? (
            <div className="customer-topbar-title"><strong>Dashboard</strong><span>Welcome back, Global Cargo Ltd</span></div>
          ) : adminDashboardHeader ? (
            <div className="customer-topbar-title"><strong>Admin dashboard</strong><span>Welcome, Super Admin</span></div>
          ) : (
            <div className="breadcrumb"><span>{currentRole.label}</span><Icon name="arrow" size={14} /><b>{pageDetails[0]}</b></div>
          )}
          <div className="topbar-actions">
            {customerDashboardHeader && <span className="customer-country-chip"><b>SO</b>Somaliland</span>}
            {providerDashboardHeader && <><span className="customer-country-chip"><b>CN</b>China</span><span className="provider-verified-chip"><Icon name="check" size={13} />Verified company</span></>}
            {adminDashboardHeader && <>
              <div className="admin-period-switch" aria-label="Dashboard date range">{['7 days', '30 days', 'All time'].map((period) => <button aria-pressed={adminPeriod === period} className={adminPeriod === period ? 'active' : ''} key={period} onClick={() => setAdminPeriod(period)}>{period}</button>)}</div>
              <button className="admin-export-button" onClick={() => handleAction('report:exported')}><Icon name="download" size={13} />Export</button>
            </>}
            {showSearch && !dashboardHeader && <label className="search-box"><Icon name="search" size={17} /><input aria-label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything…" /><kbd>⌘ K</kbd></label>}
            {!providerDashboardHeader && !adminDashboardHeader && <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /><i /></button>}
            {customerDashboardHeader && headerAction}
            <Avatar initials={currentRole.initials} className={providerDashboardHeader || adminDashboardHeader ? 'topbar-avatar provider-topbar-avatar' : 'topbar-avatar'} />
          </div>
        </header>

        <main className={`dashboard-main${customerDashboardHeader ? ' customer-dashboard-main' : ''}${providerDashboardHeader ? ' provider-dashboard-main' : ''}${adminDashboardHeader ? ' admin-dashboard-main' : ''}`}>
          {!dashboardHeader && <PageTitle eyebrow={`${currentRole.label} dashboard`} title={title} description={pageDetails[1]} action={headerAction} />}
          {message && <div className="toast-message" role="status"><Icon name="check" size={17} />{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><Icon name="close" size={16} /></button></div>}
          <div className={`dashboard-content${customerDashboardHeader ? ' customer-dashboard-content' : ''}${providerDashboardHeader ? ' provider-dashboard-content' : ''}${adminDashboardHeader ? ' admin-dashboard-content' : ''}`}>{renderSection()}</div>
          {!dashboardHeader && <footer className="dashboard-footer"><span>© 2026 Tayonx</span><span>Connect · Request · Chat · Get it done</span><button onClick={() => setMessage('Help center opened.')}>Help & support</button></footer>}
        </main>
      </div>

      {requestModalOpen && <RequestForm onClose={() => setRequestModalOpen(false)} onCreated={() => { setRequestModalOpen(false); setMessage('Your request has been saved as a draft.'); }} />}
    </div>
  );
}

export default DashboardWorkspace;
