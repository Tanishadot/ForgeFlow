import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

/* ── Animated factory SVG ─────────────────────────────────── */
function FactoryIllustration() {
  const GREEN = '#76b900'
  const DIM   = 'rgba(118,185,0,0.25)'

  // Particle animation along a path
  function Particle({ delay, dur, cx, cy, path }: { delay: number; dur: number; cx: number; cy: number; path: string }) {
    return (
      <motion.circle
        r={3}
        fill={GREEN}
        filter="url(#glow)"
        style={{ offsetPath: `path('${path}')`, offsetDistance: '0%' }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ duration: dur, delay, repeat: Infinity, ease: 'linear' }}
      />
    )
  }

  return (
    <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(118,185,0,0.05)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Background glow */}
      <ellipse cx="200" cy="160" rx="180" ry="140" fill="url(#bg)" />

      {/* Data flow lines */}
      {[
        'M 100 100 L 200 80',
        'M 200 80  L 300 100',
        'M 100 100 L 100 220',
        'M 300 100 L 300 220',
        'M 100 220 L 200 240',
        'M 300 220 L 200 240',
        'M 200 80  L 200 160',
        'M 200 160 L 100 220',
        'M 200 160 L 300 220',
      ].map((d, i) => (
        <path key={i} d={d} stroke={DIM} strokeWidth="1.5" strokeDasharray="4 4" />
      ))}

      {/* Animated particles */}
      <Particle delay={0}   dur={2.5} cx={0} cy={0} path="M 100 100 L 200 80" />
      <Particle delay={0.8} dur={2.5} cx={0} cy={0} path="M 200 80 L 300 100" />
      <Particle delay={0.3} dur={3}   cx={0} cy={0} path="M 100 100 L 100 220" />
      <Particle delay={1.2} dur={2.8} cx={0} cy={0} path="M 300 100 L 300 220" />
      <Particle delay={0.6} dur={2.6} cx={0} cy={0} path="M 200 80 L 200 160" />
      <Particle delay={1.5} dur={2.4} cx={0} cy={0} path="M 200 160 L 100 220" />
      <Particle delay={0.9} dur={2.7} cx={0} cy={0} path="M 200 160 L 300 220" />
      <Particle delay={1.8} dur={2.3} cx={0} cy={0} path="M 100 220 L 200 240" />
      <Particle delay={0.4} dur={2.9} cx={0} cy={0} path="M 300 220 L 200 240" />

      {/* Machine node M-1 */}
      <MachineNode x={70} y={70} label="M-1" type="CNC" status="running" />

      {/* Machine node M-2 */}
      <MachineNode x={270} y={70} label="M-2" type="Lathe" status="running" />

      {/* Machine node M-3 (DOWN) */}
      <MachineNode x={70} y={190} label="M-3" type="CNC" status="down" />

      {/* Machine node M-4 */}
      <MachineNode x={270} y={190} label="M-4" type="Asm." status="running" />

      {/* AI core node */}
      <AINode x={170} y={130} />

      {/* Output node */}
      <motion.g>
        <motion.circle
          cx={200} cy={240} r={18}
          fill="rgba(118,185,0,0.08)"
          stroke={GREEN}
          strokeWidth="1"
          animate={{ r: [18, 22, 18] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <text x={200} y={244} textAnchor="middle" fontSize="9" fill={GREEN} fontWeight="600">SCHEDULE</text>
      </motion.g>
    </svg>
  )
}

