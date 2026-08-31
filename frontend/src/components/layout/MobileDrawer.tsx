import React, { forwardRef, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, PanInfo } from 'framer-motion'
import { LayoutDashboard, PlusCircle, Bot, Wallet, History } from 'lucide-react'
import './MobileDrawer.css'

export const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tasks/new', icon: PlusCircle, label: 'New Task' },
  { path: '/tasks/history', icon: History, label: 'Task History' },
  { path: '/agents', icon: Bot, label: 'Agents' },
  { path: '/wallet', icon: Wallet, label: 'Wallet' },
] as const

interface MobileDrawerProps {
  onClose: () => void
  currentPath: string
  onNavigate: (path: string) => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const MobileDrawer = forwardRef<HTMLDivElement, MobileDrawerProps>(
  ({ onClose, currentPath, onNavigate }, ref) => {
    const { t } = useTranslation()
    const drawerRef = useRef<HTMLDivElement | null>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const combinedRef = useCallback(
      (node: HTMLDivElement | null) => {
        drawerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref],
    )

    useEffect(() => {
      previousFocusRef.current = document.activeElement as HTMLElement
      return () => {
        previousFocusRef.current?.focus()
      }
    }, [])

    useEffect(() => {
      const drawer = drawerRef.current
      if (!drawer) return

      const focusableEls = drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusableEls.length === 0) return

      focusableEls[0]?.focus()

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return

        const els = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        if (els.length === 0) return

        const first = els[0]
        const last = els[els.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.x > 100 || info.velocity.x > 500) {
        onClose()
      }
    }

    const handleNavigate = (path: string) => {
      onNavigate(path)
    }

    return (
      <>
        <motion.div
          className="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          aria-hidden="true"
        />
        <motion.div
          ref={combinedRef}
          className="mobile-drawer trap-focus"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 400, duration: 0.18 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          role="dialog"
          aria-modal="true"
          aria-label={t('a11y.mobileNavigationMenu')}
        >
          <div className="drawer-drag-handle" aria-hidden="true" />
          <div className="drawer-header">
            <h2>{t('nav.navigation')}</h2>
            <button
              className="close-btn"
              onClick={onClose}
              aria-label={t('a11y.closeNavigationMenu')}
            >
              ✕
            </button>
          </div>

          <nav className="drawer-nav">
            <ul>
              {NAV_ITEMS.map((item) => {
                const isActive = currentPath === item.path
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <button
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavigate(item.path)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="nav-icon">
                        <Icon size={20} />
                      </span>
                      <span className="nav-label">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </motion.div>
      </>
    )
  },
)

MobileDrawer.displayName = 'MobileDrawer'

export default MobileDrawer
