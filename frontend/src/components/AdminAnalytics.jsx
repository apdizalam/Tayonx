import Icon from './Icon.jsx';
import { formatUsd } from '../lib/offerPricing.js';

// Admin analytics: KPI cards with period-over-period change, an activity chart, status mix,
// shipment funnel, source countries, delivery methods and top cargo providers.
// All figures come from the requests/offers the admin dashboard already loads; charts are
// plain SVG so no chart library is needed.

const DAY = 24 * 60 * 60 * 1000;
const STATUS_ORDER = ['open', 'offers_received', 'in_progress', 'purchased', 'shipping', 'delivered', 'cancelled'];
const STATUS_META = {
  open: { label: 'Open', color: 'var(--blue-300)' },
  offers_received: { label: 'Offers received', color: 'var(--blue-500)' },
  in_progress: { label: 'In progress', color: '#f5b544' },
  purchased: { label: 'Purchased', color: '#e8901a' },
  shipping: { label: 'In transit', color: 'var(--amber-700)' },
  delivered: { label: 'Delivered', color: 'var(--emerald-500)' },
  cancelled: { label: 'Cancelled', color: 'var(--red-600)' },
};

const time = (value) => new Date(value || 0).getTime();
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const acceptedValue = (offers) => offers.filter((offer) => offer.status === 'accepted').reduce((sum, offer) => sum + (Number(offer.price) || 0), 0);

/** Splits the period into chart buckets: days for 7/30 days, months for "All time". */
function buildBuckets(period, rangeStart, now, requests, offers) {
  if (period === 'All time') {
    const first = Math.min(now, ...requests.map((request) => time(request.createdAt)), ...offers.map((offer) => time(offer.createdAt)));
    const start = new Date(first);
    const months = [];
    for (let date = new Date(start.getFullYear(), start.getMonth(), 1); date.getTime() <= now; date = new Date(date.getFullYear(), date.getMonth() + 1, 1)) {
      months.push({ from: date.getTime(), to: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(), label: date.toLocaleDateString(undefined, { month: 'short' }) });
    }
    return months.slice(-12);
  }
  const days = period === '7 days' ? 7 : 30;
  const today = new Date(now);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime();
  return Array.from({ length: days }, (_, index) => {
    const from = end - (days - index) * DAY;
    return { from, to: from + DAY, label: new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  });
}

/** Axis top as 4 × a "nice" whole step (1, 2, 5, 10, 20, …) so every gridline is a round number. */
function niceAxis(value) {
  const rough = Math.max(1, value) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough);
  const wholeStep = Math.max(1, Math.ceil(step));
  return { max: wholeStep * 4, step: wholeStep };
}

/** Change vs the previous period of the same length, e.g. "+3 vs prev." */
function Delta({ current, previous, invert = false, suffix = '', format = (value) => value }) {
  if (previous === null) return <small className="analytics-delta neutral">All recorded activity</small>;
  const diff = current - previous;
  if (!diff) return <small className="analytics-delta neutral">Same as prev. period</small>;
  const good = invert ? diff < 0 : diff > 0;
  const amount = format(Math.abs(Number.isInteger(diff) ? diff : Number(diff.toFixed(1))));
  return <small className={`analytics-delta ${good ? 'up' : 'down'}`} title="Compared with the previous period of the same length"><Icon name="arrow" size={11} />{diff > 0 ? '+' : '−'}{amount}{suffix} vs prev.</small>;
}

function KpiCard({ icon, tone, label, value, children }) {
  return (
    <article className={`analytics-kpi tone-${tone}`}>
      <span className="analytics-kpi-icon" aria-hidden="true"><Icon name={icon} size={17} /></span>
      <span className="analytics-kpi-body">
        <span className="analytics-kpi-label">{label}</span>
        <strong>{value}</strong>
        {children}
      </span>
    </article>
  );
}

