# Frontend Integration: store-sale & land-sale Real Estate Categories

**Date**: 2026-04-10  
**Status**: Complete  
**Scope**: Frontend type extensions, metadata additions, Vue component updates, test fixes  
**Reference**: `_workspace/re-schema-spec.md` (backend schema phase)

---

## 1. Overview

This document summarizes the frontend integration for two new real estate sale-only categories:
- **store-sale** (상가·업무용 부동산 매매)
- **land-sale** (토지 매매)

Both categories are "sale-only" — they do not support rent (전월세) transactions. The frontend implementation adds:
1. Type system extensions (RealEstatePropertyType, RealEstateCategory, slugs)
2. Helper function `isSaleOnly()` to guard rent mode availability
3. Metadata & FAQs for each category
4. Vue component updates with conditional rent tab disabling
5. Test expectation updates (6 → 8 categories)

**Key Pattern**: Component-level guard via `TransactionModeTab` `disableRent` prop prevents null `apiSlug` condition by disabling rent selection at the UI level.

---

## 2. Type System Changes

### File: `frontend/types/realEstate.ts`

#### 2.1 RealEstatePropertyType Extended
```typescript
export type RealEstatePropertyType = 'apt' | 'villa' | 'offitel' | 'store' | 'land'
```
Added: `'store'` (상가), `'land'` (토지)

#### 2.2 RealEstateCategory Extended
```typescript
export type RealEstateCategory = 
  | 'aptSale' | 'aptRent' 
  | 'villaSale' | 'villaRent' 
  | 'offitelSale' | 'offitelRent' 
  | 'storeSale'            // NEW
  | 'landSale'             // NEW
```

#### 2.3 PROPERTY_TYPES & SALE_ONLY_PROPERTY_TYPES Constants
```typescript
export const PROPERTY_TYPES = ['apt', 'villa', 'offitel', 'store', 'land'] as const

export const SALE_ONLY_PROPERTY_TYPES = ['store', 'land'] as const
```

#### 2.4 isSaleOnly() Helper Function
```typescript
export function isSaleOnly(pt: RealEstatePropertyType): boolean {
  return (SALE_ONLY_PROPERTY_TYPES as readonly string[]).includes(pt)
}
```
Returns `true` for 'store' and 'land', `false` for 'apt', 'villa', 'offitel'.

#### 2.5 Category ↔ Slug Mapping Tables
```typescript
const CATEGORY_TO_SLUG_MAP: Record<RealEstateCategory, RealEstateType> = {
  // ... existing 6 entries ...
  storeSale: 'store-sale',   // NEW
  landSale: 'land-sale',     // NEW
}

const SLUG_TO_CATEGORY_MAP: Record<RealEstateType, RealEstateCategory> = {
  // ... existing 6 entries ...
  'store-sale': 'storeSale',  // NEW
  'land-sale': 'landSale',    // NEW
}
```

#### 2.6 REAL_ESTATE_CATEGORIES & REAL_ESTATE_TYPES Arrays (8 entries each)
```typescript
export const REAL_ESTATE_CATEGORIES: readonly RealEstateCategory[] = [
  'aptSale', 'aptRent', 'villaSale', 'villaRent', 
  'offitelSale', 'offitelRent', 
  'storeSale', 'landSale'  // NEW
] as const

export const REAL_ESTATE_TYPES: readonly RealEstateType[] = [
  'apt-sale', 'apt-rent', 'villa-sale', 'villa-rent',
  'offitel-sale', 'offitel-rent',
  'store-sale', 'land-sale'  // NEW
] as const
```

#### 2.7 toApiSlug() Function Behavior
```typescript
export function toApiSlug(pt: RealEstatePropertyType, mode: TransactionMode): RealEstateType | null {
  if (mode === 'rent' && isSaleOnly(pt)) return null  // NEW: prevents invalid combinations
  return `${pt}-${mode}` as RealEstateType
}
```
Returns `null` when attempting to request rent data for store/land. Prevents invalid API calls.

---

## 3. Metadata & FAQs

### File: `frontend/utils/realEstateMeta.ts`

#### 3.1 PROPERTY_TYPE_META
Added entries for 'store' and 'land' with labels, icons, and descriptions:

```typescript
const PROPERTY_TYPE_META: Record<RealEstatePropertyType, { label: string; icon: string; description: string }> = {
  // ... existing 3 entries ...
  store: {
    label: '상가',
    icon: 'ShoppingCart',
    description: '상가·업무용 부동산 매매'
  },
  land: {
    label: '토지',
    icon: 'Soild',
    description: '토지 매매'
  },
}
```

#### 3.2 PROPERTY_TYPE_FAQ
Added 5-7 FAQs per category:

**store-sale FAQs** (6 entries):
- 상가 투자 시 확인해야 할 사항
- 주용도가 중요한 이유
- 집합건물과 일반건물의 차이
- 임차인 정보 확인 방법
- 상가 가격 비교 기준
- 향후 발전성 평가 방법

