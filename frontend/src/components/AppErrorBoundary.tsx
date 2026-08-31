import React, { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  lang?: string
  onReset?: () => void
}

type State = {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HeyMaa app render error', error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const isEl = (this.props.lang || 'el') === 'el'
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#F5F0EB',
          fontFamily: "'DM Sans', sans-serif",
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: '#fff',
            borderRadius: 16,
            padding: '28px 24px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(43,58,103,0.12)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">
            ⚠️
          </div>
          <h1 style={{ margin: '0 0 10px', fontSize: 20, color: '#2B3A67' }}>
            {isEl ? 'Κάτι πήγε στραβά' : 'Something went wrong'}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'rgba(43,58,103,.65)' }}>
            {isEl
              ? 'Η εφαρμογή δεν μπόρεσε να φορτώσει σωστά. Δοκίμασε ξανά ή ανανέωσε τη σελίδα.'
              : 'The app could not load correctly. Try again or refresh the page.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              className="hm-btn hm-btn--primary hm-btn--block"
              onClick={this.handleRetry}
            >
              {isEl ? 'Δοκίμασε ξανά' : 'Try again'}
            </button>
            <button
              type="button"
              className="hm-btn hm-btn--secondary hm-btn--block"
              onClick={this.handleReload}
            >
              {isEl ? 'Ανανέωση σελίδας' : 'Refresh page'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
