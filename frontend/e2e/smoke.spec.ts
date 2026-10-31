import { expect, test } from '@playwright/test'
import {
  expectAccessible,
  expectNoOverflow,
  logIn,
  navigation,
} from './support'

// Each role sees its sections and nothing else, reaches every one of them by
// clicking the navigation, and every screen is accessible and fits the screen.
const roles = [
  {
    role: 'asistente',
    email: 'carla@demo.example.com',
    sections: ['Eventos', 'Mis inscripciones'],
    hidden: ['Mis eventos', 'Usuarios y roles'],
  },
  {
    role: 'organizadora',
    email: 'ana@demo.example.com',
    sections: ['Eventos', 'Mis inscripciones', 'Mis eventos', 'Ponentes'],
    hidden: ['Sedes y salas', 'Usuarios y roles'],
  },
  {
    role: 'administrador',
    email: 'admin@demo.example.com',
    sections: [
      'Eventos',
      'Mis inscripciones',
      'Mis eventos',
      'Ponentes',
      'Sedes y salas',
      'Usuarios y roles',
      // Present in development and in the local stack image (VITE_ENABLE_LAB).
      'Laboratorio',
    ],
    hidden: [],
  },
]

for (const { role, email, sections, hidden } of roles) {
  test(`${role}: navega por sus secciones`, async ({ page }) => {
    await logIn(page, email)
    await expectAccessible(page)

    for (const section of sections) {
      const nav = await navigation(page)
      await nav.getByRole('link', { name: section, exact: true }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: section }),
      ).toBeVisible()
      // Wait for the data, not just the heading.
      await expect(page.locator('[aria-busy]')).toHaveCount(0)
      await expectAccessible(page)
      await expectNoOverflow(page)
    }

    const nav = await navigation(page)
    for (const section of hidden) {
      await expect(
        nav.getByRole('link', { name: section, exact: true }),
      ).toHaveCount(0)
    }
  })
}

test('un evento se abre desde la lista y vuelve atrás', async ({ page }) => {
  await logIn(page, 'carla@demo.example.com')
  await page.goto('/eventos')
  const first = page
    .getByRole('main')
    .getByRole('listitem')
    .first()
    .getByRole('link')
  const title = await first.textContent()
  await first.click()

  await expect(
    page.getByRole('heading', { level: 1, name: title ?? '' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Tu inscripción' }),
  ).toBeVisible()
  await expectAccessible(page)
  await expectNoOverflow(page)
  await page.getByRole('link', { name: 'Volver a eventos' }).click()
  await expect(page).toHaveURL(/\/eventos$/)
})

test('los diálogos se usan con el teclado', async ({ page }) => {
  await logIn(page, 'ana@demo.example.com')
  await page.goto('/ponentes')
  const create = page.getByRole('button', { name: 'Nuevo ponente' })

  await create.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Nuevo ponente' })
  await expect(dialog).toBeVisible()
  // Focus moves inside, and Escape closes and gives it back.
  await expect(dialog.getByLabel('Nombre completo')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(create).toBeFocused()
})
