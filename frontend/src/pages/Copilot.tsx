import React, { useState } from 'react'
import axios from 'axios'

export default function Copilot() {
  const [history, setHistory] = useState<Array<{role:string, text:string}>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input) return
    setLoading(true)
    const userMsg = input
    setHistory(h => [...h, {role:'user', text:userMsg}])
    try {
      const resp = await axios.post('/explain', { schedule: [], context: {}, use_nim: true })
      // For demo, backend explain returns summaries array
      const summaries = resp.data.summaries || []
      const assistant = summaries.join('\n') || 'No explanation available.'
      setHistory(h => [...h, {role:'assistant', text:assistant}])
    } catch (err:any) {
      setHistory(h => [...h, {role:'assistant', text:'Error: '+(err.message||String(err))}])
    } finally {
      setLoading(false)
      setInput('')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="panel p-4 rounded-md mb-4">
        <h2 className="text-lg font-semibold">Factory Copilot</h2>
        <p className="text-sm text-slate-400">Ask questions like "Why is order O3 delayed?" or "Which machine is overloaded?"</p>
      </div>

      <div className="panel p-4 rounded-md mb-4">
        <div className="space-y-2">
          {history.map((h, i) => (
            <div key={i} className={h.role === 'user' ? 'text-right text-slate-200' : 'text-left text-slate-300'}>
              <div className="inline-block px-3 py-2 rounded-md" style={{background: h.role === 'user' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)'}}>
                {h.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4 rounded-md">
        <textarea value={input} onChange={e => setInput(e.target.value)} className="w-full p-2 rounded-md bg-transparent border border-gray-700" rows={4} />
        <div className="flex justify-end mt-2">
          <button onClick={send} disabled={loading} className="px-4 py-2 bg-nvidia-500 text-black rounded-md">Send</button>
        </div>
      </div>
    </div>
  )
}
