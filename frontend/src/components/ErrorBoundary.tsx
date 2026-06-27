import React from 'react'

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ForgeFlow] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="panel p-8 max-w-lg w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-lg font-semibold text-slate-100">Something went wrong</h1>
            <p className="text-sm text-slate-400 font-mono bg-black/30 rounded p-3 text-left break-all">
              {this.state.error.message}
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
