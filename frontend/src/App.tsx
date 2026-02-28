// Main App Component with routing and Digital Slice transitions

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layout } from './components/Layout'
import { GlobalProgressBar } from './components/ProgressBar'
import { ToastContainer } from './components/Toast'
import { ProgressProvider } from './context/ProgressContext'
import { ToastProvider } from './context/ToastContext'
import { Dashboard } from './pages/Dashboard'
import { Reviews } from './pages/Reviews'
import { ReviewDetail } from './pages/ReviewDetail'
import { Repositories } from './pages/Repositories'
import { Settings } from './pages/Settings'
import { RepositorySettings } from './pages/RepositorySettings'

// Animated Routes wrapper with Digital Slice effect
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="relative w-full min-h-full"
        initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
        transition={{
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/reviews/:reviewId" element={<ReviewDetail />} />
          <Route path="/repositories" element={<Repositories />} />
          <Route path="/repositories/:repoId/settings" element={<RepositorySettings />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

import { SystemBoot, useSystemBoot } from './components/SystemBoot'
import { ErrorBoundary } from './components/ErrorBoundary'

function App() {
  const { showBoot, handleBootComplete } = useSystemBoot()

  return (
    <ToastProvider>
      <ProgressProvider>
        <BrowserRouter>
          <SystemBoot onComplete={handleBootComplete} skipAnimation={!showBoot} />
          <GlobalProgressBar />
          <Layout>
            <ErrorBoundary>
              <AnimatedRoutes />
            </ErrorBoundary>
          </Layout>
          <ToastContainer />
        </BrowserRouter>
      </ProgressProvider>
    </ToastProvider>
  )
}

export default App
