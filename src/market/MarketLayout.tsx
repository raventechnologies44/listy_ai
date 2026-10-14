import { Link, Outlet } from 'react-router-dom'
import './market.css'

export function MarketLayout() {
  return (
    <div className="mk-page">
      <header className="mk-header">
        <div className="container mk-nav">
          <Link to="/market" className="mk-brand">
            <div className="brand-symbol small">L</div>
            <strong>Listy<span>Market</span></strong>
          </Link>
          <nav className="mk-links">
            <Link to="/market">Browse</Link>
            <Link to="/market/posts">Agent posts</Link>
            <Link to="/agents" className="mk-hide-sm">For agents</Link>
            <Link to="/login" className="btn btn-sm">Agent log in</Link>
          </nav>
        </div>
      </header>
      <main className="container mk-main">
        <Outlet />
      </main>
      <footer className="mk-footer">
        <div className="container">ListyMarket by ListyAI · Powered by VELORA</div>
      </footer>
    </div>
  )
}
