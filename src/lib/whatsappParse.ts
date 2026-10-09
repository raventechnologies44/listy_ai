export interface ExtractedEnquiry {
  name: string | null
  phone: string | null
  email: string | null
  budget: number | null
  requirements: string | null
}

export function extractEnquiryDetails(message: string): ExtractedEnquiry {
  const text = message.trim()
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i)
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}[\s-]?\d{0,4}/)
  const budgetMatch = text.match(/(?:budget|up to|max|around|about)\s*[:\-]?\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:k|K)?/i)
    || text.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:k|K)?/i)

  let budget: number | null = null
  if (budgetMatch) {
    let raw = budgetMatch[1].replace(/,/g, '')
    let n = Number(raw)
    if (/k/i.test(budgetMatch[0]) && n < 10000) n *= 1000
    if (!Number.isNaN(n) && n > 0) budget = n
  }

  let name: string | null = null
  const nameLine = text.match(/(?:^|\n)\s*(?:hi|hello|hey)[,\s]+(?:i'?m|i am|this is)\s+([A-Za-z][A-Za-z\s'-]{1,40})/i)
    || text.match(/(?:^|\n)\s*name\s*[:\-]\s*([A-Za-z][A-Za-z\s'-]{1,40})/i)
  if (nameLine) name = nameLine[1].trim()

  const reqLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 10 && !/^hi\b|^hello\b/i.test(l))
  const requirements = reqLines.length > 0 ? reqLines.join(' ').slice(0, 500) : text.slice(0, 500)

  return {
    name,
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : null,
    email: emailMatch ? emailMatch[0] : null,
    budget,
    requirements: requirements || null,
  }
}

export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null
  return phone.replace(/\D/g, '')
}
