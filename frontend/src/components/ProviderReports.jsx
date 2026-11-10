import { useState } from 'react';
import Icon from './Icon.jsx';
import { formatUsd } from '../lib/offerPricing.js';

// Cargo provider "Reports & earnings": monthly earnings (by the date the customer accepted the
// offer), revenue breakdown, shipment counts, full lifecycle breakdown, 6-month trend and an
// exportable list of the month's orders. Built only from the provider's own offers.

const ACTIVE = ['in_progress', 'purchased', 'shipping'];
const time = (value) => new Date(value || 0).getTime();

function acceptedAt(offer) {
  const entry = [...(offer.request?.statusHistory || [])].reverse().find((item) => item.status === 'in_progress');
  return time(entry?.at || offer.updatedAt || offer.createdAt);
}

function money(offer) {
  const total = Number(offer.price) || 0;
  const delivery = offer.deliveryFee === null || offer.deliveryFee === undefined ? 0 : Number(offer.deliveryFee) || 0;
  const goods = offer.subtotal ? Number(offer.subtotal) : total - delivery;
  return { total, goods, delivery };
}

function monthBounds(year, month) {
  return { from: new Date(year, month, 1).getTime(), to: new Date(year, month + 1, 1).getTime() };
}

const STAGE_LABEL = { in_progress: 'In progress', purchased: 'Purchased', shipping: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled' };

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename, rows) {
  const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProviderReports({ offers, loading, now, onViewShipments }) {
  const today = new Date(now);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const { from, to } = monthBounds(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const step = (delta) => setCursor(({ year, month }) => {
    const date = new Date(year, month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });

  const accepted = offers.filter((offer) => offer.status === 'accepted');
  const monthOrders = accepted.filter((offer) => acceptedAt(offer) >= from && acceptedAt(offer) < to)
    .sort((first, second) => acceptedAt(second) - acceptedAt(first));
  const earning = monthOrders.filter((offer) => offer.request?.status !== 'cancelled');
  const sum = (list, key) => list.reduce((total, offer) => total + money(offer)[key], 0);
  const earnings = sum(earning, 'total');
  const goods = sum(earning, 'goods');
  const deliveryFees = sum(earning, 'delivery');
  const deliveredValue = sum(earning.filter((offer) => offer.request?.status === 'delivered'), 'total');
  const inProgressValue = sum(earning.filter((offer) => ACTIVE.includes(offer.request?.status)), 'total');
  const averageOrder = earning.length ? earnings / earning.length : 0;

  const shipped = earning.filter((offer) => ['shipping', 'delivered'].includes(offer.request?.status)).length;
  const completed = earning.filter((offer) => offer.request?.status === 'delivered').length;
  const rejected = offers.filter((offer) => offer.status === 'declined' && time(offer.updatedAt) >= from && time(offer.updatedAt) < to).length;
  const inProgressNow = accepted.filter((offer) => ACTIVE.includes(offer.request?.status)).length;
  const pendingNow = offers.filter((offer) => offer.status === 'pending').length;

  // Lifecycle of every offer this provider has sent (all time).
  const lifecycle = [
    { label: 'Quote pending', value: offers.filter((offer) => offer.status === 'pending').length, color: 'var(--blue-300)' },
    { label: 'Offer declined', value: offers.filter((offer) => offer.status === 'declined').length, color: 'var(--neutral-400)' },
    ...['in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'].map((stage) => ({
      label: `Accepted · ${STAGE_LABEL[stage]}`,
      value: accepted.filter((offer) => offer.request?.status === stage).length,
      color: { in_progress: '#f5b544', purchased: '#e8901a', shipping: 'var(--amber-700)', delivered: 'var(--emerald-500)', cancelled: 'var(--red-600)' }[stage],
    })),
  ];
  const lifecycleMax = Math.max(1, ...lifecycle.map((row) => row.value));

  // Earnings for the 6 months ending at the selected month.
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(cursor.year, cursor.month - 5 + index, 1);
    const bounds = monthBounds(date.getFullYear(), date.getMonth());
    const value = accepted.filter((offer) => offer.request?.status !== 'cancelled' && acceptedAt(offer) >= bounds.from && acceptedAt(offer) < bounds.to)
      .reduce((total, offer) => total + money(offer).total, 0);
    return { label: date.toLocaleDateString(undefined, { month: 'short' }), value, current: index === 5 };
  });
  const trendMax = Math.max(1, ...trend.map((point) => point.value));

  function exportMonth() {
    downloadCsv(`tayonx-earnings-${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}.csv`, [
      ['Request', 'Customer', 'Route', 'Accepted', 'Shipment status', 'Goods (USD)', 'Delivery fee (USD)', 'Total (USD)'],
      ...monthOrders.map((offer) => {
        const value = money(offer);
        return [offer.request?.product, offer.request?.customer?.name || '', `${offer.request?.sourceCountry || ''} → ${offer.request?.destination || ''}`,
          new Date(acceptedAt(offer)).toISOString().slice(0, 10), STAGE_LABEL[offer.request?.status] || offer.request?.status, value.goods.toFixed(2), value.delivery.toFixed(2), value.total.toFixed(2)];
      }),
      [],
      ['Earnings (excl. cancelled)', '', '', '', '', goods.toFixed(2), deliveryFees.toFixed(2), earnings.toFixed(2)],
    ]);
  }

  const dash = (content) => (loading ? '—' : content);

  return (
    <div className="provider-reports analytics-dashboard">
      <section className="dashboard-card analytics-card reports-toolbar">
        <div>
          <h2>Reports &amp; earnings</h2>
          <p>Earnings are counted in the month the customer accepted your offer. Cancelled shipments are excluded.</p>
        </div>
        <div className="reports-toolbar-actions">
          <div className="reports-month-picker" role="group" aria-label="Choose month">
            <button type="button" className="icon-button" aria-label="Previous month" onClick={() => step(-1)}><Icon name="arrow" size={15} /></button>
            <strong>{monthLabel}</strong>
            <button type="button" className="icon-button" aria-label="Next month" disabled={isCurrentMonth} onClick={() => step(1)}><Icon name="arrow" size={15} /></button>
          </div>
          <button type="button" className="customer-outline-button" onClick={exportMonth} disabled={loading}><Icon name="download" size={14} />Export CSV</button>
        </div>
      </section>

      <div className="analytics-kpi-grid reports-kpi-grid">
        <article className="analytics-kpi tone-green"><span className="analytics-kpi-icon" aria-hidden="true"><Icon name="chart" size={17} /></span><span className="analytics-kpi-body"><span className="analytics-kpi-label">Earnings · {isCurrentMonth ? 'this month' : monthLabel}</span><strong>{dash(formatUsd(earnings))}</strong><small className="analytics-delta neutral">{earning.length} accepted order{earning.length === 1 ? '' : 's'}</small></span></article>
        <article className="analytics-kpi tone-green"><span className="analytics-kpi-icon" aria-hidden="true"><Icon name="check" size={17} /></span><span className="analytics-kpi-body"><span className="analytics-kpi-label">Delivered value</span><strong>{dash(formatUsd(deliveredValue))}</strong><small className="analytics-delta neutral">Completed orders</small></span></article>
        <article className="analytics-kpi tone-amber"><span className="analytics-kpi-icon" aria-hidden="true"><Icon name="package" size={17} /></span><span className="analytics-kpi-body"><span className="analytics-kpi-label">In-progress value</span><strong>{dash(formatUsd(inProgressValue))}</strong><small className="analytics-delta neutral">Not yet delivered</small></span></article>
        <article className="analytics-kpi tone-navy"><span className="analytics-kpi-icon" aria-hidden="true"><Icon name="star" size={17} /></span><span className="analytics-kpi-body"><span className="analytics-kpi-label">Average order</span><strong>{dash(formatUsd(averageOrder))}</strong><small className="analytics-delta neutral">Per accepted order</small></span></article>
      </div>

      <div className="analytics-grid analytics-grid-main">
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Earnings trend</h2><p>Accepted order value · last 6 months</p></div></header>
          <div className="reports-trend" role="img" aria-label="Earnings for the last six months">
            {trend.map((point) => (
              <div className={`reports-trend-bar${point.current ? ' current' : ''}`} key={point.label} title={`${point.label}: ${formatUsd(point.value)}`}>
                <span className="reports-trend-value">{point.value ? formatUsd(point.value) : '—'}</span>
                <i><b style={{ height: `${Math.max(point.value ? 4 : 0, (point.value / trendMax) * 100)}%` }} /></i>
                <span className="reports-trend-label">{point.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Revenue breakdown</h2><p>{monthLabel}</p></div></header>
          <ul className="reports-breakdown">
            <li><span>Goods (quantity × unit price)</span><b>{formatUsd(goods)}</b></li>
            <li><span>Delivery fees</span><b>{formatUsd(deliveryFees)}</b></li>
            <li className="total"><span>Total earnings</span><b>{formatUsd(earnings)}</b></li>
          </ul>
          <div className="analytics-split-bar reports-breakdown-bar" role="img" aria-label="Goods versus delivery fees">
            {earnings > 0 && <><b className="sea" style={{ width: `${(goods / earnings) * 100}%` }} /><b className="air" style={{ width: `${(deliveryFees / earnings) * 100}%` }} /></>}
          </div>
        </section>
      </div>

      <div className="reports-count-grid">
        {[
          ['Requests shipped', shipped, 'ship', 'In transit or delivered', 'blue'],
          ['Completed orders', completed, 'check', 'Delivered', 'green'],
          ['Rejected offers', rejected, 'close', 'Declined by customers', 'red'],
          ['In-progress shipments', inProgressNow, 'package', 'Right now', 'amber'],
          ['Pending quotes', pendingNow, 'mail', 'Awaiting customers', 'navy'],
        ].map(([label, value, icon, note, tone]) => (
          <article className={`reports-count tone-${tone}`} key={label}>
            <span aria-hidden="true"><Icon name={icon} size={15} /></span>
            <strong>{dash(value)}</strong>
            <small>{label}</small>
            <em>{note}</em>
          </article>
        ))}
      </div>

      <div className="analytics-grid analytics-grid-main">
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Orders · {monthLabel}</h2><p>Offers accepted this month and their shipment status</p></div><button type="button" className="link-button" onClick={onViewShipments}>Manage shipments<Icon name="arrow" size={13} /></button></header>
          {monthOrders.length ? (
            <div className="table-scroll">
              <table className="data-table analytics-table">
                <thead><tr><th>Request</th><th>Customer</th><th>Accepted</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>{monthOrders.map((offer) => (
                  <tr key={offer._id}>
                    <td><span className="table-primary">{offer.request?.product}</span><span className="table-secondary">{offer.request?.quantity}</span></td>
                    <td>{offer.request?.customer?.name || 'Customer'}</td>
                    <td className="table-date">{new Date(acceptedAt(offer)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                    <td><span className={`status-badge status-${(offer.request?.status || '').replaceAll('_', '-')}`}>{STAGE_LABEL[offer.request?.status] || offer.request?.status}</span></td>
                    <td className="analytics-money">{formatUsd(money(offer).total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="analytics-empty">{loading ? 'Loading orders…' : `No offers were accepted in ${monthLabel}.`}</p>}
        </section>
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Request lifecycle</h2><p>Every offer you have sent, by current stage</p></div></header>
          <ul className="analytics-barlist">
            {lifecycle.map((row) => (
              <li key={row.label}>
                <span className="analytics-barlist-label">{row.label}</span>
                <span className="analytics-barlist-value">{row.value}</span>
                <i><b style={{ width: `${(row.value / lifecycleMax) * 100}%`, background: row.color }} /></i>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
