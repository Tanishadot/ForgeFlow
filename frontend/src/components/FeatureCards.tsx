import React from 'react'
import { motion } from 'framer-motion'

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI Scheduling',
    description:
      'Multi-agent pipeline powered by NVIDIA NIM auto-assigns jobs to machines, respects urgency, resolves conflicts, and generates an optimal shift schedule in under a second.',
    accent: '#76b900',
    points: ['Conflict resolution', 'Urgency-aware ordering', 'Machine-capacity fit'],
  },
  {
    icon: '⚙️',
    title: 'Machine Monitoring',
    description:
      'Real-time health panels show utilization, status, and alerts for every machine on the floor. Instantly spot downtime and redirect jobs before the shift derails.',
    accent: '#3b82f6',
    points: ['Live utilization bars', 'Downtime detection', 'Gantt timeline view'],
  },
  {
    icon: '📦',
    title: 'Inventory Intelligence',
    description:
      'Track stock levels against reorder thresholds. Automatic CRITICAL / LOW / OK badges surface shortages before they block production runs.',
    accent: '#f59e0b',
    points: ['Threshold monitoring', 'Shortage prediction', 'Material linkage to orders'],
  },
]

const container = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.15 } },
}
const card = {
  hidden: { opacity: 0, y: 30 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export default function FeatureCards() {
  return (
    <section className="py-24 px-6 md:px-16 lg:px-24" style={{ background: '#060a10' }}>
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
            Core Capabilities
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-100 mb-4">
            Everything your factory floor needs
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            One platform that connects machines, inventory, and orders — with AI that acts on the data so your team doesn't have to.
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid md:grid-cols-3 gap-6"
        >
          {FEATURES.map(f => (
            <motion.div
              key={f.title}
              variants={card}
              whileHover={{ y: -6, boxShadow: `0 0 30px ${f.accent}22` }}
              className="rounded-xl p-6 flex flex-col gap-4 cursor-default transition-colors"
              style={{
                background: '#111827',
                border: `1px solid rgba(255,255,255,0.07)`,
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl"
                style={{ background: `${f.accent}15`, border: `1px solid ${f.accent}30` }}
              >
                {f.icon}
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-slate-100">{f.title}</h3>

              {/* Desc */}
              <p className="text-slate-400 text-sm leading-relaxed flex-1">{f.description}</p>

              {/* Points */}
              <ul className="space-y-1.5 mt-1">
                {f.points.map(p => (
                  <li key={p} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.accent }} />
                    {p}
                  </li>
                ))}
              </ul>

              {/* Bottom accent line */}
              <motion.div
                className="h-0.5 rounded-full mt-2"
                style={{ background: `linear-gradient(to right, ${f.accent}, transparent)` }}
                initial={{ scaleX: 0, originX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
