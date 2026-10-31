import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initTheme, setTheme, useTheme } from './theme'

function systemPrefersDark(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: dark,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

const root = document.documentElement

describe('theme', () => {
  afterEach(() => localStorage.clear())

  it('saves the choice and puts it on <html>', () => {
    systemPrefersDark(false)
    const { result } = renderHook(() => useTheme())

    act(() => setTheme('dark'))

    expect(result.current).toMatchObject({
      theme: 'dark',
      resolvedTheme: 'dark',
    })
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(root).toHaveClass('dark')
    expect(root).not.toHaveClass('light')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('follows the system when nothing is saved', () => {
    systemPrefersDark(true)
    localStorage.setItem('theme', 'light')
    const { result } = renderHook(() => useTheme())

    act(() => setTheme('system'))

    expect(localStorage.getItem('theme')).toBeNull()
    expect(result.current).toMatchObject({
      theme: 'system',
      resolvedTheme: 'dark',
    })
    initTheme()
    expect(root).toHaveClass('dark')
  })
})
