let locks = 0

export function lockScroll() {
  locks += 1
  document.body.classList.add('is-locked')
}

export function releaseScroll() {
  locks = Math.max(0, locks - 1)
  if (locks === 0) document.body.classList.remove('is-locked')
}
