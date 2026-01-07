import React from 'react'
import Protected from './components/Protected'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <Protected>
      <Dashboard />
    </Protected>
  )
}
