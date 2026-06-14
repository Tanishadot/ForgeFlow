import React, { useState } from 'react'
import axios from 'axios'

export default function Simulation() {
  const [payload, setPayload] = useState('{\n  "scenario": {\n    "type": "machine_failure",\n    "machine": "M-1"\n  }\n}')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const body = JSON.parse(payload)
      const resp = await axios.post('/api/whatif', body)
      setResult(resp.data)
    } catch (err:any) {
      setResult({error: err.message || String(err)})
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="panel p-4 rounded-md mb-4">
        <h2 className="text-lg font-semibold">What-If Simulation</h2>
        <p className="text-sm text-slate-400">Run scenarios such as machine failures or rush orders against the current schedule.</p>
      </div>

      <div className="panel p-4 rounded-md mb-4">
        <textarea value={payload} onChange={e => setPayload(e.target.value)} className="w-full p-2 rounded-md bg-transparent border border-gray-700" rows={10} />
        <div className="flex justify-end mt-2">
          <button onClick={run} disabled={loading} className="px-4 py-2 bg-nvidia-500 text-black rounded-md">Run Simulation</button>
        </div>
      </div>

      {result && (
        <div className="panel p-4 rounded-md">
          <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
