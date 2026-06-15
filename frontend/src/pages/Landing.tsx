import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Hero from '../components/Hero'
import FeatureCards from '../components/FeatureCards'

// ── Pricing ────────────────────────────────────────────────────
const PLANS = [
  {
    name:    'Starter',
    price:   'Free',
    period:  '',
    desc:    'For small factories getting started with AI scheduling.',
    color:   '#64748b',
    features: [
      'Up to 5 machines',
      'Up to 2 users',
      'AI schedule generation',
      'Basic alerts',
      'CSV import',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name:    'Pro',
    price:   '$99',
    period:  '/ month',
    desc:    'For growing operations that need real-time intelligence.',
    color:   '#76b900',
    features: [
      'Up to 50 machines',
      'Unlimited users',
      'AI scheduling + What-If',
      'Shift handover summaries',
      'NVIDIA NIM copilot',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name:    'Enterprise',
    price:   'Custom',
    period:  '',
    desc:    'For large manufacturers with complex multi-site needs.',
    color:   '#3b82f6',
    features: [
      'Unlimited machines + sites',
      'Dedicated AI agent fleet',
      'Custom integrations (ERP/MES)',
      'SLA + uptime guarantee',
      'On-premise option',
      'White-glove onboarding',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
]

function PricingSection() {
  const navigate = useNavigate()

  return (
    <section
      className="py-24 px-6 md:px-16 lg:px-24"
      style={{ background: '#030712', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#76b900' }}>
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-100 mb-4">
            Plans that scale with your factory
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Start free. Upgrade as your fleet grows. No hidden fees, no lock-in.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-xl p-7 flex flex-col gap-5 relative"
              style={{
                background: plan.highlight ? 'rgba(118,185,0,0.06)' : '#0d1117',
                border: plan.highlight
                  ? '1px solid rgba(118,185,0,0.4)'
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: plan.highlight ? '0 0 40px rgba(118,185,0,0.08)' : undefined,
              }}
            >
              {plan.highlight && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                  style={{ background: '#76b900', color: '#030712' }}
                >
                  Most Popular
                </div>
              )}

              {/* Plan name + price */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-slate-100">{plan.price}</span>
                  {plan.period && <span className="text-slate-500 text-sm mb-1">{plan.period}</span>}
                </div>
                <p className="text-slate-400 text-sm mt-2">{plan.desc}</p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

              {/* Features */}
              <ul className="flex flex-col gap-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: `${plan.color}20`, color: plan.color }}
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: plan.highlight ? '0 0 20px rgba(118,185,0,0.3)' : undefined }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(plan.name === 'Enterprise' ? '/#contact' : '/signup')}
                className="btn w-full py-2.5 font-semibold rounded-lg mt-1"
                style={
                  plan.highlight
                    ? { background: '#76b900', color: '#000' }
                    : { background: 'rgba(255,255,255,0.07)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#030712', minHeight: '100vh', color: '#F9FAFB' }}>
      <Hero />
      <FeatureCards />
      <PricingSection />

      {/* CTA section */}
      <section
        className="py-24 px-6 text-center"
        style={{
          background: 'linear-gradient(to bottom, #060a10, #030712)',
          borderTop: '1px solid rgba(118,185,0,0.1)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto flex flex-col items-center gap-6"
        >
          <h2 className="text-3xl md:text-4xl font-black text-slate-100">
            Ready to optimize your{' '}
            <span style={{ color: '#76b900' }}>factory floor?</span>
          </h2>
          <p className="text-slate-400">
            Sign up in minutes. Upload your CSV data. Generate your first AI schedule instantly.
          </p>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 0 28px rgba(118,185,0,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="btn btn-primary px-8 py-3 text-base font-semibold rounded-lg"
            >
              Get Started →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="btn btn-ghost px-8 py-3 text-base rounded-lg"
            >
              Sign In
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer
        className="py-6 text-center text-xs text-slate-600"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        ForgeFlow AI · NVIDIA Bootcamp Capstone · Built with NVIDIA NIM
      </footer>
    </div>
  )
}
