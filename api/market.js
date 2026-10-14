import {
  HttpError,
  handleEnquiry,
  handleReport,
  handleRequest,
  handleReview,
} from '../server/market.mjs'

const ACTIONS = {
  request: handleRequest,
  enquiry: handleEnquiry,
  review: handleReview,
  report: handleReport,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const action = ACTIONS[body.action]
    if (!action) throw new HttpError(400, 'Unknown action')
    const result = await action(body, req)
    res.status(200).json(result)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    res.status(status).json({ error: err.message || 'Something went wrong' })
  }
}
