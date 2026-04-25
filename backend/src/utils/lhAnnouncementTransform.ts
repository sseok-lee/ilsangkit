// LH 공고 multi-dataset 응답 → DB 적재용 변환 로직 (pure functions, no I/O)
// API: B552555/lhLeaseNoticeInfo1, getLeaseNoticeDtlInfo1, getLeaseNoticeSplInfo1

export interface LhAnnouncementListItem {
  PAN_ID: string;
  CCR_CNNT_SYS_DS_CD: string;
  UPP_AIS_TP_CD: string;
  UPP_AIS_TP_NM: string;
  AIS_TP_CD: string;
  AIS_TP_NM: string;
  SPL_INF_TP_CD: string;
  PAN_NM: string;
  CNP_CD_NM?: string;
  CNP_NM?: string;
  PAN_DT?: string;
  CLSG_DT?: string;
  PAN_SS?: string;
  DTL_URL?: string;
  DTL_URL_MOB?: string;
}

export interface LhDetailDsSbdRow {
  BZDT_NM?: string;
  LCT_ARA_ADR?: string;
  LCT_ARA_DTL_ADR?: string;
  MIN_MAX_RSDN_DDO_AR?: string;
  SUM_TOT_HSH_CNT?: number | string;
  MVIN_XPC_YM?: string;
  HTN_FMLA_DS_CD_NM?: string;
  EDC_FCL_CTS?: string;
  TFFC_FCL_CTS?: string;
  CVN_FCL_CTS?: string;
  IDT_FCL_CTS?: string;
  SPL_INF_GUD_FCTS?: string;
}

export interface LhDetailDsSplScdlRow {
  ACP_DTTM?: string;
  PZWR_ANC_DT?: string;
  PZWR_PPR_SBM_ST_DT?: string;
  PZWR_PPR_SBM_ED_DT?: string;
  CTRT_ST_DT?: string;
  CTRT_ED_DT?: string;
  HS_SBSC_ACP_TRG_CD_NM?: string;
  RMK?: string;
  SPL_SCDL_GUD_FCTS?: string;
}

export interface LhDetailDsEtcInfoRow {
  PAN_DTL_CTS?: string;
  ETC_FCTS?: string;
}

export interface LhDetailDsCtrtPlcRow {
  CTRT_PLC_ADR?: string;
  CTRT_PLC_DTL_ADR?: string;
  SIL_OFC_TLNO?: string;
  SIL_OFC_GUD_FCTS?: string;
}

export interface LhDetailDsAhflRow {
  AHFL_URL?: string;
  CMN_AHFL_NM?: string;
  SL_PAN_AHFL_DS_CD_NM?: string;
}

export interface LhDetailResponse {
  dsSbd?: LhDetailDsSbdRow[];
  dsSplScdl?: LhDetailDsSplScdlRow[];
  dsEtcInfo?: LhDetailDsEtcInfoRow[];
  dsCtrtPlc?: LhDetailDsCtrtPlcRow[];
  dsAhflInfo?: LhDetailDsAhflRow[];
  dsSbdAhfl?: LhDetailDsAhflRow[];
}

export interface LhSupplyRow {
  HTY_NM?: string;
  RSDN_DDO_AR?: number | string;
  SPL_AR?: number | string;
  SIL_HSH_CNT?: number | string;
  TOT_HSH_CNT?: number | string;
  SIL_AMT?: number | string;
  LS_GMY?: number | string;
  MM_RFE?: number | string;
  ELY_DSU_AMT?: number | string;
  BZDT_NM?: string;
}

export interface LhSupplyResponse {
  dsList01?: LhSupplyRow[];
  dsList02?: LhSupplyRow[];
  dsList03?: LhSupplyRow[];
  dsList04?: LhSupplyRow[];
}

export type SupplyListType = '01' | '02' | '03' | '04';

export interface SupplyTransformed {
  listType: SupplyListType;
  htyNm: string | null;
  rsdnDdoAr: number | null;
  splAr: number | null;
  silHshCnt: number | null;
  totHshCnt: number | null;
  silAmt: bigint | null;
  lsGmy: bigint | null;
  mmRfe: number | null;
  elyDsuAmt: bigint | null;
}

export interface AttachmentTransformed {
  ahflUrl: string;
  slPanAhflDsCdNm: string | null;
  cmnAhflNm: string;
}

export interface AnnouncementUpsertPayload {
  panId: string;
  ccrCnntSysDsCd: string;
  uppAisTpCd: string;
  uppAisTpNm: string;
  aisTpCd: string;
  aisTpNm: string;
  splInfTpCd: string;

