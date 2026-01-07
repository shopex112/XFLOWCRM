import React from 'react'
import Protected from './components/protected'
import Dashboard from './pages/dashboard'

export default function App() {
  return (
    <Protected>
      <Dashboard />
    </Protected>
  )
}
