/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      { source: '/dashboard/utvardering', destination: '/dashboard/evaluations' },
      { source: '/dashboard/utvardering/skapa', destination: '/dashboard/evaluations/new' },
      { source: '/dashboard/utvardering/:id', destination: '/dashboard/evaluations/:id' },
      { source: '/dashboard/debrief/skapa', destination: '/dashboard/send' },
      { source: '/dashboard/loopar', destination: '/dashboard/loops' },
      { source: '/dashboard/loopar/skapa', destination: '/dashboard/loops/new' },
      { source: '/dashboard/loopar/:id', destination: '/dashboard/loops/:id' },
    ]
  },
}

module.exports = nextConfig
