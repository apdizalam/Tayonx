import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/tayonx-logo.png';
import Icon from '../components/Icon.jsx';
import '../App.css';
import '../landing.css';

const dashboardPaths = { admin: '/admin/dashboard', customer: '/customer/dashboard', cargo_provider: '/cargo/dashboard', individual_cargo: '/cargo/dashboard' };

const NAV = [
  ['how-it-works', 'How it works'],
  ['features', 'Features'],
  ['providers', 'For cargo companies'],
  ['faq', 'FAQ'],
];

const STEPS = [
  ['box', 'Send a request', 'Describe the product, quantity, source country and destination, by sea or air. Send it to a verified cargo company you choose.'],
  ['mail', 'Compare offers', 'Cargo companies reply with a clear price per item, delivery fee, total and delivery time.'],
  ['check', 'Accept the best one', 'Accept the offer that fits your budget and timeline. The others are declined for you.'],
  ['ship', 'Track to delivery', 'Follow your order as it moves from in progress to purchased, in transit and delivered.'],
];

const LIFECYCLE = [
  ['clock', 'In progress', 'Offer accepted'],
  ['package', 'Purchased', 'Goods bought at source'],
  ['ship', 'In transit', 'On its way to you'],
  ['check', 'Delivered', 'Ready to receive'],
];

const FEATURES = [
  ['shield', 'Verified cargo companies', 'Companies and individual providers are reviewed with their documents before they can send offers.'],
  ['mail', 'Transparent offers', 'Every offer shows the goods price, delivery fee and total, so you compare like for like.'],
  ['ship', 'Live shipment tracking', 'A clear timeline for every order, updated by the cargo company that is shipping it.'],
  ['chat', 'Private business chat', 'Message the companies you work with directly. Close or re-open chats at any time.'],
  ['bell', 'Delivery alerts', 'Get notified about new offers, status changes and when your order is about to arrive.'],
  ['globe', 'Sea and air, many countries', 'Ship from China, Turkey, the UAE and more, to Somaliland and the wider region.'],
];

const PROVIDER_POINTS = [
  'Receive requests sent to your company and open requests from your country',
  'Send structured offers with price per item, delivery fee and delivery time',
  'Update each shipment as it is purchased, in transit and delivered',
  'See monthly earnings, completed orders and a CSV export in Reports & earnings',
];

const CUSTOMER_POINTS = [
  'Choose from verified cargo companies with public profiles',
  'Compare offers side by side before you commit',
  'Follow every order on one clear timeline',
  'Chat with the company handling your shipment',
];

const SAFETY = [
  ['shield', 'Document-checked providers', 'Cargo companies are verified by the Tayonx team before they can quote.'],
  ['lock', 'Business-only chat', 'You can only message companies you are actually doing business with, plus Tayonx support.'],
  ['headphones', 'Support & disputes', 'Report a conversation and the Tayonx team reviews it. Message history is kept for review.'],
];

const FAQ = [
  ['Who can send me offers?', 'Only cargo companies and individual providers that the Tayonx team has verified. You can also send a request directly to one company you choose.'],
  ['What does “Purchased” mean?', 'Many orders include buying the goods at the source. “Purchased” means your cargo company has bought them and is preparing to ship.'],
  ['How do I know when my order arrives?', 'Each order shows an expected delivery date. Tayonx alerts you when delivery is close, and the cargo company marks it as delivered.'],
  ['Can I talk to the cargo company?', 'Yes. Once you are doing business together you can chat directly in Tayonx, and you can always reach Tayonx support.'],
  ['I run a cargo company. How do I join?', 'Create a cargo company or individual provider account, upload your verification documents, and start sending offers once you are approved.'],
];

/** A small window frame for the step illustrations (a simplified Tayonx screen). */
function MiniWindow({ title, children }) {
  return (
    <div className="landing-mini" aria-hidden="true">
      <div className="landing-mini-bar"><i /><i /><i /><span>{title}</span></div>
      <div className="landing-mini-body">{children}</div>
    </div>
  );
}

