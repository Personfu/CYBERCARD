import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './emails/**/*.{ts,tsx}',
    './modules/**/*.{md,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}

export default config