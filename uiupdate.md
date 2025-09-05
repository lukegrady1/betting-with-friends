# UI Update v2 — Fix Duplicates, Wire Theme Colors, and Add Playwright MCP Tests

> **Goal:** Resolve duplicate rendering on the Sign In page, ensure brand colors are applied, and ship a modern Sign In + base layout using **shadcn/ui** with Tailwind. Include Playwright MCP tests. Keep everything mobile‑first.

---

## 1) Why you’re seeing duplicates (and how to stop it)

Common causes of a page rendering twice:

1. **Component mounted twice in the route tree** (e.g., `SignInPage` referenced both directly in `App.tsx` and again in the router).
2. **Nested routes with the same element** (e.g., wrapping the sign‑in route inside `AppLayout` and also returning `SignInPage` inside `AppLayout`).
3. **Two roots in `index.html`** (ensure only one `#root`).
4. **Rendering router twice** (e.g., `RouterProvider` inside `main.tsx` and again in `App.tsx`).

### Fix checklist

* `index.html` has exactly **one** `div#root`.
* `main.tsx` renders **only** `<RouterProvider router={router} />` once. No direct `<SignInPage/>` here.
* `AppLayout` contains **TopBar/BottomNav + `<Outlet/>` only**; no page bodies baked in.
* `SignInPage` appears **once** in routing config (public route), not also imported and used somewhere else.

---

## 2) Wire the brand colors so Tailwind + shadcn show color

You’re seeing “no color” because the theme variables and Tailwind file likely aren’t imported or the config globs miss your files.

### 2.1 Ensure Tailwind is active

**postcss.config.js**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

**tailwind.config.ts**

```ts
import { fontFamily } from "tailwindcss/defaultTheme";
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      fontFamily: { sans: ["Inter", ...fontFamily.sans] },
      borderRadius: { lg: "var(--radius)", xl: "calc(var(--radius)+.25rem)", "2xl": "calc(var(--radius)+.5rem)" },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        spinSmooth: { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
        spinSmooth: "spinSmooth 1.2s linear infinite",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--background))", foreground: "hsl(var(--foreground))" },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

**src/styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Brand: #252525, #60CBFF, #3664F4, #E85353 */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 12%; /* ≈ #1F1F1F */

  --primary: 225 90% 58%;      /* #3664F4 */
  --primary-foreground: 0 0% 100%;

  --secondary: 200 100% 69%;   /* #60CBFF */
  --secondary-foreground: 222 47% 11%;

  --accent: 200 100% 69%;
  --accent-foreground: 222 47% 11%;

  --destructive: 0 76% 62%;    /* #E85353 */
  --destructive-foreground: 0 0% 100%;

  --muted: 0 0% 96%;
  --muted-foreground: 0 0% 42%;

  --border: 0 0% 88%;
  --input: 0 0% 92%;
  --ring: 225 90% 58%;

  --radius: 1rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 9%;   /* ≈ #171717 (close to #252525 family) */
    --foreground: 0 0% 96%;
    --muted: 0 0% 14%;
    --muted-foreground: 0 0% 70%;
    --border: 0 0% 18%;
    --input: 0 0% 18%;
  }
}

html, body, #root { height: 100%; }
body { @apply bg-background text-foreground antialiased; }
.container-responsive { @apply mx-auto w-full max-w-screen-sm px-3 sm:max-w-screen-md md:max-w-screen-lg; }
.card { @apply rounded-2xl border bg-card text-card-foreground shadow-sm; }
.soft { box-shadow: 0 1px 2px hsl(0 0% 0% / 0.05), 0 8px 40px hsl(225 90% 20% / 0.08); }
.badge { @apply inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs; }
```

**src/main.tsx** (import the CSS **once**)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

---

## 3) Routing: isolate Sign In so it renders once

**src/router.tsx**

```tsx
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./shells/AppLayout";
import { AuthLayout } from "./shells/AuthLayout";
import SignInPage from "./routes/auth/SignInPage";
import LeaguesPage from "./routes/leagues/LeaguesPage";

export const router = createBrowserRouter([
  { path: "/auth/signin", element: <AuthLayout><SignInPage/></AuthLayout> },
  {
    path: "/",
    element: <AppLayout/>,
    children: [
      { index: true, element: <LeaguesPage/> },
      { path: "leagues", element: <LeaguesPage/> },
      // ...other protected routes
    ],
  },
]);
```

