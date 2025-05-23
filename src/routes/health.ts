import express, { Router } from 'express';
import { health } from '@auth/controllers/health';

const router: Router = express.Router();

export function healthRoutes(): Router {
  router.post('/auth-health', health);

  return router;
}
