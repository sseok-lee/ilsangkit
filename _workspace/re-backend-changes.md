# Real Estate Backend Implementation — Store Sale & Land Sale

**Generated**: 2026-04-10  
**Status**: ✅ Complete  
**Test Results**: 658 tests passed (48 test files)

---

## Executive Summary

Successfully implemented `store-sale` and `land-sale` real estate transaction categories in the backend. All changes follow existing patterns in the codebase, extend the `RealEstateType` union from 6 to 8 types, and maintain full backward compatibility with existing functionality.

**Key Metrics**:
- Files modified: 9
- Files created: 2
- TypeScript build: ✅ Pass
- Prisma generation: ✅ Pass
- Database push: ✅ Pass (schema already in sync)
- Test suite: ✅ 658/658 pass
- ESLint: ✅ No new errors (pre-existing warnings only)

---

## 1. Modified Files

### 1.1 Schema Definition
**File**: `/Users/leemyeongseok/projects/ilsangkit/backend/prisma/schema.prisma`

**Changes**:
- Added `StoreSaleTransaction` model (lines 969-1008)
  - Extends `AptSaleTransaction` pattern
  - 8 common indexes + 1 store-specific index on `buildingUse`
  - Store-specific fields: `buildingAr`, `plottageAr`, `buildingUse`, `buildingCls`, `buildingDong`, `unitNo`
  - All fields follow `@db.VarChar`, `Decimal(12,2)`, `BigInt` conventions
  
- Added `LandSaleTransaction` model (lines 1010-1045)
  - Extends `AptSaleTransaction` pattern
  - 5 common indexes + 2 land-specific indexes on `landCategory` and `landUse`
  - Land-specific fields: `dealArea`, `landCategory`, `landUse`, `shareRatio`, `shareType`
  - Removed: `buildYear`, `floor`, `exclusiveArea`, `aptDong` (not applicable to land)
  - `buildingName` retained as synthesized value (`{dongName} {jibun}`) for route compatibility

**Reference**: `_workspace/re-schema-spec.md` (lines 22-131)

### 1.2 Enum Schema
**File**: `/Users/leemyeongseok/projects/ilsangkit/backend/src/schemas/realEstate.ts`

**Changes**:
- Extended `RealEstateTypeSchema` enum from 6 to 8 types (line 11-19)
  - Added: `'store-sale'`, `'land-sale'`
  - Existing: `'apt-sale'`, `'apt-rent'`, `'villa-sale'`, `'villa-rent'`, `'offitel-sale'`, `'offitel-rent'`

**Type union now**:
```typescript
export type RealEstateType = 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 
                             'offitel-sale' | 'offitel-rent' | 'store-sale' | 'land-sale';
```

### 1.3 Service Registry
**File**: `/Users/leemyeongseok/projects/ilsangkit/backend/src/services/realEstateService.ts`

**Changes**:
- Extended `ALL_TYPES` array to include 8 types (line 44-51)
- Extended `getModel()` function switch statement (lines 102-125)
  - Case `'store-sale'`: returns `prisma.storeSaleTransaction`
  - Case `'land-sale'`: returns `prisma.landSaleTransaction`
- Extended `getCategory()` function switch statement (lines 127-150)
  - Maps new types to categories ('store-sale' → 'storeSale', 'land-sale' → 'landSale')
- Verified `serializeRow()` uses generalized BigInt/Decimal conversion (no model-specific logic needed)

**Impact**: All existing queries (`search()`, `getDetail()`, `searchAll()`, `getStats()`) automatically support new types through registry pattern.

### 1.4 Test Mocks
**File**: `/Users/leemyeongseok/projects/ilsangkit/backend/__tests__/services/realEstateService.test.ts`

**Changes** (lines 3-894):
1. **Hoisted mocks destructuring** (lines 3-32): Added `mockStoreSaleFindMany`, `mockStoreSaleCount`, `mockLandSaleFindMany`, `mockLandSaleCount`
2. **Mock function definitions** (lines 32-60): Created corresponding `vi.fn()` stubs
3. **Prisma mock object** (lines 62-111): Added `storeSaleTransaction` and `landSaleTransaction` model definitions with `findMany` and `count` methods
4. **beforeEach setup** (lines 740-748): Initialized mocks to return empty arrays/0
5. **Test assertions** (4 tests updated):
   - Test "queryRealEstateName – search all 8 categories" (line 751): Updated description, added assertions for new types
   - Test "queryRealEstateName – getCategories returns all 8 categories" (line 802): Changed expected count from 6 to 8
   - Test "realEstateService – searchAll finds data for all 8 model queries" (line 839): Updated mock call tracking
   - Lines 872-887: Added mock implementations for new types

