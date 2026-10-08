import { limiters } from '../middleware/rateLimiter.js';
import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { requireAuthentication } from '../middleware/auth.js';
import { validateUpdateProfile, validateSearchQuery } from '../validators/user.validator.js';

const router = Router();

router.use(requireAuthentication);

router.get('/me', userController.getCurrentUser);
router.patch('/me', limiters.profileUpdate, validateUpdateProfile, userController.updateProfile);
router.get('/search', limiters.search, validateSearchQuery, userController.searchUsers);

export default router;
