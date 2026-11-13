import { useEffect, useState } from 'react'

const listeners = new Set()

export function currentLocation() {
  return {
    pathname: window.location.pathname.replace(/\/+$/, '') || '/',
    search: window.location.search,
  }
}

function notify() {
  const location = currentLocation()
  listeners.forEach((listener) => listener(location))
}

/**
 * Small history-based router. The app only has a handful of routes, so this
 * keeps navigation client-side without adding a routing dependency.
 */
export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  notify()
  window.scrollTo({ top: 0, behavior: 'instant' })
}

export function useRoute() {
  const [location, setLocation] = useState(currentLocation)

  useEffect(() => {
    const onPopState = () => setLocation(currentLocation())
    listeners.add(setLocation)
    window.addEventListener('popstate', onPopState)
    return () => {
      listeners.delete(setLocation)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  return location
}

export function Link({ to, onClick, children, ...rest }) {
  const handleClick = (event) => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
