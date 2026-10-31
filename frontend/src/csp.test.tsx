import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import indexHtml from '../index.html?raw'
import { Providers } from './app'

// The image's CSP (nginx.conf) allows scripts from 'self' only. Vite does not
// apply it in development, so an inline script would break only in Docker.
describe('Content-Security-Policy', () => {
  it('index.html loads every script from a file', () => {
    const scripts = [...indexHtml.matchAll(/<script\b([^>]*)>/g)]
    expect(scripts.length).toBeGreaterThan(0)
    for (const [, attributes] of scripts) expect(attributes).toMatch(/\bsrc=/)
  })

  it('the app renders no inline script', () => {
    const { container } = render(
      <Providers>
        <p>app</p>
      </Providers>,
    )
    expect(
      container.ownerDocument.querySelectorAll('script:not([src])'),
    ).toHaveLength(0)
  })
})