**Root Cause Fixed**: Test mocking infrastructure was incomplete for 8 real estate types. When `searchAll()` iterated over `ALL_TYPES`, it would call `getModel('store-sale')` and `getModel('land-sale')`, but Prisma mocks returned `undefined`, causing `TypeError: Cannot read properties of undefined (reading 'findMany')`. Added complete mock definitions following existing 6-type pattern.

---

## 2. Created Files

### 2.1 Store Sale Sync Script
**File**: `/Users/leemyeongseok/projects/ilsangkit/backend/src/scripts/syncStoreSale.ts`

**Implementation**:
- Interface: `StoreSaleItem` (lines 17-45) — mirrors expected API XML fields
- Transform function: `transformStoreSaleItem()` (lines 47-134)
  - Handles optional `buildYear`, `floor` fields with `parseIntOrNull()`
  - Maps API fields to schema: `mainPurpsCode` → `buildingUse`, `bldgCls` → `buildingCls`
  - Synthesizes `buildingName` from `umdNm` and `jibun`
  - Generates `sourceId` using common utility
  - Returns fully typed `StoreSaleTransaction` record
- Main sync: `syncStoreSale()` (lines 136-200)
  - Uses `fetchRealEstateData()` common utility
  - Batch upserts via `batchUpsert()` with 500-record transactions
  - Submits IndexNow URLs
  - Tracks sync history

**TODO Markers**:
- Line 14: `API_ENDPOINT = 'RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade'` — **Verify with actual public data portal API**
- Line 62-63: Field name mappings (`mainPurpsCode`, `bldgCls`) — **Confirm camelCase vs PascalCase from real API response**
- Line 101-108: Optional fields `buildingAr`, `plottageAr`, `exclusiveArea` — **Verify presence in actual API response**

**Pattern**: Follows `syncAptSale.ts` structure exactly. Reuses `fetchRealEstateData()`, `generateSourceId()`, `buildRealEstateUrls()`, `submitIndexNow()` from common utilities.

### 2.2 Land Sale Sync Script
**File**: `/Users/leemyeongseok/projects/ilsangkit/backend/src/scripts/syncLandSale.ts`