function ActivityChart({ buckets }) {
  const W = 680; const H = 230; const pad = { l: 34, r: 10, t: 12, b: 28 };
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const { max, step: tickStep } = niceAxis(Math.max(1, ...buckets.flatMap((bucket) => [bucket.requests, bucket.offers])));
  const step = iw / Math.max(1, buckets.length);
  const barWidth = Math.max(2, Math.min(14, step * 0.32));
  const y = (value) => pad.t + ih - (value / max) * ih;
  const labelEvery = Math.ceil(buckets.length / 8);
  const ticks = [0, 1, 2, 3, 4].map((index) => index * tickStep);
  const total = buckets.reduce((sum, bucket) => sum + bucket.requests + bucket.offers, 0);

  return (
    <svg className="analytics-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Requests and offers per ${buckets.length > 12 || buckets.length === 7 ? 'day' : 'month'}`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} className="analytics-gridline" />
          <text x={pad.l - 8} y={y(tick) + 4} textAnchor="end" className="analytics-axis">{tick}</text>
        </g>
      ))}
      {buckets.map((bucket, index) => {
        const cx = pad.l + step * index + step / 2;
        return (
          <g key={bucket.from}>
            <rect x={cx - barWidth - 1} y={y(bucket.requests)} width={barWidth} height={pad.t + ih - y(bucket.requests)} rx="2" className="analytics-bar requests"><title>{`${bucket.label}: ${bucket.requests} request${bucket.requests === 1 ? '' : 's'}`}</title></rect>
            <rect x={cx + 1} y={y(bucket.offers)} width={barWidth} height={pad.t + ih - y(bucket.offers)} rx="2" className="analytics-bar offers"><title>{`${bucket.label}: ${bucket.offers} offer${bucket.offers === 1 ? '' : 's'}`}</title></rect>
            {index % labelEvery === 0 && <text x={cx} y={H - 8} textAnchor="middle" className="analytics-axis">{bucket.label}</text>}
          </g>
        );
      })}
      {!total && <text x={W / 2} y={H / 2} textAnchor="middle" className="analytics-empty-text">No activity in this period</text>}
    </svg>
  );
}