  panNm: string;
  cnpNm: string;
  panDt: Date | null;
  clsgDt: Date | null;
  panSs: string | null;
  dtlUrl: string | null;
  dtlUrlMob: string | null;

  bzdtNm: string | null;
  lctAraAdr: string | null;
  lctAraDtlAdr: string | null;
  minMaxRsdnDdoAr: string | null;
  sumTotHshCnt: number | null;
  mvinXpcYm: string | null;
  htnFmlaDsCdNm: string | null;
  edcFclCts: string | null;
  tffcFclCts: string | null;
  cvnFclCts: string | null;
  idtFclCts: string | null;
  splInfGudFcts: string | null;

  acpDttm: string | null;
  pzwrAncDt: string | null;
  pzwrPprSbmStDt: string | null;
  pzwrPprSbmEdDt: string | null;
  ctrtStDt: string | null;
  ctrtEdDt: string | null;
  hsSbscAcpTrgCdNm: string | null;
  splScdlGudFcts: string | null;

  panDtlCts: string | null;
  etcFcts: string | null;

  ctrtPlcAdr: string | null;
  ctrtPlcDtlAdr: string | null;
  silOfcTlno: string | null;
  silOfcGudFcts: string | null;

  sourceId: string;
}

export interface AnnouncementBundle {
  announcement: AnnouncementUpsertPayload;
  supplies: SupplyTransformed[];
  attachments: AttachmentTransformed[];
}

/**
 * data.go.kr LH API 응답은 객체가 아닌 배열 형태로 옴:
 *   [ { dsSch: [...] }, { dsList: [...], dsList01: [...], ... } ]
 * 각 청크를 단일 객체로 머지해 transform 함수가 그대로 쓸 수 있게 함.
 *
 * 객체로 직접 오는 경우(테스트 fixture 또는 형식 변경)도 그대로 패스스루.
 */
export function flattenLhResponse<T = Record<string, unknown>>(
  data: unknown,
): T {
  if (!Array.isArray(data)) {
    return (data ?? {}) as T;
  }
  const merged: Record<string, unknown> = {};
  for (const part of data) {
    if (part && typeof part === 'object') {
      Object.assign(merged, part);
    }
  }
  return merged as T;
}

const DATE_YYYYMMDD = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_DOTTED = /^(\d{4})\.(\d{2})\.(\d{2})$/;

export function parseLhDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let match = DATE_YYYYMMDD.exec(trimmed);
  if (!match) match = DATE_DOTTED.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // UTC midnight to avoid TZ drift on date-only fields
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toBigInt(value: number | string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/,/g, '').trim();
  if (!str) return null;
  try {
    return BigInt(str);
  } catch {
    const num = Number(str);
    if (!Number.isFinite(num)) return null;
    return BigInt(Math.trunc(num));
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/,/g, '').trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function toInt(value: number | string | null | undefined): number | null {
  const num = toNumber(value);
  return num === null ? null : Math.trunc(num);
}

function nullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export function transformSupplyDataset(
  rows: LhSupplyRow[] | undefined,
  listType: SupplyListType
): SupplyTransformed[] {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  return rows.map((row) => ({
    listType,
    htyNm: nullableString(row.HTY_NM),
    rsdnDdoAr: toNumber(row.RSDN_DDO_AR),
    splAr: toNumber(row.SPL_AR),
    silHshCnt: toInt(row.SIL_HSH_CNT),
    totHshCnt: toInt(row.TOT_HSH_CNT),
    silAmt: listType === '01' ? toBigInt(row.SIL_AMT) : null,
    lsGmy: listType === '02' || listType === '04' ? toBigInt(row.LS_GMY) : null,
    mmRfe: listType === '01' ? null : toInt(row.MM_RFE),
    elyDsuAmt: listType === '03' ? toBigInt(row.ELY_DSU_AMT) : null,
  }));
}

export function transformAllSupplies(response: LhSupplyResponse | undefined): SupplyTransformed[] {
  if (!response) return [];
  return [
    ...transformSupplyDataset(response.dsList01, '01'),
    ...transformSupplyDataset(response.dsList02, '02'),
    ...transformSupplyDataset(response.dsList03, '03'),
    ...transformSupplyDataset(response.dsList04, '04'),
  ];
}

export function transformAttachments(response: LhDetailResponse | undefined): AttachmentTransformed[] {
  if (!response) return [];
  const rows = [...(response.dsAhflInfo ?? []), ...(response.dsSbdAhfl ?? [])];
  return rows
    .filter((row) => row && typeof row.AHFL_URL === 'string' && row.AHFL_URL.trim().length > 0)
    .map((row) => ({
      ahflUrl: row.AHFL_URL!.trim(),
      slPanAhflDsCdNm: nullableString(row.SL_PAN_AHFL_DS_CD_NM),
      cmnAhflNm: nullableString(row.CMN_AHFL_NM) ?? '첨부파일',
    }));
}

