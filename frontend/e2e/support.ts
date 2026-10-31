import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'demo1234'

/** Logs in through the form, as anyone would (demo buttons exist only in the lab build). */
export async function logIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** The main navigation: the sidebar on desktop, the menu sheet on mobile. */
export async function navigation(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  if (await menu.isVisible()) await menu.click()
  return page.getByRole('navigation', { name: 'Navegación principal' }).last()
}

/** WCAG 2.2 AA, as in every visual review of the project. */
export async function expectAccessible(page: Page) {
  // Entrance fades keep running with reduced motion: measure contrast at rest.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== 'running'),
  )
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  // Rule and offending elements, so a failure says where to look.
  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
    ),
  ).toEqual([])
}

/** Nothing wider than the screen: no sideways scrolling on mobile. */
export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}
