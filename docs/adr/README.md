# Architecture Decision Records (ADR)

이 디렉토리는 일상킷 프로젝트의 주요 아키텍처 결정을 기록합니다.

## ADR이란?

Architecture Decision Record(ADR)는 소프트�어 개발 과정에서 내린 중요한 아키텍처 결정을 문서화하는 방법입니다. 각 ADR은 다음을 포함합니다:

- **상태(Status)**: 제안됨, 승인됨, 폐기됨, 대체됨
- **컨텍스트(Context)**: 결정이 필요했던 배경과 문제 상황
- **결정(Decision)**: 선택한 해결책
- **결과(Consequences)**: 결정으로 인한 긍정적/부정적 영향

## ADR 목록

| 번호 | 제목 | 상태 | 날짜 |
|------|------|------|------|
| [ADR-001](./001-category-specific-tables.md) | 카테고리별 개별 테이블 사용 | 승인됨 | 2026-02-12 |
| [ADR-002](./002-ssr-ssg-strategy.md) | Nuxt SSR/ISR 하이브리드 렌더링 전략 | 승인됨 | 2026-02-12 |

## ADR 작성 가이드

새로운 ADR을 작성할 때는 다음 템플릿을 사용하세요:

```markdown
# ADR-XXX: [제목]

## Status

[제안됨 | 승인됨 | 폐기됨 | 대체됨]

## Context

[결정이 필요한 배경 설명]

## Decision

[선택한 해결책]

## Consequences

### 긍정적 결과 (Positive)
- [장점 1]
- [장점 2]

### 부정적 결과 (Negative)
- [단점 1]
- [단점 2]

## Alternatives Considered

- [대안 1]: [거부 이유]
- [대안 2]: [거부 이유]

## Related Decisions

- ADR-XXX: [관련 결정]

## References

- [참고 자료]
```

## 참고 자료

- [Michael Nygard's ADR Template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [adr-tools](https://github.com/npryce/adr-tools)
- [ADR GitHub Organization](https://adr.github.io/)
