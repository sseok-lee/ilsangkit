// @TASK T0.1 - 서버 시작점
// @SPEC docs/planning/02-trd.md#백엔드-아키텍처

import dotenv from 'dotenv';
import app from './app.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}`);
  console.info(`Health check: http://localhost:${PORT}/api/health`);
});
