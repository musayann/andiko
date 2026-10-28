import type { Browser } from "puppeteer-core"

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    })
  }

  const executablePath = process.env.CHROME_EXECUTABLE_PATH
  if (executablePath) {
    return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] })
  }

  // local development: the `puppeteer` dev dependency downloads a matching Chrome
  try {
    const bundled = (await import("puppeteer")).default
    return (await bundled.launch({ headless: true })) as unknown as Browser
  } catch (error) {
    throw new Error(
      "No Chrome found for PDF export. Set CHROME_EXECUTABLE_PATH or install the `puppeteer` package.",
      { cause: error },
    )
  }
}

let browser: Promise<Browser> | null = null

/** Shared headless browser, launched on first use and relaunched if it dies. */
export async function getBrowser(): Promise<Browser> {
  if (browser) {
    const current = await browser.catch(() => null)
    if (current?.connected) return current
  }
  browser = launch()
  browser.then(
    (instance) => instance.on("disconnected", () => (browser = null)),
    () => (browser = null),
  )
  return browser
}
