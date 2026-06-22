/**
 * Pricing — typed config. Was a Payload global; lives in code now.
 *
 * Edit to change list pricing across the site. PRs over CMS edits.
 *
 * Currency-aware structure: each tier has a price-per-currency map.
 * Currency rates updated quarterly based on bank-mid + 3% margin.
 */

export type SupportedCurrency = 'KES' | 'USD' | 'NGN' | 'GHS' | 'ZAR' | 'TZS' | 'UGX' | 'RWF' | 'EGP' | 'INR' | 'GBP' | 'EUR' | 'AED'

export interface TierPrice {
  oneTimeFee: Record<SupportedCurrency, number>
  maintenanceYearly: Record<SupportedCurrency, number>
}

export interface PricingShape {
  starter: TierPrice
  business: TierPrice
  cloudBackupMonthly: Record<SupportedCurrency, number>
  extraBranchOneTime: Record<SupportedCurrency, number>
  extraMachineOneTime: Record<SupportedCurrency, number>
  majorUpgradeDiscount: number // percent
  defaultCurrency: SupportedCurrency
}

export const pricing: PricingShape = {
  starter: {
    oneTimeFee: {
      KES: 30_000, USD: 230, NGN: 365_000, GHS: 3_400, ZAR: 4_200,
      TZS: 580_000, UGX: 850_000, RWF: 290_000, EGP: 11_500, INR: 19_000,
      GBP: 180, EUR: 215, AED: 850,
    },
    maintenanceYearly: {
      KES: 12_000, USD: 90, NGN: 145_000, GHS: 1_400, ZAR: 1_700,
      TZS: 230_000, UGX: 340_000, RWF: 115_000, EGP: 4_500, INR: 7_500,
      GBP: 70, EUR: 85, AED: 330,
    },
  },
  business: {
    oneTimeFee: {
      KES: 80_000, USD: 620, NGN: 980_000, GHS: 9_200, ZAR: 11_300,
      TZS: 1_550_000, UGX: 2_300_000, RWF: 780_000, EGP: 30_500, INR: 51_500,
      GBP: 490, EUR: 580, AED: 2_280,
    },
    maintenanceYearly: {
      KES: 30_000, USD: 230, NGN: 365_000, GHS: 3_400, ZAR: 4_200,
      TZS: 580_000, UGX: 850_000, RWF: 290_000, EGP: 11_500, INR: 19_000,
      GBP: 180, EUR: 215, AED: 850,
    },
  },
  cloudBackupMonthly: {
    KES: 500, USD: 4, NGN: 6_000, GHS: 55, ZAR: 70,
    TZS: 9_500, UGX: 14_000, RWF: 4_800, EGP: 190, INR: 320,
    GBP: 3, EUR: 4, AED: 14,
  },
  extraBranchOneTime: {
    KES: 15_000, USD: 115, NGN: 180_000, GHS: 1_700, ZAR: 2_100,
    TZS: 290_000, UGX: 425_000, RWF: 145_000, EGP: 5_700, INR: 9_500,
    GBP: 90, EUR: 110, AED: 420,
  },
  extraMachineOneTime: {
    KES: 5_000, USD: 38, NGN: 60_000, GHS: 565, ZAR: 700,
    TZS: 96_500, UGX: 142_000, RWF: 48_000, EGP: 1_900, INR: 3_200,
    GBP: 30, EUR: 36, AED: 140,
  },
  majorUpgradeDiscount: 50,
  defaultCurrency: 'KES',
}

/** Read pricing in a single currency (legacy shape used by some helpers). */
export function pricingFor(currency: SupportedCurrency = 'KES') {
  return {
    starter: {
      oneTimeFee: pricing.starter.oneTimeFee[currency],
      maintenanceYearly: pricing.starter.maintenanceYearly[currency],
    },
    business: {
      oneTimeFee: pricing.business.oneTimeFee[currency],
      maintenanceYearly: pricing.business.maintenanceYearly[currency],
    },
    cloudBackupMonthly: pricing.cloudBackupMonthly[currency],
    extraBranchOneTime: pricing.extraBranchOneTime[currency],
    extraMachineOneTime: pricing.extraMachineOneTime[currency],
    majorUpgradeDiscount: pricing.majorUpgradeDiscount,
    currency,
  }
}
