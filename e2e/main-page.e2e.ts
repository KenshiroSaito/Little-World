import { expect, test as base, type Locator, type Page } from '@playwright/test'

/**
 * Every test fails if the page throws, logs a console error, or one of the
 * site's own files fails to load. Each test starts with an empty save.
 */
const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page, baseURL }, use) => {
      const errors: string[] = []
      const origin = new URL(baseURL!).origin
      page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console error: ${message.text()}`)
      })
      page.on('response', (response) => {
        if (response.status() >= 400 && new URL(response.url()).origin === origin) {
          errors.push(`HTTP ${response.status()}: ${response.url()}`)
        }
      })
      await use(errors)
      expect(errors, 'the page reported errors').toEqual([])
    },
    { auto: true },
  ],
})

const lp = (page: Page) => page.locator('.hud-lp')
const hudButton = (page: Page, name: string) => page.locator('.hud').getByRole('button', { name, exact: true })
const growButton = (page: Page) => page.getByRole('button', { name: 'Grow the tree by 10 leaves' })
const activityCard = (panel: Locator, label: string) =>
  panel.locator('.activity-card').filter({ has: panel.page().getByText(label, { exact: true }) })

/** Open the title screen and enter the tree. */
async function enterTree(page: Page, path = './') {
  await page.goto(path)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('application')).toBeVisible()
}

async function openSelfCare(page: Page) {
  await hudButton(page, 'Self-Care').click()
  const panel = page.getByRole('dialog', { name: 'Self-Care' })
  await expect(panel).toBeVisible()
  return panel
}

/** How many distinct colours a sample of the canvas's pixels has; a blank canvas has one. */
async function canvasColours(page: Page) {
  const png = await page.getByRole('application').screenshot()
  return page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    const colours = new Set<number>()
    for (let i = 0; i < data.length; i += 4 * 97) colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
    return colours.size
  }, png.toString('base64'))
}

test.describe('title screen', () => {
  test('loads the app and offers Start on a new save', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Little World' })).toBeVisible()
    await expect(page.getByText('Take care of yourself. Watch what grows.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  })

  test('offers Continue once a save exists, and keeps the progress', async ({ page }) => {
    await enterTree(page)
    const panel = await openSelfCare(page)
    await panel.getByRole('button', { name: 'Record Walk, plus 5 LP' }).click()
    await expect(lp(page)).toHaveText('5 LP')

    await page.reload()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(lp(page)).toHaveText('5 LP')
  })
})

test.describe('tree view', () => {
  test('Start opens an empty tree with the toolbar and a drawn canvas', async ({ page }) => {
    await enterTree(page)
    await expect(lp(page)).toHaveText('0 LP')
    for (const name of ['Self-Care', 'Paint', 'Shop', 'Journal', 'Relics', 'Settings', 'Zoom in', 'Zoom out', 'Fit tree']) {
      await expect(hudButton(page, name)).toBeVisible()
    }
    await expect(growButton(page)).toBeVisible()

    const box = await page.getByRole('application').boundingBox()
    expect(box!.width).toBeGreaterThan(100)
    expect(box!.height).toBeGreaterThan(100)
    await expect.poll(() => canvasColours(page), { message: 'the canvas should not be blank' }).toBeGreaterThan(10)
  })

  test('zoom, fit and keyboard controls run without errors', async ({ page }) => {
    await enterTree(page)
    await hudButton(page, 'Zoom in').click()
    await hudButton(page, 'Zoom out').click()
    await hudButton(page, 'Fit tree').click()
    await page.getByRole('application').focus()
    for (const key of ['ArrowRight', 'ArrowLeft', 'Space', 'ArrowUp', 'ArrowDown', 'e', '+', '-', 'f']) {
      await page.keyboard.press(key)
    }
    await expect(page.getByRole('application')).toBeVisible()
  })
})

test.describe('self-care', () => {
  test('each record earns 5 LP and the panel stays open', async ({ page }) => {
    await enterTree(page)
    const panel = await openSelfCare(page)
    await expect(panel.getByText('Every act of care counts. Nothing is lost when you rest.')).toBeVisible()

    const walk = activityCard(panel, 'Walk')
    await panel.getByRole('button', { name: 'Record Walk, plus 5 LP' }).click()
    await expect(lp(page)).toHaveText('5 LP')
    await expect(walk.getByText('✓ Done today', { exact: true })).toBeVisible()

    await panel.getByRole('button', { name: 'Record Walk, plus 5 LP' }).click()
    await expect(lp(page)).toHaveText('10 LP')
    await expect(walk.getByText('✓ Done today ×2')).toBeVisible()

    await panel.getByRole('button', { name: 'Record Connect, plus 5 LP' }).click()
    await panel.getByRole('button', { name: 'Record Take a Break, plus 5 LP' }).click()
    await expect(lp(page)).toHaveText('20 LP')
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: 'Close' }).click()
    await expect(panel).toBeHidden()
  })

  test('a reflection keeps its text and mood, and shows in Journal and Relics', async ({ page }) => {
    const text = 'Called my sister after class'
    await enterTree(page)
    const panel = await openSelfCare(page)
    await panel.getByRole('button', { name: 'Record Reflect, plus 5 LP' }).click()

    await panel.getByLabel(/One sentence about how you are today/).fill(text)
    await expect(panel.getByText(`${text.length} / 120`)).toBeVisible()
    const calm = panel.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Calm' })
    await calm.click()
    await expect(calm).toHaveAttribute('aria-pressed', 'true')

    await panel.getByRole('button', { name: 'Save reflection · +5 LP' }).click()
    await expect(lp(page)).toHaveText('5 LP')
    await expect(panel.getByRole('button', { name: 'Save reflection · +5 LP' })).toBeHidden()
    await expect(activityCard(panel, 'Reflect').getByText('✓ Done today')).toBeVisible()
    await panel.getByRole('button', { name: 'Close' }).click()

    await hudButton(page, 'Journal').click()
    const journal = page.getByRole('dialog', { name: 'Journal' })
    await expect(journal.getByText('Page 1 of 1')).toBeVisible()
    await expect(journal.getByRole('button', { name: /^Reflect at .* Show its leaves on the tree\.$/ })).toBeVisible()
    await expect(journal.getByText(`“${text}”`)).toBeVisible()
    await expect(journal.getByText('Feeling calm')).toBeVisible()
    await journal.getByRole('button', { name: 'Done' }).click()
    await expect(journal).toBeHidden()

    await hudButton(page, 'Relics').click()
    const relics = page.getByRole('dialog', { name: 'Relics' })
    await expect(relics.getByText(`“${text}”`)).toBeVisible()
    await expect(relics.locator('.mood-tag')).toHaveText('Calm')
    await relics.getByRole('button', { name: 'Find in the roots' }).click()
    await expect(relics).toBeHidden()
  })

  test('reflection text stops at 120 characters', async ({ page }) => {
    await enterTree(page)
    const panel = await openSelfCare(page)
    await panel.getByRole('button', { name: 'Record Reflect, plus 5 LP' }).click()
    const input = panel.getByLabel(/One sentence about how you are today/)
    await input.pressSequentially('a'.repeat(130))
    await expect(input).toHaveValue('a'.repeat(120))
    await expect(panel.getByText('120 / 120')).toBeVisible()
  })
})

test.describe('growth', () => {
  test('Grow ×10 adds 50 LP, unlocks every colour and reveals both relics', async ({ page }) => {
    await enterTree(page)
    await growButton(page).click()
    await expect(lp(page)).toHaveText('50 LP')
    await expect(page.getByText('+10 leaves')).toBeVisible()

    await hudButton(page, 'Relics').click()
    const relics = page.getByRole('dialog', { name: 'Relics' })
    await expect(relics.getByText('Carved Stone')).toBeVisible()
    await expect(relics.getByText('Heartwood Relic')).toBeVisible()
    await expect(relics.getByRole('button', { name: 'Find in the roots' })).toHaveCount(2)
    await relics.getByRole('button', { name: 'Close' }).click()

    await hudButton(page, 'Paint').click()
    const palette = page.getByRole('toolbar', { name: 'Leaf colours' })
    for (const name of ['Base green', 'Spring green', 'Sunset orange', 'Teal', 'Lavender']) {
      await expect(palette.getByRole('button', { name })).toBeVisible()
    }
  })

  test('the spirit speaks after several records and can be dismissed', async ({ page }) => {
    await enterTree(page)
    await growButton(page).click()
    const bubble = page.locator('.spirit-bubble')
    await expect(bubble).toHaveText('You went for 3 walks this week. The roots felt every step.')
    await bubble.getByRole('button', { name: "Dismiss the spirit's message" }).click()
    await expect(bubble).toBeHidden()
  })
})

test.describe('panels', () => {
  test('Paint: presets, colour mixer, undo state and Done', async ({ page }) => {
    await enterTree(page)
    await hudButton(page, 'Paint').click()
    await expect(hudButton(page, 'Paint')).toHaveAttribute('aria-pressed', 'true')

    const palette = page.getByRole('toolbar', { name: 'Leaf colours' })
    await expect(palette.getByRole('button', { name: 'Base green' })).toHaveAttribute('aria-pressed', 'true')
    await expect(palette.getByRole('button', { name: 'Undo' })).toBeDisabled()

    await palette.getByRole('button', { name: 'Mix' }).click()
    const mixer = palette.getByRole('group', { name: 'Mix a colour' })
    await expect(mixer.locator('.mixer-hex')).toHaveText('#ff6fa8')
    await mixer.getByRole('slider').first().fill('0')
    await expect(mixer.locator('.mixer-hex')).toHaveText('#006fa8')
    await expect(palette.getByRole('button', { name: 'Mix' })).toHaveAttribute('aria-pressed', 'true')

    await palette.getByRole('button', { name: 'Done' }).click()
    await expect(palette).toBeHidden()
    await expect(hudButton(page, 'Paint')).toHaveAttribute('aria-pressed', 'false')
  })

  test('Shop: locked with no LP, buying spends LP and the item can be placed', async ({ page }) => {
    await enterTree(page)
    await hudButton(page, 'Shop').click()
    let shop = page.getByRole('dialog', { name: 'Shop' })
    await expect(shop.getByText('0 LP available')).toBeVisible()
    await expect(shop.getByRole('button', { name: /^Buy .* for \d+ LP$/ }).first()).toBeDisabled()
    await expect(shop.getByRole('button', { name: 'Need 5 LP' }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(shop).toBeHidden()

    await growButton(page).click()
    await expect(lp(page)).toHaveText('50 LP')
    await hudButton(page, 'Shop').click()
    shop = page.getByRole('dialog', { name: 'Shop' })
    await expect(shop.getByText('50 LP available')).toBeVisible()

    const buy = shop.getByRole('button', { name: /^Buy .* for \d+ LP$/ }).first()
    const price = Number((await buy.getAttribute('aria-label'))!.match(/for (\d+) LP$/)![1])
    await buy.click()
    await expect(shop.getByText(`${50 - price} LP available`)).toBeVisible()
    await expect(lp(page)).toHaveText(`${50 - price} LP`)

    await shop.getByRole('button', { name: 'My items (1)' }).click()
    await expect(shop.getByText('Ready to place')).toBeVisible()
    await shop.getByRole('button', { name: 'Place' }).click()
    await expect(shop).toBeHidden()
    const placing = page.getByText('Click a leafy branch to place your item.')
    await expect(placing).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(placing).toBeHidden()

    // Spending LP does not undo growth.
    await hudButton(page, 'Relics').click()
    await expect(page.getByRole('dialog', { name: 'Relics' }).getByText('Heartwood Relic')).toBeVisible()
  })

  test('Journal: empty book, page arrows and closing', async ({ page }) => {
    await enterTree(page)
    await hudButton(page, 'Journal').click()
    const journal = page.getByRole('dialog', { name: 'Journal' })
    await expect(journal.getByText(/^This book is empty\./)).toBeVisible()
    await expect(journal.getByText('Page 1 of 1')).toBeVisible()
    await expect(journal.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await expect(journal.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(journal).toBeHidden()
  })

  test('Relics: empty state before any reflection', async ({ page }) => {
    await enterTree(page)
    await hudButton(page, 'Relics').click()
    const relics = page.getByRole('dialog', { name: 'Relics' })
    await expect(relics.getByText('No keepsakes yet. Choose Reflect in Self-Care to bury your first.')).toBeVisible()
    await expect(relics.getByText('Found in the roots')).toBeHidden()
  })

  test('Settings: toggles, support links and reset with confirmation', async ({ page }) => {
    await enterTree(page)
    const selfCare = await openSelfCare(page)
    await selfCare.getByRole('button', { name: 'Record Walk, plus 5 LP' }).click()
    await expect(lp(page)).toHaveText('5 LP')

    await hudButton(page, 'Settings').click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    const spirit = settings.getByRole('checkbox', { name: 'Tree spirit' })
    const motion = settings.getByRole('checkbox', { name: 'Reduced motion' })
    await expect(spirit).toBeChecked()
    await expect(motion).not.toBeChecked()
    await motion.check()
    await expect(motion).toBeChecked()
    await expect(settings.getByText(/UVic Counselling Services/)).toBeVisible()
    await expect(settings.getByText(/9-8-8/)).toBeVisible()

    page.once('dialog', (dialog) => dialog.dismiss())
    await settings.getByRole('button', { name: 'Reset save' }).click()
    await expect(lp(page)).toHaveText('5 LP')
    await expect(settings).toBeVisible()

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('Reset your tree? This deletes all progress on this device.')
      return dialog.accept()
    })
    await settings.getByRole('button', { name: 'Reset save' }).click()
    await expect(lp(page)).toHaveText('0 LP')
    await expect(settings).toBeHidden()

    await hudButton(page, 'Settings').click()
    await expect(settings.getByRole('checkbox', { name: 'Reduced motion' })).not.toBeChecked()
  })
})

test.describe('sound', () => {
  test('the music loops from Start and the spirit makes a sound when it jumps', async ({ page }) => {
    // Note each sound the page plays; headless browsers have no speakers to listen to.
    await page.addInitScript(() => {
      const played: { src: string; loop: boolean }[] = []
      Object.assign(window, { played })
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        played.push({ src: this.currentSrc || this.src, loop: this.loop })
        return play.call(this)
      }
    })
    const played = () => page.evaluate(() => (window as unknown as { played: { src: string; loop: boolean }[] }).played)

    await enterTree(page)
    await expect.poll(played).toEqual([{ src: expect.stringMatching(/lovely-garden[^/]*\.mp3$/), loop: true }])

    await page.getByRole('application').focus()
    await expect(async () => {
      await page.keyboard.press('Space')
      expect(await played()).toContainEqual({ src: expect.stringMatching(/jump[^/]*\.mp3$/), loop: false })
    }).toPass()
  })
})

test.describe('demo mode', () => {
  test('?demo=1 shows Next day and Reset controls', async ({ page }) => {
    await enterTree(page, './?demo=1')
    const demo = page.getByLabel('Demo controls')
    await expect(demo.getByText('Demo · day +0')).toBeVisible()
    await demo.getByRole('button', { name: 'Next day' }).click()
    await expect(demo.getByText('Demo · day +1')).toBeVisible()

    await growButton(page).click()
    await expect(lp(page)).toHaveText('50 LP')
    await demo.getByRole('button', { name: 'Reset' }).click()
    await expect(lp(page)).toHaveText('0 LP')
    await expect(demo.getByText('Demo · day +0')).toBeVisible()
  })
})
