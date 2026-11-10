import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { getUsers } from '../lib/api.js';
import { offerBreakdown } from '../lib/offerPricing.js';
import { daysUntil, shipmentDates } from '../lib/notifications.js';
import { ROLE_LABELS, VERIFICATION_LABELS } from '../lib/accountFields.js';

// Admin "Data Exports": downloadable system data for a chosen date range — requests, offers,
// shipments, financial records, provider performance and users. Each dataset downloads as an
// Excel-ready CSV (or all of them in one file), and the page can be saved as PDF.
// Charts and platform metrics live on the Analytics page, not here.

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = ['in_progress', 'purchased', 'shipping'];
const STATUS_TEXT = { open: 'Open', offers_received: 'Offers received', in_progress: 'In progress', purchased: 'Purchased', shipping: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled', pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };
const time = (value) => new Date(value || 0).getTime();
const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const statusText = (status) => STATUS_TEXT[status] || status || '';

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function download(filename, rows) {
  const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dueText(request, accepted, now) {
  if (!ACTIVE.includes(request.status)) return request.status === 'delivered' ? 'Delivered' : '';
  const dates = shipmentDates(request, accepted);
  if (!dates) return '';
  const days = daysUntil(dates.dueAt, now);
  return days < 0 ? `${Math.abs(days)} d overdue` : days === 0 ? 'Due today' : `Due in ${days} d`;
}

export default function AdminReports({ requests, offers, loading, now }) {
  const [range, setRange] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dataset, setDataset] = useState('requests');
  const [users, setUsers] = useState([]);
  const [usersError, setUsersError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getUsers({ signal: controller.signal })
      .then((data) => setUsers(data.users || []))
      .catch((error) => { if (error.name !== 'AbortError') setUsersError(error.message); });
    return () => controller.abort();
  }, []);

  const from = range === 'custom' ? (customFrom ? time(customFrom) : 0) : range === 'all' ? 0 : now - Number(range) * DAY;
  const to = range === 'custom' && customTo ? time(customTo) + DAY : Infinity;
  const inRange = (value) => time(value) >= from && time(value) < to;
  const rangeLabel = range === 'all' ? 'All time' : range === 'custom' ? `${customFrom || 'start'} → ${customTo || 'today'}` : `Last ${range} days`;

  const periodRequests = requests.filter((request) => inRange(request.createdAt));
  const periodOffers = offers.filter((offer) => inRange(offer.createdAt));
  const acceptedOffers = periodOffers.filter((offer) => offer.status === 'accepted');
  const value = acceptedOffers.reduce((total, offer) => total + (Number(offer.price) || 0), 0);
  const acceptedFor = (request) => (request.offers || []).find((offer) => offer.status === 'accepted');
  const shipments = requests.filter((request) => [...ACTIVE, 'delivered'].includes(request.status) && inRange(request.createdAt));
  const overdue = requests.filter((request) => {
    if (!ACTIVE.includes(request.status)) return false;
    const dates = shipmentDates(request, acceptedFor(request));
    return dates && daysUntil(dates.dueAt, now) < 0;
  });
  // Financial records: accepted orders by acceptance date (cancelled orders excluded).
  const financialRows = requests
    .filter((request) => request.status !== 'cancelled')
    .map((request) => {
      const accepted = acceptedFor(request);
      const dates = accepted && shipmentDates(request, accepted);
      return dates && inRange(dates.acceptedAt) ? { request, accepted, acceptedAt: dates.acceptedAt } : null;
    })
    .filter(Boolean)
    .sort((first, second) => time(second.acceptedAt) - time(first.acceptedAt))
    .map(({ request, accepted, acceptedAt }) => {
      const breakdown = offerBreakdown(accepted);
      const total = Number(breakdown.total) || 0;
      const fee = Number(breakdown.deliveryFee) || 0;
      const goods = Number(breakdown.subtotal ?? Math.max(total - fee, 0));
      return {
        cells: [isoDate(acceptedAt), `REQ-${request._id.slice(-6).toUpperCase()}`, request.customer?.name || '', accepted.provider?.name || '',
          request.product, request.quantity, goods.toFixed(2), fee.toFixed(2), total.toFixed(2), statusText(request.status)],
        goods,
        fee,
        total,
      };
    });
  const financialTotals = financialRows.reduce((sum, row) => ({ goods: sum.goods + row.goods, fee: sum.fee + row.fee, total: sum.total + row.total }), { goods: 0, fee: 0, total: 0 });
  const noOffers = requests.filter((request) => ['open', 'offers_received'].includes(request.status) && !request.offers?.length && now - time(request.createdAt) >= 3 * DAY);

  const providerRows = [...periodOffers.reduce((map, offer) => {
    const id = String(offer.provider?._id || offer.provider?.id || '');
    if (!id) return map;
    const row = map.get(id) || { name: offer.provider?.name || 'Cargo provider', offers: 0, accepted: 0, declined: 0, delivered: 0, value: 0 };
    row.offers += 1;
    if (offer.status === 'declined') row.declined += 1;
    if (offer.status === 'accepted') {
      row.accepted += 1;
      row.value += Number(offer.price) || 0;
      if (offer.request?.status === 'delivered') row.delivered += 1;
    }
    return map.set(id, row);
  }, new Map()).values()].sort((first, second) => second.value - first.value || second.offers - first.offers);

  const datasets = {
    requests: {
      label: 'Requests', icon: 'box',
      header: ['Reference', 'Created', 'Customer', 'Product', 'Quantity', 'Route', 'Method', 'Sent to', 'Status', 'Offers', 'Accepted provider', 'Accepted value (USD)', 'Delivery'],
      rows: periodRequests.map((request) => {
        const accepted = acceptedFor(request);
        return [`REQ-${request._id.slice(-6).toUpperCase()}`, isoDate(request.createdAt), request.customer?.name || '', request.product, request.quantity,
          `${request.sourceCountry} → ${request.destination}`, request.deliveryMethod || '', request.targetProvider?.name || 'Open', statusText(request.status),
          request.offers?.length || 0, accepted?.provider?.name || '', accepted ? (Number(accepted.price) || 0).toFixed(2) : '', dueText(request, accepted, now)];
      }),
    },
    offers: {
      label: 'Offers', icon: 'mail',
      header: ['Submitted', 'Provider', 'Customer', 'Request', 'Unit price (USD)', 'Delivery fee (USD)', 'Total (USD)', 'Delivery days', 'Offer status', 'Shipment'],
      rows: periodOffers.map((offer) => [isoDate(offer.createdAt), offer.provider?.name || '', offer.request?.customer?.name || '', offer.request?.product || '',
        offer.unitPrice ?? '', offer.deliveryFee ?? '', (Number(offer.price) || 0).toFixed(2), offer.deliveryDays, statusText(offer.status),
        offer.status === 'accepted' ? statusText(offer.request?.status) : '']),
    },
    shipments: {
      label: 'Shipments', icon: 'package',
      header: ['Reference', 'Product', 'Customer', 'Provider', 'Accepted', 'Expected', 'Status', 'Delivery'],
      rows: shipments.map((request) => {
        const accepted = acceptedFor(request);
        const dates = shipmentDates(request, accepted);
        return [`REQ-${request._id.slice(-6).toUpperCase()}`, request.product, request.customer?.name || '', accepted?.provider?.name || '',
          dates ? isoDate(dates.acceptedAt) : '', dates ? isoDate(dates.dueAt) : '', statusText(request.status), dueText(request, accepted, now)];
      }),
    },
    financial: {
      label: 'Financial records', icon: 'chart',
      header: ['Accepted', 'Reference', 'Customer', 'Provider', 'Product', 'Quantity', 'Goods value (USD)', 'Delivery fee (USD)', 'Total (USD)', 'Shipment status'],
      rows: financialRows.map((row) => row.cells),
      totals: ['Total', '', '', '', '', '', financialTotals.goods.toFixed(2), financialTotals.fee.toFixed(2), financialTotals.total.toFixed(2), ''],
    },
    providers: {
      label: 'Provider performance', icon: 'building',
      header: ['Provider', 'Offers', 'Accepted', 'Declined', 'Win rate', 'Delivered', 'Accepted value (USD)'],
      rows: providerRows.map((row) => [row.name, row.offers, row.accepted, row.declined, `${row.offers ? Math.round((row.accepted / row.offers) * 100) : 0}%`, row.delivered, row.value.toFixed(2)]),
    },
    users: {
      label: 'Users', icon: 'users',
      header: ['Name', 'Email', 'Phone', 'Role', 'Country', 'Verification', 'Joined'],
      rows: users.filter((user) => inRange(user.createdAt) || range === 'all').map((user) => [user.name, user.email, user.phone || '', ROLE_LABELS[user.role] || user.role, user.country,
        ['cargo_provider', 'individual_cargo'].includes(user.role) ? VERIFICATION_LABELS[user.verification?.status || 'unverified'] : '', isoDate(user.createdAt)]),
    },
  };
  const active = datasets[dataset];
  const withTotals = (set) => [set.header, ...set.rows, ...(set.totals && set.rows.length ? [set.totals] : [])];
  const stamp = new Date(now).toISOString().slice(0, 10);

  function exportDataset(key) {
    const set = datasets[key];
    download(`tayonx-${key}-${stamp}.csv`, withTotals(set));
  }

  function exportAll() {
    const summary = [
      ['Tayonx data export', rangeLabel, `Generated ${new Date(now).toLocaleString()}`],
      [],
      ['Metric', 'Value'],
      ['Requests', periodRequests.length], ['Offers', periodOffers.length], ['Accepted offers', acceptedOffers.length],
      ['Acceptance rate', `${periodOffers.length ? Math.round((acceptedOffers.length / periodOffers.length) * 100) : 0}%`],
      ['Accepted value (USD)', value.toFixed(2)], ['Financial records total (USD)', financialTotals.total.toFixed(2)], ['Delivered', periodRequests.filter((request) => request.status === 'delivered').length],
      ['Overdue shipments (now)', overdue.length], ['Requests without offers 3+ days (now)', noOffers.length],
    ];
    const sections = Object.values(datasets).flatMap((set) => [[], [set.label.toUpperCase()], ...withTotals(set)]);
    download(`tayonx-data-export-${stamp}.csv`, [...summary, ...sections]);
  }

  return (
    <div className="admin-reports analytics-dashboard">
      <section className="dashboard-card analytics-card reports-toolbar">
        <div>
          <h2>Data Exports</h2>
          <p>Download system data and financial records for {rangeLabel.toLowerCase()} as Excel-ready sheets, or save the page as PDF. Charts and platform metrics are on the Analytics page.</p>
        </div>
        <div className="reports-toolbar-actions">
          <label className="reports-range">
            <span className="sr-only">Date range</span>
            <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Date range">
              <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option><option value="custom">Custom range…</option>
            </select>
          </label>
          {range === 'custom' && <span className="reports-custom-range"><input type="date" aria-label="From date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /><span>–</span><input type="date" aria-label="To date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></span>}
          <button type="button" className="customer-outline-button" onClick={() => window.print()}><Icon name="file" size={14} />Save as PDF</button>
          <button type="button" className="primary-button" onClick={exportAll} disabled={loading}><Icon name="download" size={14} />Download all data (Excel)</button>
        </div>
      </section>

      <section className="dashboard-card analytics-card reports-dataset-card">
        <div className="reports-dataset-head">
          <div className="admin-request-tabs" role="tablist" aria-label="Export datasets">
            {Object.entries(datasets).map(([key, set]) => (
              <button type="button" role="tab" key={key} aria-selected={dataset === key} className={`admin-request-tab${dataset === key ? ' active' : ''}`} onClick={() => setDataset(key)}>
                <Icon name={set.icon} size={13} /><span>{set.label}</span><b>{set.rows.length}</b>
              </button>
            ))}
          </div>
          <button type="button" className="customer-outline-button" onClick={() => exportDataset(dataset)} disabled={!active.rows.length}><Icon name="download" size={14} />Download {active.label.toLowerCase()} (Excel)</button>
        </div>
        {dataset === 'users' && usersError && <p className="admin-inline-error" role="alert">{usersError}</p>}
        {active.rows.length ? (
          <div className="table-scroll">
            <table className="data-table analytics-table reports-table">
              <thead><tr>{active.header.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
              <tbody>{active.rows.slice(0, 100).map((row, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell === '' ? '—' : cell}</td>)}</tr>
              ))}</tbody>
            </table>
            {active.rows.length > 100 && <p className="analytics-empty">Showing the first 100 of {active.rows.length} rows — the download contains all of them.</p>}
          </div>
        ) : <p className="analytics-empty">{loading ? 'Loading data…' : `No ${active.label.toLowerCase()} in this date range.`}</p>}
      </section>
    </div>
  );
}
