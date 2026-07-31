/**
 * Pricing — typed code config.
 *
 * Public market pages use DisplayCurrency (KES/UGX/TZS/RWF). Payment code uses
 * SettlementCurrency and must independently verify that its configured payment
 * provider accepts the chosen settlement currency. A displayed local price is
 * not a claim about the currency Paystack will charge.
 */

import type { DisplayCurrency, PricingCurrency, SettlementCurrency } from '@/lib/currency'

export type { DisplayCurrency, PricingCurrency, SettlementCurrency } from '@/lib/currency'
/** Legacy payment-side name. New code should choose DisplayCurrency or SettlementCurrency explicitly. */
export type SupportedCurrency = SettlementCurrency

export type ConfiguredPrices = Readonly<Record<PricingCurrency, number>>

export interface TierPrice {
  oneTimeFee: ConfiguredPrices
  maintenanceYearly: ConfiguredPrices
}

export interface PricingShape {
  starter: TierPrice
  business: TierPrice
  cloudBackupMonthly: ConfiguredPrices
  extraBranchOneTime: ConfiguredPrices
  extraMachineOneTime: ConfiguredPrices
  majorUpgradeDiscount: number
  defaultDisplayCurrency: DisplayCurrency
  defaultSettlementCurrency: SettlementCurrency
}

export const pricing: PricingShape = {
  starter: {
    oneTimeFee: {
      KES: 30_000,
      UGX: 850_000,
      TZS: 570_000,
      RWF: 300_000,
      USD: 230,
      NGN: 365_000,
      GHS: 3_400,
      ZAR: 4_200,
    },
    maintenanceYearly: {
      KES: 12_000,
      UGX: 340_000,
      TZS: 230_000,
      RWF: 120_000,
      USD: 90,
      NGN: 145_000,
      GHS: 1_400,
      ZAR: 1_700,
    },
  },
  business: {
    oneTimeFee: {
      KES: 150_000,
      UGX: 4_250_000,
      TZS: 2_850_000,
      RWF: 1_500_000,
      USD: 1_150,
      NGN: 1_830_000,
      GHS: 17_300,
      ZAR: 21_200,
    },
    maintenanceYearly: {
      KES: 30_000,
      UGX: 850_000,
      TZS: 570_000,
      RWF: 300_000,
      USD: 230,
      NGN: 365_000,
      GHS: 3_400,
      ZAR: 4_200,
    },
  },
  cloudBackupMonthly: {
    KES: 500,
    UGX: 15_000,
    TZS: 10_000,
    RWF: 5_000,
    USD: 4,
    NGN: 6_000,
    GHS: 55,
    ZAR: 70,
  },
  extraBranchOneTime: {
    KES: 15_000,
    UGX: 425_000,
    TZS: 285_000,
    RWF: 150_000,
    USD: 115,
    NGN: 180_000,
    GHS: 1_700,
    ZAR: 2_100,
  },
  extraMachineOneTime: {
    KES: 5_000,
    UGX: 140_000,
    TZS: 95_000,
    RWF: 50_000,
    USD: 38,
    NGN: 60_000,
    GHS: 565,
    ZAR: 700,
  },
  majorUpgradeDiscount: 50,
  defaultDisplayCurrency: 'KES',
  defaultSettlementCurrency: 'KES',
}

/** Public list prices for one launch market. */
export function displayPricingFor(currency: DisplayCurrency = pricing.defaultDisplayCurrency) {
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

/** Payment-side prices. Callers must validate provider/country capability separately. */
export function pricingFor(currency: SettlementCurrency = pricing.defaultSettlementCurrency) {
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
