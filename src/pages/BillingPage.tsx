import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getPlan, PLAN_CONFIG, isTrialActive, trialDaysRemaining, type Plan } from '../lib/plans'

const plans: Plan[] = ['starter', 'professional', 'agency']

export function BillingPage() {
  const { profile, session } = useAuth()
  const currentPlan = getPlan(profile)
  const [selectedPlan, setSelectedPlan] = useState<Plan>(currentPlan)
  const [referenceInput, setReferenceInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => PLAN_CONFIG[selectedPlan], [selectedPlan])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const referenceInputValue = referenceInput.trim()
    if (!referenceInputValue) {
      setError('Enter the EcoCash transaction reference after making the payment.')
      return
    }
    if (!session?.access_token) {
      setError('Your session has expired. Please log in again.')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/payments/ecocash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: selectedPlan, transactionReference: referenceInputValue }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'EcoCash payment could not be started.')
      setMessage(data.message || 'Payment submitted for manual verification. Your plan will be activated after the payment is verified.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'EcoCash payment could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="billing-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">BILLING</span>
          <h2 className="page-title">Plans & payments</h2>
          <p className="muted">{isTrialActive(profile) ? `You are trying ${PLAN_CONFIG[currentPlan].name} free for 5 days. You can submit payment before the trial ends to continue without interruption.` : 'Choose a ListyAI plan and pay via EcoCash. Payments are manually verified for now.'}</p>
        </div>
        <div className="billing-current">{isTrialActive(profile) ? <>Free trial: <strong>{PLAN_CONFIG[currentPlan].name}</strong> · {trialDaysRemaining(profile)}d left</> : <>Current plan: <strong>{PLAN_CONFIG[currentPlan].name}</strong></>}</div>
      </div>

      <div className="billing-grid">
        <section className="card pad">
          <div className="section-heading">
            <h3>Choose a plan</h3>
            <p>ListyAI subscriptions are billed monthly in US dollars.</p>
          </div>
          <div className="billing-plan-grid">
            {plans.map((plan) => {
              const config = PLAN_CONFIG[plan]
              const active = selectedPlan === plan
              return (
                <button key={plan} type="button" className={`billing-plan ${active ? 'selected' : ''}`} onClick={() => setSelectedPlan(plan)}>
                  <span>{config.name}</span>
                  <strong>US${config.price}<small>/month</small></strong>
                  <em>{config.propertyLimit === null ? 'Unlimited listings' : `Up to ${config.propertyLimit} active listings`}</em>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card pad billing-checkout-card">
          <div className="payment-brand">
            <div className="payment-logo">E</div>
            <div><strong>EcoCash</strong><span>Manual payment verification</span></div>
          </div>
          <h3>Pay for {selected.name}</h3>
          <div className="billing-total">US${selected.price}<span>/month</span></div>
          {error && <div className="error-banner">{error}</div>}
          {message && <div className="info-banner billing-success">{message}</div>}
          <div className="billing-ecocash-instructions">
            <div className="billing-payment-number">
              <span>Send US${selected.price} to</span>
              <strong>0787422528</strong>
              <small>EcoCash</small>
            </div>
            <ol>
              <li>Open EcoCash on your phone.</li>
              <li>Send exactly <strong>US${selected.price}</strong> to <strong>0787422528</strong>.</li>
              <li>Complete the payment using your own EcoCash PIN.</li>
              <li>Enter the transaction reference below.</li>
            </ol>
          </div>
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="field">
              <label className="label" htmlFor="ecocash-reference">EcoCash transaction reference</label>
              <input id="ecocash-reference" className="input" value={referenceInput} onChange={(e) => setReferenceInput(e.target.value)} placeholder="e.g. 1234567890" autoComplete="off" required />
              <small className="field-help">Use the reference shown on your EcoCash confirmation. Never enter your EcoCash PIN here.</small>
            </div>
            <button className="btn btn-blue btn-lg" type="submit" disabled={submitting}>
              {submitting ? 'Submitting payment…' : `I've paid US$${selected.price}`}
            </button>
          </form>
          <p className="billing-security">Payments are manually verified before a paid plan is activated. ListyAI never asks for or stores your EcoCash PIN.</p>
        </section>
      </div>

      <section className="card pad billing-setup">
        <div>
          <span className="eyebrow">ECOCASH PAYMENT</span>
          <h3>Manual verification</h3>
          <p className="muted">For launch, ListyAI accepts EcoCash payments to the VELORA payment number above. We verify the transaction reference manually and then activate the selected plan.</p>
        </div>
        <div className="billing-setup-actions">
          <Link className="btn" to="/dashboard/profile">Account settings</Link>
        </div>
      </section>
    </div>
  )
}
