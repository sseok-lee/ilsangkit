# Code Patterns

## 백엔드 패턴
<!-- 프로젝트에서 사용되는 백엔드 패턴이 발견되면 여기에 기록됩니다 -->

### API 라우트 패턴
```typescript
// src/routes/facilities.ts
const result = SearchSchema.safeParse(req.body);
if (!result.success) {
  return res.status(422).json({ error: 'Validation Error', details: result.error.flatten() });
}
```

### Prisma Singleton 패턴
```typescript
// src/lib/prisma.ts
import prisma from '../lib/prisma';
```

## 프론트엔드 패턴
<!-- 프로젝트에서 사용되는 프론트엔드 패턴이 발견되면 여기에 기록됩니다 -->

### Composables 패턴
```typescript
// composables/useFacilitySearch.ts
export function useFacilitySearch() {
  const loading = ref(false);
  const results = ref<Facility[]>([]);

  async function search(params: SearchParams) {
    loading.value = true;
    // ... fetch logic
  }

  return { loading: readonly(loading), results: readonly(results), search };
}
```
