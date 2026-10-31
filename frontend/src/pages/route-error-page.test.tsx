import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { es } from '@/i18n/es'
import { RouteErrorPage } from './route-error-page'

function Broken(): never {
  throw new Error('boom')
}

describe('RouteErrorPage', () => {
  it('replaces a crashed screen with an explanation and a reload', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([
      { path: '/', element: <Broken />, errorElement: <RouteErrorPage /> },
    ])
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('heading', { name: es.crash.title }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: es.crash.reload }),
    ).toBeInTheDocument()
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    )
  })
})