**src/shells/AppLayout.tsx**

```tsx
import { Outlet } from "react-router-dom";
import TopBar from "../components/Layout/TopBar";
import BottomNav from "../components/Layout/BottomNav";

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="container-responsive pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

**src/shells/AuthLayout.tsx**

```tsx
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 p-4">
      <div className="card soft w-full max-w-sm p-6">{children}</div>
    </div>
  );
}
```

---

## 4) Modern Sign In (single instance, shadcn styled)

**src/routes/auth/SignInPage.tsx**

```tsx
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const disabled = email.trim().length === 0;
  return (
    <Card data-testid="signin-card">
      <CardHeader>
        <CardTitle className="text-2xl">Betting with Friends</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Track your picks privately and securely.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="text-sm font-medium" htmlFor="email">Email Address</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" data-testid="email-input" className="pl-9 h-11 rounded-xl" placeholder="Enter your email address" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <Button data-testid="magic-link" className="h-11 w-full rounded-xl" disabled={disabled}>
          <Lock className="mr-2 h-4 w-4"/> Sign in with Magic Link
        </Button>
        <p className="text-xs text-muted-foreground">We'll send you a secure magic link. No password needed.</p>
      </CardContent>
    </Card>
  );
}
```

> **Important:** Do **not** also render `SignInPage` from `AppLayout` or other routes. It should exist only under `/auth/signin`.

---

## 5) Better loading animation

**src/components/UI/Spinner.tsx**

```tsx
export default function Spinner() {
  return (
    <div className="grid place-items-center p-6" data-testid="spinner">
      <div className="h-10 w-10 animate-spinSmooth rounded-full bg-[conic-gradient(from_0deg,theme(colors.primary)_0%,theme(colors.accent)_40%,theme(colors.secondary)_70%,transparent_100%)] [mask:radial-gradient(farthest-side,transparent_62%,#000_63%)]" />
    </div>
  );
}
```

**Skeletons**

```tsx
export function SkeletonCard() {
  return <div className="card soft h-24 animate-shimmer bg-[linear-gradient(90deg,theme(colors.muted.DEFAULT)_25%,theme(colors.muted.DEFAULT)/60_37%,theme(colors.muted.DEFAULT)_63%)] bg-[length:200%_100%] rounded-2xl" />;
}
```

---

## 6) Playwright MCP tests (basic)

Create `tests/auth.spec.ts`.

```ts
import { test, expect } from "@playwright/test";

test.describe("Sign In", () => {
  test("renders exactly once and has theme colors", async ({ page }) => {
    await page.goto("http://localhost:5173/auth/signin");

    const cards = page.getByTestId("signin-card");
    await expect(cards).toHaveCount(1); // no duplicates

    // Theme variable present (primary ring)
    const hasVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ring").trim().length > 0);
    expect(hasVar).toBeTruthy();

    // Email input present and enabled
    await expect(page.getByTestId("email-input")).toBeVisible();
  });

  test("shows spinner during route change", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    // Trigger route change that would display spinner in your app
    await page.evaluate(() => window.dispatchEvent(new Event("app:start-loading")));
    await expect(page.getByTestId("spinner")).toBeVisible();
  });
});
```

> If using the Playwright MCP, keep tests idempotent and rely on `data-testid` selectors.

---

## 7) QA after applying

* Visually confirm **only one** Sign In card renders.
* Brand colors visible (buttons `bg-primary`, focus rings `ring-primary`).
* Leagues page uses `card soft` pattern (no double borders/heavy lines).
* Skeletons show on initial data loads; spinner only for short async actions.

---

## 8) Notes for Claude Code

* Apply the router split (public `/auth/*` vs app layout).
* Ensure `globals.css` is imported **once** in `main.tsx`.
* Audit for duplicate imports/usages of `SignInPage`.
* Keep all new components typed and use shadcn primitives.
* Preserve existing RLS + data flow — this update is **UI-only**.
