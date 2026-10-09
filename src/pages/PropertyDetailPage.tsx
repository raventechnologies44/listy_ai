import { ChangeEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { deleteProperty, updateProperty, useProperty } from '../hooks/useProperties'
import {
  deletePropertyImage,
  uploadPropertyImage,
  usePropertyImages,
} from '../hooks/usePropertyImages'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { StatusBadge } from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../lib/format'
import { PropertyMarketingAi } from '../components/PropertyMarketingAi'
import { PROPERTY_STATUSES, type PropertyStatus } from '../types/database'

export function PropertyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { property, loading, error, reload } = useProperty(id, user?.id)
  const { images, loading: imagesLoading, error: imagesError, reload: reloadImages } =
    usePropertyImages(id, user?.id)

  const [statusUpdating, setStatusUpdating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (loading) return <LoadingSpinner />

  if (!property) {
    return (
      <div className="card pad empty-state">
        <h3>{error ? 'Could not load property' : 'Property not found'}</h3>
        {error && <p className="error-banner">{error}</p>}
        <Link to="/dashboard/properties" className="btn">
          Back to properties
        </Link>
      </div>
    )
  }

  async function onStatusChange(next: PropertyStatus) {
    if (!user || !id) return
    setActionError(null)
    setStatusUpdating(true)
    const { error: err } = await updateProperty(id, user.id, { status: next })
    setStatusUpdating(false)
    if (err) {
      setActionError(err)
      return
    }
    await reload()
  }

  async function onDelete() {
    if (!user || !id) return
    if (!window.confirm('Delete this property and its image records? This cannot be undone.')) return
    setDeleting(true)
    const { error: err } = await deleteProperty(id, user.id)
    setDeleting(false)
    if (err) {
      setActionError(err)
      return
    }
    navigate('/dashboard/properties')
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user || !id) return
    if (!file.type.startsWith('image/')) {
      setActionError('Please choose an image file (JPEG, PNG, WebP, GIF).')
      return
    }
    setActionError(null)
    setUploading(true)
    const { error: err } = await uploadPropertyImage(user.id, id, file, images.length)
    setUploading(false)
    if (err) {
      setActionError(err)
      return
    }
    await reloadImages()
  }

  async function onRemoveImage(imageId: string) {
    const image = images.find((i) => i.id === imageId)
    if (!image) return
    if (!window.confirm('Remove this image?')) return
    setActionError(null)
    const { error: err } = await deletePropertyImage(image)
    if (err) {
      setActionError(err)
      return
    }
    await reloadImages()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <Link to="/dashboard/properties" className="muted" style={{ fontWeight: 700, fontSize: 13 }}>
            ← Properties
          </Link>
          <h2 className="page-title" style={{ margin: '8px 0 4px' }}>
            {property.title}
          </h2>
          <StatusBadge status={property.status} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Link to={`/dashboard/properties/${property.id}/edit`} className="btn">
            Edit
          </Link>
          <button type="button" className="btn btn-danger" onClick={() => void onDelete()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      <div className="card pad" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
              Price
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--heading)' }}>
              {formatCurrency(Number(property.price), property.listing_type)}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
              Change status
            </div>
            <select
              className="select"
              style={{ minWidth: 180, marginTop: 4 }}
              value={property.status}
              disabled={statusUpdating}
              onChange={(e) => void onStatusChange(e.target.value as PropertyStatus)}
            >
              {PROPERTY_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p style={{ margin: '0 0 12px', color: 'var(--heading)', fontWeight: 700 }}>{property.location}</p>
        {property.description && <p className="muted">{property.description}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Type
            </div>
            <div style={{ fontWeight: 800, textTransform: 'capitalize' }}>{property.property_type}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
              Listing
            </div>
            <div style={{ fontWeight: 800, textTransform: 'capitalize' }}>{property.listing_type}</div>
          </div>
          {property.bedrooms != null && (
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                Beds
              </div>
              <div style={{ fontWeight: 800 }}>{property.bedrooms}</div>
            </div>
          )}
          {property.bathrooms != null && (
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                Baths
              </div>
              <div style={{ fontWeight: 800 }}>{property.bathrooms}</div>
            </div>
          )}
          {property.size != null && (
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>
                Size
              </div>
              <div style={{ fontWeight: 800 }}>{property.size} sq ft</div>
            </div>
          )}
        </div>

        {property.features.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Features
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {property.features.map((f) => (
                <span key={f} className="badge badge-available">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
          Updated {formatDate(property.updated_at)}
        </p>
      </div>

      <PropertyMarketingAi property={property} />

      <div className="card pad" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--heading)' }}>Photos</h3>
          <label className="btn btn-blue" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading}
              onChange={(e) => void onFileChange(e)}
            />
          </label>
        </div>

        {imagesError && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            {imagesError}
          </div>
        )}

        {imagesLoading ? (
          <LoadingSpinner />
        ) : images.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <p className="muted" style={{ margin: 0 }}>
              No photos yet. Upload images for this listing.
            </p>
          </div>
        ) : (
          <div className="image-gallery">
            {images.map((img) => (
              <div key={img.id} className="image-thumb-wrap">
                <img src={img.publicUrl} alt="" loading="lazy" />
                <button type="button" className="btn btn-danger" onClick={() => void onRemoveImage(img.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
