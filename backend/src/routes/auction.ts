import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import {
  AuctionItemsSchema, AuctionRegionsSchema, AuctionRegionSchema, AuctionCitySchema, AuctionItemDetailSchema, AuctionRankingSchema,
} from '../schemas/auction.js';
import {
  getItems, getItemDetail, getRegionList, getRegionDetail, getCityDetail, getHubSummary, getRanking, getSitemapEntries,
} from '../services/auctionService.js';

const router = Router();

router.get('/hub-summary', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getHubSummary() });
}));
router.get('/items', validate(AuctionItemsSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getItems(req.query as any) });
}));
router.get('/ranking', validate(AuctionRankingSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getRanking(req.query as any) });
}));
router.get('/regions', validate(AuctionRegionsSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getRegionList(req.query as any) });
}));
router.get('/region', validate(AuctionRegionSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getRegionDetail(req.query as any) });
}));
router.get('/city', validate(AuctionCitySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getCityDetail((req.query as any).city) });
}));
router.get('/sitemap', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getSitemapEntries() });
}));
// item/:cltrMngNo 는 마지막(정적 경로 우선)
router.get('/item/:cltrMngNo', validate(AuctionItemDetailSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const data = await getItemDetail(req.params.cltrMngNo);
  if (!data) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '물건을 찾을 수 없습니다' } }); return; }
  res.json({ success: true, data });
}));

export default router;