/** Illustrations of the Tayonx screens behind each "How it works" step. */
function StepVisual({ step }) {
  if (step === 0) {
    return (
      <MiniWindow title="New request">
        <div className="mini-field"><small>Product</small><b>Solar panels</b></div>
        <div className="mini-row">
          <div className="mini-field"><small>Quantity</small><b>40 units</b></div>
          <div className="mini-field"><small>Route</small><b>China → Berbera</b></div>
        </div>
        <div className="mini-row mini-chips"><span className="active"><Icon name="ship" size={11} />Sea</span><span><Icon name="plane" size={11} />Air</span></div>
        <div className="mini-company"><span className="mini-avatar">BF</span><b>Berbera Freight</b><em><Icon name="shield" size={10} />Verified</em></div>
        <span className="mini-button">Send request</span>
      </MiniWindow>
    );
  }
  if (step === 1) {
    return (
      <MiniWindow title="Offers · 3">
        {[['BF', 'Berbera Freight', '18 days', '$2,500', true], ['SC', 'Shenzhen Cargo', '21 days', '$2,610'], ['HC', 'Horn Cargo Co', '14 days', '$2,780']].map(([initials, name, days, price, best]) => (
          <div key={name} className={`mini-offer${best ? ' best' : ''}`}>
            <span className="mini-avatar">{initials}</span>
            <span className="mini-offer-copy"><b>{name}</b><small>{days} · sea</small></span>
            <b>{price}</b>
          </div>
        ))}
      </MiniWindow>
    );
  }
  if (step === 2) {
    return (
      <MiniWindow title="Offer details">
        <div className="mini-company"><span className="mini-avatar">BF</span><b>Berbera Freight</b><em className="ok"><Icon name="check" size={10} />Accepted</em></div>
        <div className="mini-breakdown">
          <span><small>Goods (40 × $55)</small><b>$2,200</b></span>
          <span><small>Delivery fee</small><b>$300</b></span>
          <span className="total"><small>Total</small><b>$2,500</b></span>
        </div>
        <div className="mini-declined"><span>Shenzhen Cargo</span><em>Declined</em></div>
        <div className="mini-declined"><span>Horn Cargo Co</span><em>Declined</em></div>
      </MiniWindow>
    );
  }
  return (
    <MiniWindow title="Shipment REQ-8A340A">
      <div className="mini-track-head"><b>Solar panels</b><em>Due in 2 days</em></div>
      <ol className="mini-timeline">
        {[['clock', 'In progress', 'Mon'], ['package', 'Purchased', 'Wed'], ['ship', 'In transit', 'Today'], ['check', 'Delivered', '—']].map(([icon, label, when], index) => (
          <li key={label} className={index < 3 ? 'done' : ''}><span><Icon name={icon} size={10} /></span><b>{label}</b><small>{when}</small></li>
        ))}
      </ol>
    </MiniWindow>
  );
}

function readUser() {
  try {
    return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('user') || 'null') : null;
  } catch {
    return null;
  }
}

/**
 * Adds `is-visible` to [data-reveal] elements as they scroll into view (once).
 * IntersectionObserver does the work; a light scroll/resize check backs it up so content can
 * never stay hidden (e.g. in embedded or throttled views where observers fire late).
 */
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let pending = [...root.querySelectorAll('[data-reveal]')];
    const show = (item) => item.classList.add('is-visible');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      pending.forEach(show);
      return undefined;
    }
    // Content is only pre-hidden once this script runs, so it stays visible without JavaScript.
    root.classList.add('reveal-ready');

    let observer = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      pending.forEach((item) => observer.observe(item));
    }

    // Cheap (a couple of dozen rects), so it runs straight from scroll/resize without
    // requestAnimationFrame, which some throttled views pause.
    const check = () => {
      const limit = window.innerHeight * 0.94;
      pending = pending.filter((item) => {
        if (item.classList.contains('is-visible')) return false;
        if (item.getBoundingClientRect().top < limit) {
          show(item);
          return false;
        }
        return true;
      });
      if (!pending.length) stop();
    };
    function stop() {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    return () => {
      observer?.disconnect();
      stop();
    };
  }, [rootRef]);
}

