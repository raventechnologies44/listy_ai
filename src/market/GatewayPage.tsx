import { Link } from 'react-router-dom'
import './market.css'

export function GatewayPage() {
  return (
    <div className="gw-page">
      <div className="gw-wrap">
        <div className="gw-brand">
          <div className="brand-symbol">L</div>
          <strong>Listy<span>AI</span></strong>
        </div>
        <h1>Who are you today?</h1>
        <p className="muted">Real estate agents run their business in ListyAI. Buyers and renters browse live properties on ListyMarket.</p>
        <div className="gw-choices">
          <Link to="/agents" className="gw-choice primary">
            <strong>I'm an agent</strong>
            <span>Manage listings, enquiries and follow-ups. Publish to ListyMarket.</span>
          </Link>
          <Link to="/market" className="gw-choice">
            <strong>I'm a customer</strong>
            <span>Browse properties for sale and rent, or tell us what you need.</span>
          </Link>
        </div>
        <div className="gw-foot muted">Powered by VELORA</div>
      </div>
    </div>
  )
}
