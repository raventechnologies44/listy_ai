import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useProperties } from '../hooks/useProperties'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { StatusBadge } from '../components/StatusBadge'
import { formatCurrency } from '../lib/format'
import {
  LISTING_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type ListingType,
  type PropertyStatus,
  type PropertyType,
} from '../types/database'

export function PropertiesPage() {
  const { user } = useAuth()
  const { properties, loading, error } = useProperties(user?.id)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<PropertyType | ''>('')
  const [listingFilter, setListingFilter] = useState<ListingType | ''>('')
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return properties.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (typeFilter && p.property_type !== typeFilter) return false
      if (listingFilter && p.listing_type !== listingFilter) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [properties, search, statusFilter, typeFilter, listingFilter])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          Properties
        </h2>
        <Link to="/dashboard/properties/new" className="btn btn-blue">
          Add property
        </Link>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="card pad filters">
        <div className="field">
          <label className="label" htmlFor="search">
            Search
          </label>
          <input
            id="search"
            className="input"
            placeholder="Title, location, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PropertyStatus | '')}
          >
            <option value="">All statuses</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="ptype">
            Type
          </label>
          <select
            id="ptype"
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PropertyType | '')}
          >
            <option value="">All types</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="listing">
            Listing
          </label>
          <select
            id="listing"
            className="select"
            value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value as ListingType | '')}
          >
            <option value="">Sale & rent</option>
            {LISTING_TYPES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '0 0 auto' }}>
          <label className="label">View</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn${view === 'cards' ? ' btn-blue' : ''}`}
              onClick={() => setView('cards')}
            >
              Cards
            </button>
            <button
              type="button"
              className={`btn${view === 'table' ? ' btn-blue' : ''}`}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty-state">
          <h3>{properties.length === 0 ? 'No properties yet' : 'No matches'}</h3>
          <p className="muted">
            {properties.length === 0
              ? 'Create your first property listing to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {properties.length === 0 && (
            <Link to="/dashboard/properties/new" className="btn btn-blue">
              Add property
            </Link>
          )}
        </div>
      ) : view === 'cards' ? (
        <div className="property-grid">
          {filtered.map((p) => (
            <Link key={p.id} to={`/dashboard/properties/${p.id}`} className="card property-card">
              <div
                className="property-card-image"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                View photos →
              </div>
              <div className="property-card-body">
                <h3 className="property-card-title">{p.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {p.location}
                </p>
                <p style={{ margin: 0, fontWeight: 900, color: 'var(--heading)' }}>
                  {formatCurrency(Number(p.price), p.listing_type)}
                </p>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Location</th>
                <th>Type</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 800, color: 'var(--heading)' }}>{p.title}</td>
                  <td>{p.location}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.property_type}</td>
                  <td>{formatCurrency(Number(p.price), p.listing_type)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    <Link to={`/dashboard/properties/${p.id}`} className="btn btn-ghost" style={{ fontSize: 13 }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