function MachineNode({ x, y, label, type, status }: {
  x: number; y: number; label: string; type: string; status: 'running' | 'down'
}) {
  const GREEN   = '#76b900'
  const RED     = '#ef4444'
  const color   = status === 'running' ? GREEN : RED

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: Math.random() * 0.5 }}
    >
      {/* Box */}
      <rect x={x} y={y} width={60} height={44} rx={6}
        fill="rgba(17,24,39,0.9)"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Gear icon */}
      <motion.text
        x={x + 10} y={y + 18}
        fontSize="12"
        fill={color}
        animate={{ rotate: status === 'running' ? 360 : 0 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: `${x + 10}px ${y + 12}px` }}
      >
        ⚙
      </motion.text>
      {/* Label */}
      <text x={x + 28} y={y + 17} fontSize="9" fill="#e2e8f0" fontWeight="600">{label}</text>
      <text x={x + 28} y={y + 27} fontSize="8" fill="#64748b">{type}</text>
      {/* Status dot */}
      <motion.circle
        cx={x + 52} cy={y + 8} r={4}
        fill={color}
        animate={status === 'running' ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {/* Util bar */}
      {status === 'running' && (
        <>
          <rect x={x + 6} y={y + 32} width={48} height={4} rx={2} fill="rgba(255,255,255,0.08)" />
          <motion.rect
            x={x + 6} y={y + 32}
            width={0} height={4} rx={2}
            fill={GREEN}
            animate={{ width: Math.random() * 30 + 18 }}
            transition={{ duration: 1, delay: 0.8 }}
          />
        </>
      )}
    </motion.g>
  )
}

function AINode({ x, y }: { x: number; y: number }) {
  const GREEN = '#76b900'
  return (
    <motion.g>
      <motion.circle
        cx={x + 30} cy={y + 30} r={28}
        fill="rgba(118,185,0,0.06)"
        stroke={GREEN}
        strokeWidth="1.5"
        animate={{ r: [28, 32, 28] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx={x + 30} cy={y + 30} r={28}
        fill="transparent"
        stroke={GREEN}
        strokeWidth="0.5"
        strokeOpacity="0.4"
        animate={{ r: [28, 42, 28], strokeOpacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
      />
      <text x={x + 30} y={y + 27} textAnchor="middle" fontSize="11" fill={GREEN} fontWeight="700">AI</text>
      <text x={x + 30} y={y + 39} textAnchor="middle" fontSize="7"  fill="rgba(118,185,0,0.7)">NVIDIA NIM</text>
    </motion.g>
  )
}

/* ── Hero component ───────────────────────────────────────── */
export default function Hero() {
  const navigate = useNavigate()

  return (
    <section
      className="min-h-screen flex items-center px-6 md:px-16 lg:px-24"
      style={{ background: 'linear-gradient(135deg, #030712 0%, #060d14 50%, #030712 100%)' }}
    >
      <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center py-20">
        {/* Left: text */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 w-fit px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: 'rgba(118,185,0,0.1)',
              border: '1px solid rgba(118,185,0,0.3)',
              color: '#76b900',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-nvidia-500 animate-pulse" />
            Powered by NVIDIA NIM
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-6xl font-black tracking-tight leading-tight"
            style={{ color: '#F9FAFB' }}
          >
            Forge<span style={{ color: '#76b900' }}>Flow</span>{' '}
            <span className="text-slate-400 font-light">AI</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-xl font-medium"
            style={{ color: '#76b900' }}
          >
            AI-Powered Smart Manufacturing Scheduler
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-slate-400 text-base leading-relaxed max-w-lg"
          >
            Optimize production schedules, monitor machine health, predict bottlenecks —
            and keep your factory moving even on the worst day.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex gap-3 flex-wrap"
          >
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(118,185,0,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="btn btn-primary px-7 py-2.5 text-base font-semibold rounded-lg"
            >
              Get Started →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="btn btn-ghost px-7 py-2.5 text-base rounded-lg"
            >
              Sign In
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex gap-8 pt-2"
          >
            {[
              { value: '6 AI', label: 'Agents' },
              { value: '<1s', label: 'Schedule Time' },
              { value: '3+', label: 'What-If Scenarios' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-xl font-bold" style={{ color: '#76b900' }}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right: illustration */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="flex justify-center"
        >
          <FactoryIllustration />
        </motion.div>
      </div>
    </section>
  )
}