**land-sale FAQs** (7 entries):
- 토지 매입 시 확인해야 할 사항
- 용도지역이 중요한 이유
- 지분 거래와 전체 거래의 차이
- 토지 지목 종류와 의미
- 토지 가격 결정 요소
- 개발 가능성 평가 방법
- 장기 투자 고려사항

#### 3.3 PROPERTY_TYPE_DESCRIPTIONS
Added long-form descriptions for store and land sales:

**store**: Covers investment points (traffic, visibility, lease history), field-specific info (building use, class, dong/unit), and decision factors.

**land**: Covers land characteristics (size, category, use zone), share trading mechanics, development potential, and long-term investment strategy.

---

## 4. Vue Component Updates

### 4.1 TransactionModeTab.vue (Shared Component)

**File**: `frontend/components/realEstate/TransactionModeTab.vue`

Added support for disabling the rent tab when property type is sale-only:

```typescript
defineProps<{
  modelValue: TransactionMode
  disableRent?: boolean  // NEW: controls rent button disabled state
}>()
```

**Template Changes**:
```vue
<button
  :disabled="tab.value === 'rent' && disableRent"  <!-- NEW: conditional disable -->
  :class="[
    'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
    'disabled:cursor-not-allowed disabled:opacity-50',  <!-- NEW: disabled styles -->
    modelValue === tab.value
      ? 'bg-white text-primary shadow-sm'
      : 'text-slate-500 hover:text-slate-700 disabled:hover:text-slate-500',  <!-- NEW: disabled hover -->
  ]"
  @click="tab.value !== 'rent' || !disableRent ? $emit('update:modelValue', tab.value) : null"  <!-- NEW: check disableRent -->
>
```

**Disabled State Styling**:
- `disabled:cursor-not-allowed` — prevents click cursor
- `disabled:opacity-50` — fades the button
- `disabled:hover:text-slate-500` — ensures hover state respects disabled state

---

### 4.2 Real Estate Pages

#### 4.2.1 `/real-estate/[propertyType]/index.vue`

**Edit 1** (line ~155): Import isSaleOnly
```typescript
// Before
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'

// After
import { toApiSlug, PROPERTY_TYPES, isSaleOnly } from '~/types/realEstate'
```

**Edit 2** (after line ~395): Add computed property
```typescript
const isSaleOnlyType = computed(() => isSaleOnly(propertyTypeParam.value))
```
Placed immediately before the `apiSlug` computed property for logical grouping.

**Edit 3** (line ~310): Update TransactionModeTab binding
```vue
<!-- Before -->
<TransactionModeTab v-model="currentTab" class="mb-6" />

<!-- After -->
<TransactionModeTab v-model="currentTab" :disable-rent="isSaleOnlyType" class="mb-6" />
```

#### 4.2.2 `/real-estate/[propertyType]/[buildingName].vue`

**Edit 1** (line 386): Import isSaleOnly
```typescript
// Before
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'

// After
import { toApiSlug, PROPERTY_TYPES, isSaleOnly } from '~/types/realEstate'
```

**Edit 2** (after line 412): Add computed property
```typescript
const isSaleOnlyType = computed(() => isSaleOnly(propertyTypeParam.value))
```
Inserted between `apiSlug` and `propertyMeta` computed properties.

**Edit 3** (line 200): Update TransactionModeTab binding
```vue
<!-- Before -->
<TransactionModeTab v-model="currentTab" class="mb-6" />

<!-- After -->
<TransactionModeTab v-model="currentTab" :disable-rent="isSaleOnlyType" class="mb-6" />
```

---

## 5. Test Updates

### File: `frontend/tests/types/realEstate.test.ts`

#### 5.1 REAL_ESTATE_CATEGORIES Test (lines 77–88)
```typescript
it('8개 카테고리를 포함해야 한다', () => {
  expect(REAL_ESTATE_CATEGORIES).toHaveLength(8)  // Changed: 6 → 8
})

it('모든 카테고리 값을 포함해야 한다', () => {
  const expected: RealEstateCategory[] = [
    'aptSale', 'aptRent', 'villaSale', 'villaRent',
    'offitelSale', 'offitelRent',
    'storeSale', 'landSale'  // NEW entries
  ]
  expected.forEach((cat) => {
    expect(REAL_ESTATE_CATEGORIES).toContain(cat)
  })
})
```

#### 5.2 REAL_ESTATE_TYPES Test (lines 90–100)
```typescript
it('8개 타입(slug)을 포함해야 한다', () => {
  expect(REAL_ESTATE_TYPES).toHaveLength(8)  // Changed: 6 → 8
})

it('모든 slug 값을 포함해야 한다', () => {
  const expected: RealEstateType[] = [
    'apt-sale', 'apt-rent', 'villa-sale', 'villa-rent',
    'offitel-sale', 'offitel-rent',
    'store-sale', 'land-sale'  // NEW entries
  ]
  expected.forEach((slug) => {
    expect(REAL_ESTATE_TYPES).toContain(slug)
  })
})
```

**Round-trip Conversion Tests**: Automatically pass because `categoryToSlug()` and `slugToCategory()` use the mapping tables with all 8 entries.

---

## 6. Architecture & Design Rationale

