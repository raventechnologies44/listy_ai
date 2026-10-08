import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { canCreateProperty, getPlan, hasActivePlanAccess, PLAN_CONFIG } from '../lib/plans'
import { createProperty, updateProperty, useProperty, useProperties } from '../hooks/useProperties'
import { LoadingSpinner } from '../components/LoadingSpinner'
import {
  LISTING_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type ListingType,
  type PropertyStatus,
  type PropertyType,
} from '../types/database'

const emptyForm = {
  title: '',
  description: '',
  property_type: 'house' as PropertyType,
  listing_type: 'sale' as ListingType,
  price: '',
  location: '',
  bedrooms: '',
  bathrooms: '',
  size: '',
  features: '',
  status: 'available' as PropertyStatus,
}

export function PropertyFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { property, loading, error: loadError } = useProperty(id, user?.id)
  const { properties } = useProperties(user?.id)

  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!property) return
    setForm({
      title: property.title,
      description: property.description ?? '',
      property_type: property.property_type,
      listing_type: property.listing_type,
      price: String(property.price),
      location: property.location,
      bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
      bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
      size: property.size != null ? String(property.size) : '',
      features: (property.features ?? []).join(', '),
      status: property.status,
    })
  }, [property])

  if (isEdit && loading) return <LoadingSpinner />

  if (isEdit && !loading && !property && !loadError) {
    return (
      <div className="card pad empty-state">
        <h3>Property not found</h3>
        <Link to="/dashboard/properties" className="btn">
          Back to properties
        </Link>
      </div>
    )
  }

  function parseFeatures(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSubmitting(true)

    const price = Number(form.price)
    if (!form.title.trim() || !form.location.trim() || Number.isNaN(price) || price < 0) {
      setSubmitting(false)
      setError('Title, location, and a valid price are required.')
      return
    }

    if (!isEdit) {
      if (!hasActivePlanAccess(profile)) {
        setSubmitting(false)
        setError('Your free trial has ended. Choose a plan in Billing & payments to continue adding listings.')
        return
      }
      const plan = getPlan(profile)
      const activeCount = properties.filter((item) => ['available', 'viewing', 'negotiation'].includes(item.status)).length
      if (!canCreateProperty(plan, activeCount)) {
        setSubmitting(false)
        const limit = PLAN_CONFIG[plan].propertyLimit
        setError(`Your ${PLAN_CONFIG[plan].name} plan allows up to ${limit} active property listings. Upgrade your plan to add another listing.`)
        return
      }
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      property_type: form.property_type,
      listing_type: form.listing_type,
      price,
      location: form.location.trim(),
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      size: form.size ? Number(form.size) : null,
      features: parseFeatures(form.features),
      status: form.status,
    }

    if (isEdit && id) {
      const { error: err } = await updateProperty(id, user.id, payload)
      setSubmitting(false)
      if (err) {
        setError(err)
        return
      }
      navigate(`/dashboard/properties/${id}`)
      return
    }

    const { data, error: err } = await createProperty(user.id, payload)
    setSubmitting(false)
    if (err || !data) {
      setError(err ?? 'Could not create property')
      return
    }
    navigate(`/dashboard/properties/${data.id}`)
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to={isEdit && id ? `/dashboard/properties/${id}` : '/dashboard/properties'} className="muted" style={{ fontWeight: 700, fontSize: 13 }}>
          ← Back
        </Link>
        <h2 className="page-title" style={{ margin: '8px 0 0' }}>
          {isEdit ? 'Edit property' : 'Add property'}
        </h2>
      </div>

      {(error || loadError) && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {error ?? loadError}
        </div>
      )}

      <form className="card pad" onSubmit={(e) => void onSubmit(e)}>
        <div className="form-grid">
          <div className="field full">
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="field full">
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="textarea"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="property_type">
              Property type
            </label>
            <select
              id="property_type"
              className="select"
              value={form.property_type}
              onChange={(e) => setForm({ ...form, property_type: e.target.value as PropertyType })}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="listing_type">
              Listing type
            </label>
            <select
              id="listing_type"
              className="select"
              value={form.listing_type}
              onChange={(e) => setForm({ ...form, listing_type: e.target.value as ListingType })}
            >
              {LISTING_TYPES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="price">
              Price (USD)
            </label>
            <input
              id="price"
              type="number"
              min={0}
              step="1"
              className="input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              className="select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PropertyStatus })}
            >
              {PROPERTY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label className="label" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              className="input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="bedrooms">
              Bedrooms
            </label>
            <input
              id="bedrooms"
              type="number"
              min={0}
              className="input"
              value={form.bedrooms}
              onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="bathrooms">
              Bathrooms
            </label>
            <input
              id="bathrooms"
              type="number"
              min={0}
              step="0.5"
              className="input"
              value={form.bathrooms}
              onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="size">
              Size (sq ft)
            </label>
            <input
              id="size"
              type="number"
              min={0}
              className="input"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />
          </div>
          <div className="field full">
            <label className="label" htmlFor="features">
              Features (comma-separated)
            </label>
            <input
              id="features"
              className="input"
              placeholder="Pool, Garage, Renovated kitchen"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" className="btn btn-blue" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create property'}
          </button>
          <Link to="/dashboard/properties" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
