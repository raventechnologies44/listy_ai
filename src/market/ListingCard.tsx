import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/format'
import { imageUrl, statusNote } from './marketApi'
import type { ListingType, PropertyStatus } from '../types/database'

interface Props {
  id: string
  title: string
  price: number
  location: string
  listingType: ListingType
  bedrooms: number | null
  imagePath: string | null
  status?: PropertyStatus
  reasons?: string[]
}

export function ListingCard({ id, title, price, location, listingType, bedrooms, imagePath, status, reasons }: Props) {
  const img = imageUrl(imagePath)
  const note = status ? statusNote(status) : null
  return (
    <Link to={`/market/listing/${id}`} className="mk-card">
      <div className="mk-card-img" style={img ? { backgroundImage: `url(${img})` } : undefined}>
        {!img && 'No photo'}
        <span className="mk-tag">{listingType === 'rent' ? 'For rent' : 'For sale'}</span>
        {note && <span className="mk-tag warn">{note}</span>}
      </div>
      <div className="mk-card-body">
        <div className="mk-price">{formatCurrency(Number(price), listingType)}</div>
        <div className="mk-card-title">{title}</div>
        <div className="mk-meta">{location}{bedrooms != null ? ` · ${bedrooms} bed` : ''}</div>
        {reasons && reasons.length > 0 && <div className="mk-meta" style={{ color: '#1d4ed8', fontWeight: 700 }}>{reasons.join(' · ')}</div>}
      </div>
    </Link>
  )
}
