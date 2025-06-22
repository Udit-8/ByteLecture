// Payment Routes for Google Play & Apple Pay Integration
import { Router } from 'express';
import { paymentController } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/payments/validate-receipt
 * @desc    Validate purchase receipt from mobile app
 * @access  Private
 */
router.post('/validate-receipt', authenticateToken, (req, res) => {
  paymentController.validateReceipt(req, res);
});

/**
 * @route   GET /api/payments/subscription-status
 * @desc    Get user's current subscription status
 * @access  Private
 */
router.get('/subscription-status', authenticateToken, (req, res) => {
  paymentController.getSubscriptionStatus(req, res);
});

/**
 * @route   GET /api/payments/products
 * @desc    Get available subscription products and pricing
 * @access  Public
 */
router.get('/products', (req, res) => {
  paymentController.getProducts(req, res);
});

/**
 * @route   POST /api/payments/cancel-subscription
 * @desc    Cancel user's subscription
 * @access  Private
 */
router.post('/cancel-subscription', authenticateToken, (req, res) => {
  paymentController.cancelSubscription(req, res);
});

/**
 * @route   GET /api/payments/quota
 * @desc    Get subscription quota and usage information
 * @access  Private
 */
router.get('/quota', authenticateToken, (req, res) => {
  paymentController.getSubscriptionQuota(req, res);
});

/**
 * @route   GET /api/payments/health
 * @desc    Health check for payment service
 * @access  Public
 */
router.get('/health', (req, res) => {
  paymentController.healthCheck(req, res);
});

export default router;
