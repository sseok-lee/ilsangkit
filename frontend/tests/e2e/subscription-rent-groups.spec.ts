import { test, expect } from '@playwright/test'

const SAMPLE_LIST = {
  success: true,
  data: {
    items: [
      {
        id: 7777,
        panId: '20260003789',
        ccrCnntSysDsCd: '01',
        uppAisTpCd: '06',
        uppAisTpNm: '임대주택',
        aisTpCd: '01',
        aisTpNm: '국민임대',
        splInfTpCd: '060',
        panNm: 'E2E 부천 매입임대',
        cnpNm: '경기도',
        panDt: '2026-03-15T00:00:00Z',
        clsgDt: '2026-04-30T00:00:00Z',
        panSs: '공고중',
        dtlUrl: null,
        dtlUrlMob: null,
        bzdtNm: 'E2E 부천 ABC',
        lctAraAdr: '경기도 부천시 원미로 100',
        lctAraDtlAdr: null,
        minMaxRsdnDdoAr: '49.0~74.94',
        sumTotHshCnt: 200,
        mvinXpcYm: null,
        htnFmlaDsCdNm: '아파트',
        edcFclCts: null,
        tffcFclCts: null,
        cvnFclCts: null,
        idtFclCts: null,
        splInfGudFcts: null,
        acpDttm: '2026.04.10 09:00 ~ 2026.04.12 17:00',
        pzwrAncDt: null,
        pzwrPprSbmStDt: null,
        pzwrPprSbmEdDt: null,
        ctrtStDt: null,
        ctrtEdDt: null,
        hsSbscAcpTrgCdNm: null,
        splScdlGudFcts: null,
        panDtlCts: null,
        etcFcts: null,
        ctrtPlcAdr: null,
        ctrtPlcDtlAdr: null,
        silOfcTlno: null,
        silOfcGudFcts: null,
        lat: null,
        lng: null,
        sourceId: '20260003789-01',
        createdAt: '2026-03-15T00:00:00Z',
        updatedAt: '2026-04-25T00:00:00Z',
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
}

const SAMPLE_DETAIL = {
  success: true,
  data: {
    ...SAMPLE_LIST.data.items[0],
    supplies: [
      {
        id: 1,
        announcementId: 7777,
        listType: '02',
        htyNm: '49A',
        rsdnDdoAr: 49.0,
        splAr: 65.0,
        silHshCnt: 50,
        totHshCnt: 50,
        silAmt: null,
        lsGmy: 30000000,
        mmRfe: 200000,
        elyDsuAmt: null,
      },
    ],
    attachments: [],
  },
}

test.describe('subscription rent: 2-group hub → LH 공고 탭 → 카드 → 상세', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/lh-announcement?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SAMPLE_LIST),
      })
    })
    await page.route('**/api/lh-announcement/7777', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SAMPLE_DETAIL),
      })
    })
  })

  test('hub 페이지에 청약/수시모집 두 그룹이 보이고 LH 공고 탭→카드→상세까지 이동', async ({ page }) => {
    await page.goto('/subscription/rent')

    await expect(page.getByRole('heading', { name: '청약으로 신청' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '수시 모집' })).toBeVisible()

    const cheongyakSection = page.locator('section[data-test-group="cheongyak"]')
    await expect(cheongyakSection.getByRole('link', { name: 'LH 분양/임대 공고' })).toBeVisible()
    const reliefSection = page.locator('section[data-test-group="relief"]')
    await expect(reliefSection.getByRole('link', { name: 'LH 매입임대' })).toBeVisible()
    await expect(reliefSection.getByRole('link', { name: 'LH 전세임대' })).toBeVisible()

    await cheongyakSection.getByRole('link', { name: 'LH 분양/임대 공고' }).click()
    await expect(page).toHaveURL(/\/subscription\/rent\/lh-announcement/)
    await expect(page.getByText('E2E 부천 매입임대')).toBeVisible()

    await page.getByText('E2E 부천 매입임대').first().click()
    await expect(page).toHaveURL(/\/subscription\/rent\/lh\/announcement\/7777/)
    await expect(page.locator('[data-test-section="header"]')).toBeVisible()
    await expect(page.locator('[data-test-section="supplies"]')).toBeVisible()
    await expect(page.getByText('임대보증금')).toBeVisible()
  })
})