export function buildSourceId(panId: string, ccrCnntSysDsCd: string): string {
  return `${panId}-${ccrCnntSysDsCd}`;
}

export function isLandAnnouncement(item: Pick<LhAnnouncementListItem, 'UPP_AIS_TP_NM'>): boolean {
  return (item.UPP_AIS_TP_NM ?? '').includes('토지');
}

export function transformLhAnnouncement(
  listItem: LhAnnouncementListItem,
  detail: LhDetailResponse | undefined,
  supply: LhSupplyResponse | undefined
): AnnouncementBundle {
  const sbd = detail?.dsSbd?.[0];
  const scdl = detail?.dsSplScdl?.[0];
  const etc = detail?.dsEtcInfo?.[0];
  const ctrt = detail?.dsCtrtPlc?.[0];

  const cnpNm = listItem.CNP_NM ?? listItem.CNP_CD_NM ?? '';

  const announcement: AnnouncementUpsertPayload = {
    panId: listItem.PAN_ID,
    ccrCnntSysDsCd: listItem.CCR_CNNT_SYS_DS_CD,
    uppAisTpCd: listItem.UPP_AIS_TP_CD,
    uppAisTpNm: listItem.UPP_AIS_TP_NM,
    aisTpCd: listItem.AIS_TP_CD,
    aisTpNm: listItem.AIS_TP_NM,
    splInfTpCd: listItem.SPL_INF_TP_CD,

    panNm: listItem.PAN_NM,
    cnpNm,
    panDt: parseLhDate(listItem.PAN_DT),
    clsgDt: parseLhDate(listItem.CLSG_DT),
    panSs: nullableString(listItem.PAN_SS),
    dtlUrl: nullableString(listItem.DTL_URL),
    dtlUrlMob: nullableString(listItem.DTL_URL_MOB),

    bzdtNm: nullableString(sbd?.BZDT_NM),
    lctAraAdr: nullableString(sbd?.LCT_ARA_ADR),
    lctAraDtlAdr: nullableString(sbd?.LCT_ARA_DTL_ADR),
    minMaxRsdnDdoAr: nullableString(sbd?.MIN_MAX_RSDN_DDO_AR),
    sumTotHshCnt: toInt(sbd?.SUM_TOT_HSH_CNT),
    mvinXpcYm: nullableString(sbd?.MVIN_XPC_YM),
    htnFmlaDsCdNm: nullableString(sbd?.HTN_FMLA_DS_CD_NM),
    edcFclCts: nullableString(sbd?.EDC_FCL_CTS),
    tffcFclCts: nullableString(sbd?.TFFC_FCL_CTS),
    cvnFclCts: nullableString(sbd?.CVN_FCL_CTS),
    idtFclCts: nullableString(sbd?.IDT_FCL_CTS),
    splInfGudFcts: nullableString(sbd?.SPL_INF_GUD_FCTS),

    acpDttm: nullableString(scdl?.ACP_DTTM),
    pzwrAncDt: nullableString(scdl?.PZWR_ANC_DT),
    pzwrPprSbmStDt: nullableString(scdl?.PZWR_PPR_SBM_ST_DT),
    pzwrPprSbmEdDt: nullableString(scdl?.PZWR_PPR_SBM_ED_DT),
    ctrtStDt: nullableString(scdl?.CTRT_ST_DT),
    ctrtEdDt: nullableString(scdl?.CTRT_ED_DT),
    hsSbscAcpTrgCdNm: nullableString(scdl?.HS_SBSC_ACP_TRG_CD_NM),
    splScdlGudFcts: nullableString(scdl?.SPL_SCDL_GUD_FCTS ?? scdl?.RMK),

    panDtlCts: nullableString(etc?.PAN_DTL_CTS),
    etcFcts: nullableString(etc?.ETC_FCTS),

    ctrtPlcAdr: nullableString(ctrt?.CTRT_PLC_ADR),
    ctrtPlcDtlAdr: nullableString(ctrt?.CTRT_PLC_DTL_ADR),
    silOfcTlno: nullableString(ctrt?.SIL_OFC_TLNO),
    silOfcGudFcts: nullableString(ctrt?.SIL_OFC_GUD_FCTS),

    sourceId: buildSourceId(listItem.PAN_ID, listItem.CCR_CNNT_SYS_DS_CD),
  };

  return {
    announcement,
    supplies: transformAllSupplies(supply),
    attachments: transformAttachments(detail),
  };
}