function StatusDonut({ counts, total }) {
  const radius = 54; const circumference = 2 * Math.PI * radius;
  // Each segment starts where the previous one ended.
  const segments = counts.filter((item) => item.count).reduce((list, item) => {
    const start = list.length ? list.at(-1).start + list.at(-1).length : 0;
    return [...list, { ...item, start, length: total ? (item.count / total) * circumference : 0 }];
  }, []);
  return (
    <div className="analytics-donut-wrap">
      <svg className="analytics-donut" viewBox="0 0 140 140" role="img" aria-label="Requests by status">
        <circle cx="70" cy="70" r={radius} className="analytics-donut-track" />
        {total > 0 && segments.map((item) => (
          <circle key={item.status} cx="70" cy="70" r={radius} stroke={STATUS_META[item.status].color} strokeDasharray={`${item.length} ${circumference - item.length}`} strokeDashoffset={-item.start} className="analytics-donut-segment"><title>{`${STATUS_META[item.status].label}: ${item.count}`}</title></circle>
        ))}
        <text x="70" y="66" textAnchor="middle" className="analytics-donut-value">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="analytics-donut-label">requests</text>
      </svg>
      <ul className="analytics-legend">
        {counts.map((item) => (
          <li key={item.status} className={item.count ? '' : 'muted'}>
            <i style={{ background: STATUS_META[item.status].color }} />
            <span>{STATUS_META[item.status].label}</span>
            <b>{item.count}</b>
            <small>{pct(item.count, total)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarList({ rows, empty, format = (value) => value }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="analytics-empty">{empty}</p>;
  return (
    <ul className="analytics-barlist">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="analytics-barlist-label">{row.label}</span>
          <span className="analytics-barlist-value">{format(row.value)}{row.note && <small>{row.note}</small>}</span>
          <i><b style={{ width: `${(row.value / max) * 100}%`, background: row.color }} /></i>
        </li>
      ))}
    </ul>
  );
}

export default function AdminAnalytics({ requests, offers, period, rangeStart, now, loading }) {
  const inRange = (item, from, to) => time(item.createdAt) >= from && time(item.createdAt) < to;
  const periodRequests = requests.filter((request) => time(request.createdAt) >= rangeStart);
  const periodOffers = offers.filter((offer) => time(offer.createdAt) >= rangeStart);
  const span = now - rangeStart;
  const hasPrevious = period !== 'All time';
  const previousRequests = hasPrevious ? requests.filter((request) => inRange(request, rangeStart - span, rangeStart)) : [];
  const previousOffers = hasPrevious ? offers.filter((offer) => inRange(offer, rangeStart - span, rangeStart)) : [];

  const accepted = periodOffers.filter((offer) => offer.status === 'accepted');
  const acceptanceRate = pct(accepted.length, periodOffers.length);
  const previousAcceptance = pct(previousOffers.filter((offer) => offer.status === 'accepted').length, previousOffers.length);
  const delivered = periodRequests.filter((request) => request.status === 'delivered').length;
  const quotesPerRequest = periodRequests.length ? periodOffers.length / periodRequests.length : 0;
  const previousQuotes = previousRequests.length ? previousOffers.length / previousRequests.length : 0;
  const value = acceptedValue(periodOffers);

  const buckets = buildBuckets(period, rangeStart, now, periodRequests, periodOffers).map((bucket) => ({
    ...bucket,
    requests: periodRequests.filter((request) => inRange(request, bucket.from, bucket.to)).length,
    offers: periodOffers.filter((offer) => inRange(offer, bucket.from, bucket.to)).length,
  }));
  const statusCounts = STATUS_ORDER.map((status) => ({ status, count: periodRequests.filter((request) => request.status === status).length }));

  const withOffers = periodRequests.filter((request) => request.offers?.length).length;
  const acceptedRequests = periodRequests.filter((request) => ['in_progress', 'purchased', 'shipping', 'delivered'].includes(request.status)).length;
  const funnel = [
    { label: 'Requests posted', value: periodRequests.length, color: 'var(--navy-700)' },
    { label: 'Received offers', value: withOffers, color: 'var(--blue-500)', note: `${pct(withOffers, periodRequests.length)}%` },
    { label: 'Offer accepted', value: acceptedRequests, color: '#e8901a', note: `${pct(acceptedRequests, periodRequests.length)}%` },
    { label: 'Delivered', value: delivered, color: 'var(--emerald-500)', note: `${pct(delivered, periodRequests.length)}%` },
  ];

  const countryCounts = [...periodRequests.reduce((map, request) => map.set(request.sourceCountry || 'Unknown', (map.get(request.sourceCountry || 'Unknown') || 0) + 1), new Map())]
    .map(([label, count]) => ({ label, value: count, note: `${pct(count, periodRequests.length)}%` }))
    .sort((first, second) => second.value - first.value).slice(0, 6);

  const sea = periodRequests.filter((request) => request.deliveryMethod === 'sea').length;
  const air = periodRequests.filter((request) => request.deliveryMethod === 'air').length;
  const unset = periodRequests.length - sea - air;

  const providers = [...periodOffers.reduce((map, offer) => {
    const id = String(offer.provider?._id || offer.provider?.id || '');
    if (!id) return map;
    const row = map.get(id) || { id, name: offer.provider?.name || 'Cargo provider', offers: 0, accepted: 0, value: 0 };
    row.offers += 1;
    if (offer.status === 'accepted') { row.accepted += 1; row.value += Number(offer.price) || 0; }
    return map.set(id, row);
  }, new Map()).values()].sort((first, second) => second.value - first.value || second.accepted - first.accepted || second.offers - first.offers).slice(0, 6);

  const dash = (content) => (loading ? '—' : content);

  return (
    <div className="admin-analytics-view analytics-dashboard">
      <div className="analytics-kpi-grid">
        <KpiCard icon="box" tone="blue" label="Requests posted" value={dash(periodRequests.length)}><Delta current={periodRequests.length} previous={hasPrevious ? previousRequests.length : null} /></KpiCard>
        <KpiCard icon="mail" tone="blue" label="Offers submitted" value={dash(periodOffers.length)}><Delta current={periodOffers.length} previous={hasPrevious ? previousOffers.length : null} /></KpiCard>
        <KpiCard icon="check" tone="green" label="Acceptance rate" value={dash(`${acceptanceRate}%`)}><Delta current={acceptanceRate} previous={hasPrevious ? previousAcceptance : null} suffix=" pts" /></KpiCard>
        <KpiCard icon="chart" tone="green" label="Accepted offer value" value={dash(formatUsd(value))}><Delta current={Math.round(value)} previous={hasPrevious ? Math.round(acceptedValue(previousOffers)) : null} format={formatUsd} /></KpiCard>
        <KpiCard icon="package" tone="amber" label="Delivered shipments" value={dash(delivered)}><small className="analytics-delta neutral">{pct(delivered, periodRequests.length)}% of requests</small></KpiCard>
        <KpiCard icon="star" tone="navy" label="Quotes per request" value={dash(quotesPerRequest.toFixed(1))}><Delta current={Number(quotesPerRequest.toFixed(1))} previous={hasPrevious ? Number(previousQuotes.toFixed(1)) : null} /></KpiCard>
      </div>

      <div className="analytics-grid analytics-grid-main">
        <section className="dashboard-card analytics-card analytics-card-wide">
          <header className="analytics-card-head">
            <div><h2>Marketplace activity</h2><p>{period === 'All time' ? 'Monthly' : 'Daily'} requests and offers · {period.toLowerCase()}</p></div>
            <span className="analytics-legend-inline"><span><i className="requests" />Requests</span><span><i className="offers" />Offers</span></span>
          </header>
          {loading ? <p className="analytics-empty">Loading activity…</p> : <ActivityChart buckets={buckets} />}
        </section>
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Request status</h2><p>Where every request stands now</p></div></header>
          {loading ? <p className="analytics-empty">Loading…</p> : <StatusDonut counts={statusCounts} total={periodRequests.length} />}
        </section>
      </div>

      <div className="analytics-grid analytics-grid-three">
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Shipment funnel</h2><p>From request to delivery</p></div></header>
          <BarList rows={funnel} empty="No requests in this period." />
        </section>
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Top source countries</h2><p>Where goods are shipped from</p></div></header>
          <BarList rows={countryCounts.map((row) => ({ ...row, color: 'var(--blue-500)' }))} empty="No source country data in this period." />
        </section>
        <section className="dashboard-card analytics-card">
          <header className="analytics-card-head"><div><h2>Delivery method</h2><p>How customers want to ship</p></div></header>
          {periodRequests.length ? (
            <div className="analytics-split">
              <div className="analytics-split-bar" role="img" aria-label={`Sea ${sea}, air ${air}${unset ? `, not set ${unset}` : ''}`}>
                {sea > 0 && <b className="sea" style={{ width: `${pct(sea, periodRequests.length)}%` }} />}
                {air > 0 && <b className="air" style={{ width: `${pct(air, periodRequests.length)}%` }} />}
                {unset > 0 && <b className="unset" style={{ width: `${pct(unset, periodRequests.length)}%` }} />}
              </div>
              <ul className="analytics-split-legend">
                <li><i className="sea" /><Icon name="ship" size={14} /><span>Sea freight</span><b>{sea}</b><small>{pct(sea, periodRequests.length)}%</small></li>
                <li><i className="air" /><Icon name="plane" size={14} /><span>Air freight</span><b>{air}</b><small>{pct(air, periodRequests.length)}%</small></li>
                {unset > 0 && <li><i className="unset" /><Icon name="box" size={14} /><span>Not specified</span><b>{unset}</b><small>{pct(unset, periodRequests.length)}%</small></li>}
              </ul>
            </div>
          ) : <p className="analytics-empty">No requests in this period.</p>}
        </section>
      </div>

      <section className="dashboard-card analytics-card">
        <header className="analytics-card-head"><div><h2>Top cargo providers</h2><p>Ranked by accepted offer value in this period</p></div></header>
        {providers.length ? (
          <div className="table-scroll">
            <table className="data-table analytics-table">
              <thead><tr><th>Provider</th><th>Offers sent</th><th>Accepted</th><th>Win rate</th><th>Accepted value</th></tr></thead>
              <tbody>{providers.map((provider, index) => (
                <tr key={provider.id}>
                  <td><span className="analytics-provider"><span className="analytics-rank">{index + 1}</span><span className="table-primary">{provider.name}</span></span></td>
                  <td>{provider.offers}</td>
                  <td>{provider.accepted}</td>
                  <td><span className="analytics-winrate"><i><b style={{ width: `${pct(provider.accepted, provider.offers)}%` }} /></i>{pct(provider.accepted, provider.offers)}%</span></td>
                  <td className="analytics-money">{formatUsd(provider.value)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="analytics-empty">No offers in this period.</p>}
      </section>
    </div>
  );
}
