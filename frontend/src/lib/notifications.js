// Smart notifications for every role, derived from the requests/offers each dashboard already
// loads (no extra API calls). The key date is a shipment's expected arrival:
//   accepted at (stage history, else the accepted offer's update time) + the offer's delivery days.
//
// Each notification: { id, tone: 'info'|'success'|'warning'|'danger', icon, title, text, at, action }
// `id` is stable so "seen" / "dismissed" state can be remembered per user in localStorage.

const DAY = 24 * 60 * 60 * 1000;
const RECENT = 14 * DAY; // milestones older than this are not shown
const ACTIVE = ['in_progress', 'purchased', 'shipping'];

const time = (value) => new Date(value || 0).getTime();
export const shortDate = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function stageAt(request, stage) {
  return [...(request?.statusHistory || [])].reverse().find((entry) => entry.status === stage)?.at || null;
}

/** When the shipment started (offer accepted) and when it is expected to arrive. */
export function shipmentDates(request, acceptedOffer) {
  if (!acceptedOffer) return null;
  const acceptedAt = stageAt(request, 'in_progress') || acceptedOffer.updatedAt || acceptedOffer.createdAt;
  if (!acceptedAt || !acceptedOffer.deliveryDays) return null;
  const dueAt = time(acceptedAt) + Number(acceptedOffer.deliveryDays) * DAY;
  return { acceptedAt: time(acceptedAt), dueAt };
}

/** Whole days from today until `dueAt` (negative = overdue). */
export function daysUntil(dueAt, now) {
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const due = new Date(dueAt); due.setHours(0, 0, 0, 0);
  return Math.round((due - startOfToday) / DAY);
}

