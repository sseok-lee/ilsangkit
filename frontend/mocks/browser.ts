// @TASK T0.5.3 - MSW 브라우저 설정
// @SPEC docs/planning/02-trd.md#계약-정의

import { setupWorker } from 'msw/browser';
import { facilityHandlers } from './handlers/facilities';
import { wasteScheduleHandlers } from './handlers/waste-schedules';
import { facilityYoutubeHandlers } from './handlers/facilityYoutube';
import { naverBlogHandlers } from './handlers/naverBlog';

export const worker = setupWorker(...facilityHandlers, ...wasteScheduleHandlers, ...facilityYoutubeHandlers, ...naverBlogHandlers);
