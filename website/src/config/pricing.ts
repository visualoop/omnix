/**
 * Pricing — typed config. Was a Payload global; lives in code now.
 *
 * Currency support is restricted to what Paystack will actually charge:
 * KES, NGN, GHS, ZAR (native local) + USD (universal). A visitor from
 * Berlin, Dubai, Mumbai or Dar es Salaam sees the USD column and pays
 * in USD — Paystack settles into the merchant's bank.
 *
 * Edit to change list pricing across the site. PRs over CMS edits.
 */

export type SupportedCurrency = 'KES' | 'USD' | 'NGN' | 'GHS' | 'ZAR'

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
      KES: 30_000,
      USD: 230,
      NGN: 365_000,
      GHS: 3_400,
      ZAR: 4_200,
    },
    maintenanceYearly: {
      KES: 12_000,
      USD: 90,
      NGN: 145_000,
      GHS: 1_400,
      ZAR: 1_700,
    },
  },
  business: {
    oneTimeFee: {
      KES: 150_000,
      USD: 1_150,
      NGN: 1_830_000,
      GHS: 17_300,
      ZAR: 21_200,
    },
    maintenanceYearly: {
      KES: 30_000,
      USD: 230,
      NGN: 365_000,
      GHS: 3_400,
      ZAR: 4_200,
    },
  },
  cloudBackupMonthly: {
    KES: 500,
    USD: 4,
    NGN: 6_000,
    GHS: 55,
    ZAR: 70,
  },
  extraBranchOneTime: {
    KES: 15_000,
    USD: 115,
    NGN: 180_000,
    GHS: 1_700,
    ZAR: 2_100,
  },
  extraMachineOneTime: {
    KES: 5_000,
    USD: 38,
    NGN: 60_000,
    GHS: 565,
    ZAR: 700,
  },
  majorUpgradeDiscount: 50,
  /**
   * defaultCurrency is what we render to a visitor whose IP we couldn't
   * geolocate. USD because Paystack accepts it universally and the
   * largest non-KE market is global English-speaking.
   */
  defaultCurrency: 'USD',
}

/** Read pricing in a single currency (legacy shape used by some helpers). */
export function pricingFor(currency: SupportedCurrency = 'USD') {
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
