# Mobile Compact Ads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact mobile AdSense variant that avoids large empty space under short filled creatives.

**Architecture:** Extend the existing `AdBanner` component with a narrow `variant` prop rather than adding a second ad component. Keep the current request, timeout, unfilled, route-refresh, and viewport-gating logic unchanged; only alter slot style/class defaults when `variant="compact-mobile"` is used.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, Tailwind/CSS, Vitest + Vue Test Utils.

---

## File Structure

- Modify: `frontend/components/ads/AdBanner.vue`
  - Adds `variant?: 'default' | 'compact-mobile'` prop.
  - Computes compact slot style, full-width responsive flag, and wrapper class.
  - Adds CSS for `.ad-banner--compact-mobile` with `min-height:150px` and centered slot.
- Modify: `frontend/tests/components/ads/AdBanner.test.ts`
  - Adds failing tests for compact mobile slot output.
  - Keeps existing default behavior assertions.
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
  - Applies `variant="compact-mobile"` to real-estate detail inline ads where mobile blank space is visible.

## Tasks

### Task 1: Lock compact variant contract in tests

**Files:**
- Modify: `frontend/tests/components/ads/AdBanner.test.ts`

- [ ] **Step 1: Add failing compact variant tests**

Add tests asserting that `variant="compact-mobile"` renders:

```ts
const wrapper = mount(AdBanner, {
  props: { variant: 'compact-mobile' },
  global: { stubs: { ClientOnly: clientOnlyStub } },
})
await flushAdMount()
expect(wrapper.classes()).toContain('ad-banner--compact-mobile')
const ins = wrapper.get('ins.adsbygoogle')
expect(ins.attributes('style')).toMatch(/height:\s*150px/)
expect(ins.attributes('style')).toMatch(/width:\s*100%/ and /max-width:\s*336px/)
expect(ins.attributes('data-full-width-responsive')).toBe('false')
expect(ins.attributes('data-ad-format')).toBe('horizontal')
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
cd frontend && npm run test -- tests/components/ads/AdBanner.test.ts
```

Expected: FAIL because `variant` prop and compact class/style do not exist yet.

### Task 2: Implement compact variant in AdBanner

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue`

- [ ] **Step 1: Add minimal implementation**

Add `variant` prop, computed class/style defaults, compact CSS, and keep existing default output unchanged.

- [ ] **Step 2: Run targeted tests and verify GREEN**

Run:

```bash
cd frontend && npm run test -- tests/components/ads/AdBanner.test.ts
```

Expected: PASS.

### Task 3: Apply compact variant to real-estate detail ads

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

- [ ] **Step 1: Use compact variant on inline AdBanner placements**

Change real-estate building detail page `AdBanner` calls to include `variant="compact-mobile"` for content-flow placements.

- [ ] **Step 2: Run targeted tests again**

Run:

```bash
cd frontend && npm run test -- tests/components/ads/AdBanner.test.ts
```

Expected: PASS.

### Task 4: Final verification

- [ ] **Step 1: Run frontend lint/test subset**

Run:

```bash
cd frontend && npm run test -- tests/components/ads/AdBanner.test.ts
```

Expected: PASS, no warnings caused by compact variant.

- [ ] **Step 2: Inspect git diff**

Run:

```bash
git diff -- frontend/components/ads/AdBanner.vue frontend/tests/components/ads/AdBanner.test.ts 'frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'
```

Expected: diff is limited to compact variant and real-estate detail ad call sites.