function dueLabel(days) {
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

function recentMilestones(request, now) {
  return (request.statusHistory || []).filter((entry) => ['purchased', 'shipping', 'delivered'].includes(entry.status) && now - time(entry.at) <= RECENT);
}

function customerNotifications({ requests, now }) {
  const list = [];
  for (const request of requests) {
    const product = request.product;
    const accepted = (request.offers || []).find((offer) => offer.status === 'accepted');
    // New quotes waiting for a decision
    if (['open', 'offers_received'].includes(request.status)) {
      for (const offer of (request.offers || []).filter((item) => item.status === 'pending')) {
        list.push({ id: `quote:${offer._id}`, tone: 'info', icon: 'mail', title: `New quote for ${product}`, text: `${offer.provider?.name || 'A cargo provider'} sent a quote. Review and accept or decline it.`, at: time(offer.createdAt), action: { label: 'Review offer', section: 'offers', requestId: request._id } });
      }
    }
    // Shipment milestones from the provider
    for (const entry of recentMilestones(request, now)) {
      const text = {
        purchased: `${accepted?.provider?.name || 'Your cargo provider'} purchased your item.`,
        shipping: 'Your shipment is on its way.',
        delivered: 'Your shipment was delivered. Thank you for using Tayonx!',
      }[entry.status];
      list.push({ id: `stage:${request._id}:${entry.status}`, tone: entry.status === 'delivered' ? 'success' : 'info', icon: entry.status === 'delivered' ? 'check' : entry.status === 'shipping' ? 'ship' : 'package', title: { purchased: 'Item purchased', shipping: 'In transit', delivered: 'Delivered' }[entry.status] + ` · ${product}`, text, at: time(entry.at), action: { label: 'Track shipment', requestId: request._id } });
    }
    // Time to receive: arriving soon / overdue
    if (ACTIVE.includes(request.status)) {
      const dates = shipmentDates(request, accepted);
      if (dates) {
        const days = daysUntil(dates.dueAt, now);
        if (days < 0) {
          list.push({ id: `overdue:${request._id}:${shortDate(dates.dueAt)}`, tone: 'danger', icon: 'alert', title: `Shipment overdue · ${product}`, text: `Expected on ${shortDate(dates.dueAt)} (${dueLabel(days)}). Chat with ${accepted.provider?.name || 'your provider'} for an update.`, at: dates.dueAt, action: { label: 'View shipment', requestId: request._id } });
        } else if (days <= 2) {
          list.push({ id: `arriving:${request._id}:${days}`, tone: 'warning', icon: 'clock', title: `Get ready to receive · ${product}`, text: `Expected ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${shortDate(dates.dueAt)}`} at ${request.destination}. Make sure someone is available to receive it.`, at: now - days, action: { label: 'View shipment', requestId: request._id } });
        }
      }
    }
  }
  return list;
}

function providerNotifications({ requests, offers, now }) {
  const list = [];
  // Requests sent directly to this provider (company-first flow)
  for (const request of requests.filter((item) => item.targetProvider && ['open', 'offers_received'].includes(item.status))) {
    list.push({ id: `direct:${request._id}`, tone: 'info', icon: 'box', title: `New request for you · ${request.product}`, text: `${request.customer?.name || 'A customer'} sent you a request (${request.sourceCountry} → ${request.destination}). Send your quote.`, at: time(request.createdAt), action: { label: 'Send quote', section: 'opportunities' } });
  }
  for (const offer of offers) {
    const request = offer.request || {};
    const product = request.product;
    const customer = request.customer?.name || 'the customer';
    if (offer.status === 'declined' && now - time(offer.updatedAt) <= RECENT) {
      list.push({ id: `declined:${offer._id}`, tone: 'neutral', icon: 'close', title: `Offer declined · ${product}`, text: `${customer} declined your quote.`, at: time(offer.updatedAt), action: { label: 'My offers', section: 'offers' } });
    }
    if (offer.status !== 'accepted') continue;
    const dates = shipmentDates(request, offer);
    if (dates && now - dates.acceptedAt <= RECENT) {
      list.push({ id: `order:${offer._id}`, tone: 'success', icon: 'check', title: `New order · ${product}`, text: `${customer} accepted your quote. Purchase the item and update the shipment status.`, at: dates.acceptedAt, action: { label: 'Update status', section: 'offers', offerId: offer._id } });
    }
    if (!ACTIVE.includes(request.status) || !dates) continue;
    const days = daysUntil(dates.dueAt, now);
    // Dispatch milestone: still not purchased two days after acceptance
    if (request.status === 'in_progress' && now - dates.acceptedAt >= 2 * DAY) {
      list.push({ id: `dispatch:${offer._id}`, tone: 'warning', icon: 'package', title: `Dispatch reminder · ${product}`, text: `Accepted ${shortDate(dates.acceptedAt)} and not yet marked as purchased. Update the status so ${customer} can follow along.`, at: dates.acceptedAt + 2 * DAY, action: { label: 'Update status', section: 'offers', offerId: offer._id } });
    }
    if (days < 0) {
      list.push({ id: `overdue:${offer._id}:${shortDate(dates.dueAt)}`, tone: 'danger', icon: 'alert', title: `Delivery overdue · ${product}`, text: `It was due ${shortDate(dates.dueAt)} (${dueLabel(days)}). Update ${customer} and mark it delivered when it arrives.`, at: dates.dueAt, action: { label: 'Update status', section: 'offers', offerId: offer._id } });
    } else if (days <= 2) {
      list.push({ id: `due:${offer._id}:${days}`, tone: 'warning', icon: 'clock', title: `Delivery ${dueLabel(days)} · ${product}`, text: `${customer} expects it ${days === 0 ? 'today' : `by ${shortDate(dates.dueAt)}`} at ${request.destination}.`, at: now - days, action: { label: 'Update status', section: 'offers', offerId: offer._id } });
    }
  }
  return list;
}

function adminNotifications({ requests, now, pendingVerifications = 0 }) {
  const list = [];
  if (pendingVerifications > 0) {
    list.push({ id: `verifications:${pendingVerifications}`, tone: 'info', icon: 'shield', title: `${pendingVerifications} verification${pendingVerifications === 1 ? '' : 's'} waiting`, text: 'Cargo providers are waiting for document review.', at: now, action: { label: 'Review', section: 'verifications' } });
  }
  for (const request of requests) {
    const accepted = (request.offers || []).find((offer) => offer.status === 'accepted');
    const provider = accepted?.provider?.name || 'the cargo provider';
    const customer = request.customer?.name || 'Customer';
    if (ACTIVE.includes(request.status)) {
      const dates = shipmentDates(request, accepted);
      if (!dates) continue;
      const days = daysUntil(dates.dueAt, now);
      if (days < 0) {
        list.push({ id: `overdue:${request._id}:${shortDate(dates.dueAt)}`, tone: 'danger', icon: 'alert', title: `Overdue shipment · ${request.product}`, text: `${customer}'s shipment with ${provider} was due ${shortDate(dates.dueAt)} (${dueLabel(days)}). Coordinate with the provider.`, at: dates.dueAt, action: { label: 'View request', requestId: request._id } });
      } else if (days <= 1) {
        list.push({ id: `due:${request._id}:${days}`, tone: 'warning', icon: 'clock', title: `Delivery ${dueLabel(days)} · ${request.product}`, text: `${provider} → ${customer} (${request.destination}).`, at: now - days, action: { label: 'View request', requestId: request._id } });
      }
    } else if (['open', 'offers_received'].includes(request.status)) {
      const waiting = Math.floor((now - time(request.createdAt)) / DAY);
      if (!request.offers?.length && waiting >= 3) {
        list.push({ id: `nooffers:${request._id}:${waiting >= 7 ? 7 : 3}`, tone: 'warning', icon: 'box', title: `No offers after ${waiting} days · ${request.product}`, text: `${customer}'s request (${request.sourceCountry} → ${request.destination}) has no quotes yet${request.targetProvider ? ` from ${request.targetProvider.name}` : ''}.`, at: time(request.createdAt) + 3 * DAY, action: { label: 'View request', requestId: request._id } });
      }
    }
  }
  return list;
}

const TONE_RANK = { danger: 0, warning: 1, info: 2, success: 3, neutral: 4 };

/** Notifications for a role, most urgent first, then newest. */
export function buildNotifications({ role, requests = [], offers = [], now = Date.now(), pendingVerifications = 0 }) {
  const list = role === 'customer' ? customerNotifications({ requests, now })
    : role === 'provider' ? providerNotifications({ requests, offers, now })
      : role === 'admin' ? adminNotifications({ requests, now, pendingVerifications })
        : [];
  return list.sort((first, second) => (TONE_RANK[first.tone] - TONE_RANK[second.tone]) || (second.at - first.at));
}

// Per-user "seen" and "dismissed" ids (a browser convenience only; nothing is sent to the server).
function storageKey(userId, kind) {
  return `tayonx:notifications:${kind}:${userId}`;
}

export function readIds(userId, kind) {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey(userId, kind)) || '[]'));
  } catch {
    return new Set();
  }
}

export function writeIds(userId, kind, ids) {
  try {
    localStorage.setItem(storageKey(userId, kind), JSON.stringify([...ids].slice(-500)));
  } catch {
    // Storage may be unavailable (private mode); notifications still work for this session.
  }
}