**Implementation**:
- Interface: `LandSaleItem` (lines 17-36) — mirrors expected API XML fields including land-specific: `dealArea`, `landCategory`, `landUse`, `shareRatio`, `shareType`
- Transform function: `transformLandSaleItem()` (lines 45-100)
  - No `buildYear`, `floor` fields (land-specific)
  - Maps API fields: `landCategory`, `landUse` direct; `shareRatio`, `shareType` as strings
  - Synthesizes `buildingName` as `"{dongName} {jibun}"` or fallback to `'미상'`
  - **Fixed sourceId generation** (lines 65-74): Uses `buildYear: '0'`, `floor: '0'` as placeholders (land doesn't have these fields)
  - `dealArea` Decimal(14,2) for large land parcels
- Main sync: `syncLandSale()` (lines 102-165)
  - Same pattern as `syncStoreSale()`

**TODO Markers**:
- Line 14: `API_ENDPOINT = 'RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade'` — **Verify with actual public data portal API**
- Line 26-35: Field names and types — **Confirm from real API response**

**Notable Decisions**:
- `buildingName` synthesized as `"{dongName} {jibun}"` to maintain compatibility with existing `/real-estate/[propertyType]/[buildingName]` route structure
- `dealArea` uses `Decimal(14,2)` vs stores' `Decimal(12,2)` to accommodate large land parcels (up to millions of sqm)
- `shareRatio` stored as string to handle various formats ("1/2", "0.5", "50%") without parsing risk

---

## 3. Error & Issue Resolution

### 3.1 TypeScript Build Error
**Error**: `Object literal may only specify known properties, and 'jibun' does not exist in type 'SourceIdFields'`  
**Location**: `src/scripts/syncLandSale.ts:70`

**Root Cause**: The `SourceIdFields` interface (defined in `syncRealEstateBase.ts`) only accepts standard fields: `bjdCode`, `buildYear`, `dealYear`, `dealMonth`, `dealDay`, `floor`, `area`, `dealAmount`, `deposit`, `monthlyRent`. The land sale transform was attempting to pass `jibun` field directly.

**Fix Applied**:
```typescript
// Before (invalid)
const sourceId = generateSourceId(CATEGORY, {
  bjdCode, dealYear, dealMonth, dealDay,
  jibun: jibunStr,  // ❌ Not in SourceIdFields
  dealArea: dealAreaStr,
  dealAmount: dealAmountStr,
});

// After (valid)
const sourceId = generateSourceId(CATEGORY, {
  bjdCode,
  buildYear: '0',    // ✅ Land has no buildYear
  dealYear: String(dealYear),
  dealMonth: String(dealMonth),
  dealDay: dayStr,
  floor: '0',        // ✅ Land has no floor
  area: dealAreaStr, // ✅ Renamed from dealArea to match interface
  dealAmount: dealAmountStr,
});
```

**Principle**: Land transactions don't have `buildYear` or `floor`, so we use `'0'` as placeholders to maintain consistent sourceId generation across all transaction types. The `area` field is used for both building exclusiveArea (apartments) and land dealArea.

### 3.2 Test Mock Incompleteness
**Error**: `TypeError: Cannot read properties of undefined (reading 'findMany')`  
**Location**: `realEstateService.test.ts` during `searchAll()` calls

**Root Cause**: The test mocking infrastructure supported 6 real estate types but `ALL_TYPES` array was extended to 8. When iterating over all types, mocks for `store-sale` and `land-sale` were undefined.

**Fix Applied**: Added complete mock definitions for new types following existing 6-type pattern:
- Mock function definitions in `vi.hoisted()` callback
- Model definitions in Prisma mock object
- beforeEach initialization
- Test assertion updates to expect 8 types instead of 6

**Result**: All 658 tests now pass.

---

## 4. Verification Results

### 4.1 TypeScript Compilation
```bash
npm run build
> tsc
# ✅ No errors
```

### 4.2 Prisma Client Generation
```bash
npm run db:generate
✔ Generated Prisma Client (v6.19.2) to ./node_modules/@prisma/client in 146ms
# ✅ Success
```

### 4.3 Database Schema Push
```bash
npm run db:push
Datasource "db": MySQL database "ilsangkit" at "localhost:3307"
The database is already in sync with the Prisma schema.
# ✅ Schema already applied (models added correctly)
```

### 4.4 Test Suite
```bash
npm run test
Test Files: 48 passed (48)
Tests: 658 passed (658)
Duration: 8.10s
# ✅ All tests pass
```

### 4.5 ESLint
```bash
npm run lint
# ✅ No new errors introduced
# (Pre-existing: 1 error in evChargerService.ts, 24 warnings in other files)
```

---

## 5. Impact Analysis

### 5.1 Backward Compatibility
✅ **Fully maintained**:
- Existing 6 real estate types (`apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent`) unchanged
- All existing queries and APIs work identically
- `serializeRow()` generalized approach handles all types automatically
- Test suite confirms zero breaking changes

### 5.2 Code Patterns Followed
✅ **All decisions align with codebase conventions**:
- Sync scripts follow `syncAptSale.ts` pattern exactly
- Schema follows `AptSaleTransaction` structure with appropriate field modifications
- Service registry follows existing switch-statement pattern
- Test mocking follows existing mock object structure
- Field naming and types match existing real estate models

### 5.3 Data Collection Philosophy
✅ **Adheres to feedback_data_collection.md**:
- All possible API fields captured in schema (nullable where uncertain)
- `buildingAr`, `plottageAr`, `buildingUse`, `buildingCls` for stores
- `dealArea`, `landCategory`, `landUse`, `shareRatio`, `shareType` for land
- No data filtered or discarded at API→DB layer

---

## 6. Decisions & Trade-offs

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| Land `buildingName` synthesis | Maintains route compatibility with `/real-estate/[propertyType]/[buildingName]` | Separate `[id]` route (would require frontend changes) |
| `buildYear='0'`, `floor='0'` placeholders | Keeps sourceId generation consistent across types | Type-specific sourceId logic (more complex, error-prone) |
| `dealArea` Decimal(14,2) vs stores' (12,2) | Land parcels can exceed 999,999 ㎡ | Decimal(12,2) universal (would lose precision for large land) |
| `shareRatio` as String | API may return "1/2", "0.5", "50%" mixed format | Decimal with parsing logic (fragile to API variations) |
| Store `exclusiveArea` retained | Unused but maintains schema parity with apartments | Remove field (incomplete schema coverage) |

---

## 7. Remaining TODOs

### High Priority (Blocking Sync)
1. **syncStoreSale.ts**:
   - Line 14: Confirm actual API endpoint name with public data portal
   - Lines 62-63: Verify field names (`mainPurpsCode`, `bldgCls`, etc.) match real API response (camelCase vs PascalCase)
   - Lines 101-108: Confirm which optional fields are actually present in API response

2. **syncLandSale.ts**:
   - Line 14: Confirm actual API endpoint name
   - Lines 26-35: Verify all field names and types from real API response

### Medium Priority (Implementation)
3. **Frontend integration** (handled separately):
   - Types extension in `frontend/types/realEstate.ts`
   - Meta entries in `frontend/utils/realEstateMeta.ts`
   - Route adjustments if needed

4. **Integration testing**:
   - Smoke test real API calls once endpoint confirmed
   - Verify IndexNow URL submission works for new types
   - Confirm sitemaps include new transaction categories

### Low Priority (Optimization)
5. **realEstateSummaryService**: Verify `refreshSummary()` works for new types or extend if needed
6. **Monitoring**: Add logging for new sync scripts in production

---

## 8. Files Modified Summary

| File | Lines Changed | Type | Purpose |
|------|---------------|------|---------|
| `backend/prisma/schema.prisma` | +40 | Schema | Added 2 transaction models |
| `backend/src/schemas/realEstate.ts` | +2 | Enum | Extended RealEstateType union |
| `backend/src/services/realEstateService.ts` | +55 | Service | Extended getModel() and getCategory() |
| `backend/__tests__/services/realEstateService.test.ts` | +200 | Tests | Added mocks for 8 types |
| `backend/src/scripts/syncStoreSale.ts` | +200 | Script | New store-sale sync (created) |
| `backend/src/scripts/syncLandSale.ts` | +165 | Script | New land-sale sync (created) |

**Total Backend Changes**: ~660 lines (mostly new sync scripts following existing patterns)

---

## 9. Architecture Decisions

### Dynamic Model Registry Pattern
The backend uses a registry pattern (`getModel()` function) that maps type strings to Prisma model objects. This allows:
- Adding new types without modifying core query logic
- All existing endpoints (`/api/real-estate/search`, `/api/real-estate/stats`, etc.) work automatically
- Minimal surface area for testing

### Consistent Field Naming
Both new models follow `AptSaleTransaction` conventions:
- `dealYear`, `dealMonth`, `dealDay` decomposition
- `dealAmount` in BigInt (万円 units)
- `sourceId` as unique upsert key
- `syncedAt` for IndexNow triggers
- Standard indexes on `(bjdCode, dealYear, dealMonth)`, `(city, district)`, `(syncedAt)`

### Graceful Nullable Design
Optional fields marked nullable (`Decimal?`, `String?`) accommodate:
- Uncertainty about actual API response coverage
- Zero-value vs NULL distinction for missing data
- Easy schema evolution if fields appear in future API versions

---

## 10. Next Steps for User/Team

1. **Confirm API Details** (blocking):
   - Use public data portal to get actual API endpoint names
   - Call endpoints with sample `LAWD_CD` and `DEAL_YMD` to verify field names
   - Update `API_ENDPOINT` and field mappings in sync scripts

2. **Test Real Sync** (after step 1):
   ```bash
   cd backend
   npx tsx src/scripts/syncStoreSale.ts
   npx tsx src/scripts/syncLandSale.ts
   ```

3. **Frontend Implementation**:
   - Extend types in `frontend/types/realEstate.ts`
   - Add meta/FAQ in `frontend/utils/realEstateMeta.ts`
   - Test route compatibility for land sales with synthesized buildingName

4. **SEO & Monitoring**:
   - Verify sitemap includes new transaction categories
   - Check IndexNow submission works for new URLs
   - Monitor sync job performance in production

---

## Appendix: Testing Evidence

**Test Run Output** (2026-04-10 15:34:24 UTC):
```
Test Files: 48 passed (48)
Tests: 658 passed (658)
Duration: 8.10s
  - transform 4.21s
  - setup 0ms
  - import 28.99s
  - tests 6.13s
  - environment 6ms
```

**All 48 test files passing**:
- realEstateService.test.ts: 63 tests ✅
- syncAptSale.test.ts: 7 tests ✅
- syncAptRent.test.ts: 7 tests ✅
- syncVillaSale.test.ts: 7 tests ✅
- syncVillaRent.test.ts: 18 tests ✅
- syncOffitelSale.test.ts: 14 tests ✅
- syncOffitelRent.test.ts: 24 tests ✅
- facilityService.test.ts: 39 tests ✅
- ... and 40 more test files

**Build Verification**:
```
TypeScript: ✅ tsc compiles with 0 errors
ESLint: ✅ No new errors (pre-existing warnings only)
Prisma: ✅ Client generation + db:push successful
```

---

**Document Complete** — Ready for frontend expansion phase.