export default function LandingPage() {
  const rootRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user] = useState(readUser);
  const dashboardPath = user ? dashboardPaths[user.role] : null;
  useReveal(rootRef);

  useEffect(() => {
    document.title = 'Tayonx | Buy and ship with verified cargo companies';
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="landing" ref={rootRef}>
      <header className={`landing-nav${scrolled ? ' scrolled' : ''}${menuOpen ? ' open' : ''}`}>
        <div className="landing-container landing-nav-inner">
          <Link className="landing-logo" to="/" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></Link>
          <nav className="landing-links" aria-label="Main">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}
          </nav>
          <div className="landing-nav-actions">
            {dashboardPath
              ? <Link className="landing-btn primary small" to={dashboardPath}>Go to dashboard<Icon name="arrow" size={15} /></Link>
              : <>
                <Link className="landing-btn ghost small" to="/login">Log in</Link>
                <Link className="landing-btn primary small" to="/register">Get started</Link>
              </>}
            <button type="button" className="landing-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="landing-mobile-menu">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}
            {!dashboardPath && <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>}
          </div>
        )}
      </header>

      <main>
        {/* ---- Hero ---- */}
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span aria-hidden="true" />Cargo marketplace for Somaliland and the region</p>
              <h1>Buy from abroad. Ship with verified cargo companies.</h1>
              <p className="landing-lead">
                Tayonx connects you with trusted cargo companies that buy and ship your goods from China, Turkey, the UAE and beyond.
                Compare clear offers, accept the best one, and follow your order all the way to delivery.
              </p>
              <div className="landing-cta-row">
                <Link className="landing-btn primary" to={dashboardPath || '/register'}>{dashboardPath ? 'Open my dashboard' : 'Request a shipment'}<Icon name="arrow" size={17} /></Link>
                {!dashboardPath && <Link className="landing-btn glass" to="/register?role=cargo_provider"><Icon name="building" size={17} />Join as a cargo company</Link>}
              </div>
              <ul className="landing-hero-points">
                <li><Icon name="shield" size={15} />Verified companies</li>
                <li><Icon name="ship" size={15} />Sea &amp; air</li>
                <li><Icon name="chat" size={15} />Direct chat</li>
              </ul>
            </div>

            <div className="landing-hero-visual" aria-hidden="true">
              <div className="landing-mock landing-mock-request">
                <div className="landing-mock-head">
                  <span className="landing-mock-tag">Example request</span>
                  <span className="landing-mock-status">3 offers</span>
                </div>
                <strong>Solar panels × 40 units</strong>
                <p className="landing-mock-route"><span>China</span><i /><span>Berbera</span><em><Icon name="ship" size={13} />Sea</em></p>
                <ul className="landing-mock-offers">
                  <li className="best"><span className="landing-mock-avatar">BF</span><span><b>Berbera Freight</b><small>18 days · fee $300</small></span><b>$2,500</b><em>Best value</em></li>
                  <li><span className="landing-mock-avatar">HC</span><span><b>Horn Cargo Co</b><small>14 days · fee $420</small></span><b>$2,780</b></li>
                  <li><span className="landing-mock-avatar">SC</span><span><b>Shenzhen Cargo</b><small>21 days · fee $260</small></span><b>$2,610</b></li>
                </ul>
              </div>
              <div className="landing-mock landing-mock-track">
                <div className="landing-mock-head"><span className="landing-mock-tag">Tracking</span><span className="landing-mock-due">Due in 2 days</span></div>
                <ol>
                  {LIFECYCLE.map(([icon, label], index) => (
                    <li key={label} className={index < 3 ? 'done' : ''}><span><Icon name={icon} size={13} /></span>{label}</li>
                  ))}
                </ol>
              </div>
              <div className="landing-mock landing-mock-chat">
                <span className="landing-mock-avatar">BF</span>
                <p><b>Berbera Freight</b>Your panels are in transit. Expected at Berbera on Friday.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section className="landing-section" id="how-it-works">
          <div className="landing-container">
            <header className="landing-section-head" data-reveal>
              <p className="landing-kicker">How it works</p>
              <h2>From request to your door in four steps</h2>
              <p>No more chasing quotes over phone calls and messages. One request, clear offers, and one place to follow your order.</p>
            </header>
            <ol className="landing-steps">
              {STEPS.map(([icon, title, text], index) => (
                <li key={title} data-reveal style={{ '--delay': `${index * 80}ms` }}>
                  <StepVisual step={index} />
                  <div className="landing-step-body">
                    <span className="landing-step-label"><span className="landing-step-icon"><Icon name={icon} size={14} /></span>Step {String(index + 1).padStart(2, '0')}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- Lifecycle ---- */}
        <section className="landing-section landing-lifecycle-section">
          <div className="landing-container landing-split">
            <div data-reveal>
              <p className="landing-kicker">Shipment tracking</p>
              <h2>Know exactly where your order is</h2>
              <p className="landing-muted">Every accepted order follows the same clear path. Your cargo company updates each stage, and Tayonx tells you when delivery is close or late.</p>
            </div>
            <ol className="landing-lifecycle" data-reveal>
              {LIFECYCLE.map(([icon, label, text]) => (
                <li key={label}>
                  <span className="landing-icon-tile"><Icon name={icon} size={18} /></span>
                  <span><b>{label}</b><small>{text}</small></span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- Features ---- */}
        <section className="landing-section" id="features">
          <div className="landing-container">
            <header className="landing-section-head" data-reveal>
              <p className="landing-kicker">Features</p>
              <h2>Everything you need to buy and ship with confidence</h2>
            </header>
            <div className="landing-feature-grid">
              {FEATURES.map(([icon, title, text], index) => (
                <article key={title} className="landing-card" data-reveal style={{ '--delay': `${(index % 3) * 80}ms` }}>
                  <span className="landing-icon-tile"><Icon name={icon} size={20} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Audiences ---- */}
        <section className="landing-section" id="providers">
          <div className="landing-container landing-audiences">
            <article className="landing-audience" data-reveal>
              <span className="landing-icon-tile"><Icon name="user" size={20} /></span>
              <p className="landing-kicker">For customers</p>
              <h2>Shop abroad without the guesswork</h2>
              <ul>{CUSTOMER_POINTS.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul>
              <Link className="landing-btn primary" to={dashboardPath || '/register'}>{dashboardPath ? 'Open my dashboard' : 'Create a customer account'}<Icon name="arrow" size={16} /></Link>
            </article>
            <article className="landing-audience provider" data-reveal style={{ '--delay': '100ms' }}>
              <span className="landing-icon-tile"><Icon name="building" size={20} /></span>
              <p className="landing-kicker">For cargo companies</p>
              <h2>Win more orders and run them in one place</h2>
              <ul>{PROVIDER_POINTS.map((point) => <li key={point}><Icon name="check" size={16} />{point}</li>)}</ul>
              <Link className="landing-btn glass" to="/register?role=cargo_provider">Join as a cargo company<Icon name="arrow" size={16} /></Link>
            </article>
          </div>
        </section>

        {/* ---- Trust & safety ---- */}
        <section className="landing-section">
          <div className="landing-container">
            <header className="landing-section-head" data-reveal>
              <p className="landing-kicker">Trust &amp; safety</p>
              <h2>Built for safe business between strangers</h2>
            </header>
            <div className="landing-safety">
              {SAFETY.map(([icon, title, text], index) => (
                <article key={title} data-reveal style={{ '--delay': `${index * 80}ms` }}>
                  <Icon name={icon} size={22} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section className="landing-section" id="faq">
          <div className="landing-container landing-faq-wrap">
            <header className="landing-section-head" data-reveal>
              <p className="landing-kicker">FAQ</p>
              <h2>Questions, answered</h2>
            </header>
            <div className="landing-faq" data-reveal>
              {FAQ.map(([question, answer], index) => (
                <details key={question} open={index === 0}>
                  <summary>{question}<Icon name="plus" size={18} /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Closing CTA ---- */}
        <section className="landing-section landing-final">
          <div className="landing-container">
            <div className="landing-final-card" data-reveal>
              <h2>Ready to ship your next order?</h2>
              <p>Create a free account, send your first request and compare offers from verified cargo companies.</p>
              <div className="landing-cta-row center">
                <Link className="landing-btn primary" to={dashboardPath || '/register'}>{dashboardPath ? 'Open my dashboard' : 'Get started free'}<Icon name="arrow" size={17} /></Link>
                {!dashboardPath && <Link className="landing-btn glass" to="/login">Log in</Link>}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <Link className="landing-logo" to="/" aria-label="Tayonx home"><img src={logo} alt="Tayonx" /></Link>
          <nav aria-label="Footer">
            {NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
            <Link to="/login">Log in</Link>
            <Link to="/register">Create account</Link>
          </nav>
          <p>© {new Date().getFullYear()} Tayonx · Connect · Request · Ship · Get it done</p>
        </div>
      </footer>
    </div>
  );
}
