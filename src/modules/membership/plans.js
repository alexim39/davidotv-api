/**
 * Membership plans — cheap, pay-as-you-go, no stored cards, no commitment.
 * Prices in NGN (kobo conversion at the Paystack boundary). Each purchase
 * grants a fixed entitlement window; renewal is just another purchase.
 * Designed for young fans: the weekly tier costs less than a bottle of soda.
 */
export const PLANS = Object.freeze({
  free: {
    id: 'free',
    name: 'Free Fan',
    priceNgn: 0,
    days: 0,
    tagline: 'General content, community access',
    entitlements: {
      earlyAccess: false,
      exclusiveDrops: false,
      merchDiscountPct: 0,
      vipBadge: false,
      priorityTickets: false,
    },
  },
  fan_weekly: {
    id: 'fan_weekly',
    name: 'Fan Weekly',
    priceNgn: 300,
    days: 7,
    tagline: 'A week of everything — skip one snack',
    entitlements: {
      earlyAccess: true,
      exclusiveDrops: true,
      merchDiscountPct: 5,
      vipBadge: true,
      priorityTickets: false,
    },
  },
  fan_monthly: {
    id: 'fan_monthly',
    name: 'Fan Monthly',
    priceNgn: 900,
    days: 30,
    tagline: 'Best for students — less than ₦1,000',
    entitlements: {
      earlyAccess: true,
      exclusiveDrops: true,
      merchDiscountPct: 10,
      vipBadge: true,
      priorityTickets: true,
    },
  },
  fan_yearly: {
    id: 'fan_yearly',
    name: 'Fan Yearly',
    priceNgn: 8000,
    days: 365,
    tagline: 'O.B.O for life — about ₦667/month',
    entitlements: {
      earlyAccess: true,
      exclusiveDrops: true,
      merchDiscountPct: 15,
      vipBadge: true,
      priorityTickets: true,
    },
  },
});

export const PAID_TIERS = Object.freeze(['fan_weekly', 'fan_monthly', 'fan_yearly']);

export const entitlementsFor = (tier) => ({ ...(PLANS[tier] || PLANS.free).entitlements });

export default { PLANS, PAID_TIERS, entitlementsFor };