### 6.1 Sale-Only Guard Pattern

**Problem**: Store and land are sale-only. Attempting `toApiSlug('store', 'rent')` returns `null`. The UI must prevent users from selecting rent mode for these types.

**Solution**: Component-level guard via `disableRent` prop
```typescript
// In page component
const isSaleOnlyType = computed(() => isSaleOnly(propertyTypeParam.value))

// In template
<TransactionModeTab v-model="currentTab" :disable-rent="isSaleOnlyType" />

// In TransactionModeTab.vue
<button :disabled="tab.value === 'rent' && disableRent">
```

**Benefits**:
- **UX**: Visual feedback (disabled button, reduced opacity, changed cursor)
- **Data flow**: Single source of truth (`isSaleOnly` helper)
- **Testability**: Easy to verify via E2E tests
- **Encapsulation**: Component doesn't need to know why rent is disabled, only that it is

### 6.2 Type Safety

All transformations (`toApiSlug`, `propertyTypeToRentSlug`, `categoryToSlug`) return `RealEstateType | null`, forcing callers to handle the null case. The Vue binding pattern prevents the null from reaching the API layer.

### 6.3 Metadata Consistency

FAQs and descriptions are co-located in `realEstateMeta.ts` with property type labels, ensuring single source of truth for UX copy.

---

## 7. Verification Results

### Build
```bash
npm run build
# ✓ Frontend builds without errors (35.4 MB total)
```

### Tests
```bash
npm run test
# ✓ 613 tests pass across 65 test files
# ✓ realEstate.test.ts: all 9 describe blocks pass
#   - categoryToSlug: 7 tests
#   - slugToCategory: 7 tests
#   - REAL_ESTATE_CATEGORIES: 2 tests (now expect 8 categories)
#   - REAL_ESTATE_TYPES: 2 tests (now expect 8 types)
#   - Round-trip conversions: 2 tests
```

### Import Verification
```bash
grep -r "isSaleOnly" frontend/pages/real-estate/
# ✓ Both index.vue and [buildingName].vue import and use isSaleOnly

grep -r "disable-rent" frontend/
# ✓ Both page files bind :disable-rent="isSaleOnlyType" to TransactionModeTab
```

---

## 8. Files Modified Summary

| File | Changes | Lines |
|------|---------|-------|
| `frontend/types/realEstate.ts` | Type/constant additions, mapping tables, helper function | ~25 |
| `frontend/utils/realEstateMeta.ts` | PROPERTY_TYPE_META, FAQ, descriptions | ~40 |
| `frontend/components/realEstate/TransactionModeTab.vue` | disableRent prop, disabled button binding | 4 |
| `frontend/pages/real-estate/[propertyType]/index.vue` | isSaleOnly import, computed property, disable-rent binding | 3 |
| `frontend/pages/real-estate/[propertyType]/[buildingName].vue` | isSaleOnly import, computed property, disable-rent binding | 3 |
| `frontend/tests/types/realEstate.test.ts` | Test expectations: 6→8 categories/types, added storeSale/landSale | 2 |

**Total Changes**: ~77 lines across 6 files

---

## 9. Integration Checklist

- [x] RealEstatePropertyType extended with 'store' and 'land'
- [x] RealEstateCategory extended with 'storeSale' and 'landSale'
- [x] SALE_ONLY_PROPERTY_TYPES constant defined
- [x] isSaleOnly() helper function implemented
- [x] Category ↔ slug mapping tables updated (8 entries each)
- [x] toApiSlug() handles sale-only guard (returns null for invalid combos)
- [x] REAL_ESTATE_CATEGORIES and REAL_ESTATE_TYPES arrays extended to 8
- [x] PROPERTY_TYPE_META entries added for store and land
- [x] PROPERTY_TYPE_FAQ entries added (6–7 FAQs per category)
- [x] PROPERTY_TYPE_DESCRIPTIONS added for store and land
- [x] TransactionModeTab.vue disableRent prop implemented
- [x] Both real-estate pages updated with isSaleOnly import and disable-rent binding
- [x] Test expectations updated (6→8)
- [x] All 613 tests pass
- [x] Build succeeds without errors

---

## 10. Next Steps (Backend Expander Phase)

Once backend schema and sync scripts are complete:
1. Verify API returns correct transaction data for store-sale and land-sale
2. Test round-trip: navigate to `/real-estate/store/building-name` → API call validates
3. Verify disabled rent tab prevents accidental API calls on sale-only types
4. E2E test: store/land routes are accessible and render correctly

---

## 11. Reference Links

- **Type Definition**: `frontend/types/realEstate.ts:1–295`
- **Metadata**: `frontend/utils/realEstateMeta.ts`
- **TransactionModeTab**: `frontend/components/realEstate/TransactionModeTab.vue`
- **Pages**: 
  - `frontend/pages/real-estate/[propertyType]/index.vue`
  - `frontend/pages/real-estate/[propertyType]/[buildingName].vue`
- **Tests**: `frontend/tests/types/realEstate.test.ts`
- **Backend Schema Spec**: `_workspace/re-schema-spec.md`
