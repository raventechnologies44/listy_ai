import { Link } from 'react-router-dom'

const values = [
  ['Innovation', 'Think differently'],
  ['Impact', 'Solve real problems'],
  ['Excellence', 'Strive for better'],
  ['Opportunity', 'Create possibilities'],
]

const capabilities = [
  ['AI Marketing', 'Create property descriptions, social content and campaign-ready copy faster.'],
  ['Property Management', 'Keep listings, photos, status and inventory organized in one workspace.'],
  ['Lead Management', 'Capture buyer records, pipeline stages, follow-ups and next actions.'],
  ['WhatsApp', 'Bring enquiries into the sales workflow and keep human approval in the loop.'],
  ['AI Matching', 'Find relevant properties for buyers using the information in their enquiry.'],
  ['Scheduling & Analytics', 'Plan viewings and follow-ups while monitoring real activity.'],
]

export function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero card">
        <div className="about-hero-copy">
          <span className="eyebrow">ABOUT LISTYAI</span>
          <h1>AI-powered real estate marketing and management.</h1>
          <p>
            ListyAI gives real estate agents one workspace to manage listings, market properties,
            organize enquiries, follow up with buyers, schedule activity and make better decisions with AI.
          </p>
          <div className="about-actions">
            <Link to="/dashboard" className="btn btn-blue">Back to dashboard</Link>
            <Link to="/dashboard/profile" className="btn">View account</Link>
          </div>
        </div>
        <div className="about-brand-card">
          <img src="/velora-logo.png" alt="VELORA" />
          <span>ListyAI is powered by VELORA.</span>
        </div>
      </section>

      <section className="about-section">
        <div className="section-heading">
          <span className="eyebrow">THE PLATFORM</span>
          <h2>Built around the agent's workflow.</h2>
          <p>From the first listing to the next buyer action, ListyAI keeps the work connected.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map(([title, description]) => (
            <article className="card capability-card" key={title}>
              <div className="capability-icon">✦</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-velora card">
        <div>
          <span className="eyebrow">VELORA</span>
          <h2>Visionary Enterprise for Leadership, Opportunity, Research, and Advancement.</h2>
          <p className="about-vision">“To build a future where technology transforms possibilities into meaningful progress.”</p>
        </div>
        <div className="values-grid">
          {values.map(([title, description]) => (
            <div key={title} className="value-card">
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
