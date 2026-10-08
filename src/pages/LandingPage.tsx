import { Link } from 'react-router-dom'

const features = [
  ['✦', 'AI Marketing', 'Generate property descriptions, social captions and campaign content.'],
  ['◌', 'WhatsApp', 'Turn enquiries into organized leads and suggested replies.'],
  ['□', 'Smart Scheduling', 'Keep viewings, follow-ups and marketing activity on track.'],
  ['▣', 'Property Management', 'Manage listings, status, photos and inventory in one place.'],
  ['◉', 'AI Matching', 'Connect buyer requirements with relevant properties faster.'],
  ['⌁', 'Real-Time Analytics', 'Track listings, leads, follow-ups and sales activity.'],
]

const plans = [
  ['Starter', 'US$15', 'For individual agents building a disciplined sales workflow.'],
  ['Professional', 'US$25', 'For agents who want the full AI and WhatsApp workflow.'],
  ['Agency', 'US$50', 'For teams managing shared operations and agency-wide performance.'],
]

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="container landing-nav">
          <div className="landing-brand">
            <div className="brand-symbol">L</div>
            <div>
              <strong>Listy<span>AI</span></strong>
              <small>Real estate, reimagined.</small>
            </div>
          </div>
          <nav className="landing-links">
            <a href="#features">Features</a>
            <a href="#plans">Plans</a>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="btn btn-blue">Get started</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero-pro">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">AI-POWERED REAL ESTATE OPERATING PLATFORM</span>
              <h1>Manage listings. Win leads. <span>Move faster.</span></h1>
              <p>
                ListyAI brings property management, AI marketing, buyer enquiries, follow-ups,
                scheduling and analytics into one professional workspace for real estate agents.
              </p>
              <div className="hero-actions">
<<<<<<< HEAD
                <Link to="/signup?plan=professional" className="btn btn-blue btn-lg">Start 5-day free trial</Link>
=======
                <Link to="/signup" className="btn btn-blue btn-lg">Start using ListyAI</Link>
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
                <Link to="/login" className="btn btn-lg">Sign in</Link>
              </div>
              <div className="hero-proof">
                <span>✓ Human-controlled AI</span>
                <span>✓ Built around your listings</span>
                <span>✓ Designed for daily use</span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-glow" />
              <div className="dashboard-preview">
                <div className="preview-sidebar">
                  <div className="preview-logo">L</div>
                  <span className="active" />
                  <span /><span /><span /><span /><span />
                </div>
                <div className="preview-main">
                  <div className="preview-top"><span>Good morning, Agent</span><i /></div>
                  <div className="preview-kpis"><b>12<span>Active listings</span></b><b>28<span>Leads</span></b><b>6<span>Follow-ups</span></b></div>
                  <div className="preview-chart"><div /><div /><div /><div /><div /><div /><div /></div>
                  <div className="preview-rows"><span /><span /><span /><span /></div>
                </div>
              </div>
              <div className="hero-floating-card"><strong>AI Matching</strong><span>Buyer matched to 3 listings</span></div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="container">
            <div className="section-heading centered">
              <span className="eyebrow">ONE WORKSPACE</span>
              <h2>Everything your property pipeline needs.</h2>
              <p>Designed to reduce the gaps between marketing, enquiries, follow-up and closing.</p>
            </div>
            <div className="feature-grid">
              {features.map(([icon, title, description]) => (
                <article className="feature-card card" key={title}>
                  <div className="feature-icon">{icon}</div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="landing-section plans-section">
          <div className="container">
            <div className="section-heading centered">
              <span className="eyebrow">SIMPLE PLANS</span>
              <h2>Choose the workspace that fits your operation.</h2>
            </div>
            <div className="pricing-grid">
              {plans.map(([name, price, description], index) => (
                <article className={`pricing-card card${index === 1 ? ' featured' : ''}`} key={name}>
                  {index === 1 && <span className="pricing-badge">Most features</span>}
                  <span className="pricing-name">{name}</span>
                  <strong className="pricing-price">{price}<small>/month</small></strong>
                  <p>{description}</p>
<<<<<<< HEAD
                  <Link to={`/signup?plan=${name.toLowerCase()}`} className={`btn ${index === 1 ? 'btn-blue' : ''}`}>Start free trial</Link>
=======
                  <Link to="/signup" className={`btn ${index === 1 ? 'btn-blue' : ''}`}>Get started</Link>
>>>>>>> c98eb7acb7cfce65c1b4c0831f03af377b3b7569
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <div className="landing-brand">
            <div className="brand-symbol">L</div>
            <div><strong>Listy<span>AI</span></strong><small>Powered by VELORA</small></div>
          </div>
          <span>Visionary Enterprise for Leadership, Opportunity, Research, and Advancement.</span>
        </div>
      </footer>
    </div>
  )
}
