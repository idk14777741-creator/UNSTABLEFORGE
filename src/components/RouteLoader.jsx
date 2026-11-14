import Mark from './Mark'

export default function RouteLoader({ label = 'CHECKING THE FORGE' }) {
  return (
    <main id="main" className="route-loader" aria-busy="true">
      <div className="route-loader__inner">
        <Mark className="route-loader__mark" />
        <p className="route-loader__label">{label}</p>
        <span className="route-loader__line" aria-hidden="true" />
      </div>
    </main>
  )
}
