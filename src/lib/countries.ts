/**
 * Country registry — single source of truth for currency, tax, payment
 * methods, compliance hooks, and pharmacy terminology per country.
 *
 * Data layers:
 *   1. RICH_PROFILES — hand-authored entries for the top markets
 *      (KE, TZ, UG, RW, NG, GH, ZA, US, GB, IN, AE, EG). These have
 *      bespoke compliance hooks (eTIMS for Kenya, NHIF/SHA, M-Pesa,
 *      KEBS, etc.) and the right pharmacy term in the local language.
 *
 *   2. GENERIC_COUNTRIES — every other ISO-3166-1 country gets a
 *      basic profile: currency from a static map, tax label = "VAT",
 *      tax rate = 0 (owner sets it explicitly), payment methods =
 *      ['cash', 'card', 'bank'], pharmacy term = "Pharmacy".
 *
 *   3. SANCTIONED — explicitly excluded. The country never appears
 *      in any picker; if a setup wizard receives a sanctioned code
 *      it refuses to proceed. OFAC + EU export-control aligned.
 */

export type CountryCode = string; // ISO-3166-1 alpha-2

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank"
  | "mpesa"           // Kenya, Tanzania, Uganda, DRC
  | "airtel_money"    // EAC + Nigeria
  | "mtn_momo"        // Ghana, Uganda, Cameroon, etc.
  | "tigo_pesa"       // Tanzania
  | "wave"            // Senegal, CI
  | "interac"         // Canada
  | "venmo"           // US
  | "cash_app"        // US
  | "upi"             // India
  | "paytm"           // India
  | "stk_push";       // generic STK

export type ComplianceFeature =
  | "etims"           // Kenya KRA eTIMS
  | "vat3"            // Kenya VAT3 return
  | "sha"             // Kenya SHA insurance
  | "nhif"            // Kenya NHIF (legacy)
  | "kra_pin"         // KRA PIN field
  | "ppb_register"    // Kenya pharmacy controlled register
  | "fb_levy"         // Kenya hospitality F&B levy
  | "kebs_marks"      // Kenya KEBS marks
  | "tin"             // Tanzania
  | "ura"             // Uganda
  | "firs"            // Nigeria
  | "ghra"            // Ghana
  | "sars"            // South Africa
  | "irs_1099"        // US
  | "vat_uk"          // UK
  | "gst_in"          // India
  | "vat_eu";         // EU generic

export interface CountryProfile {
  code: CountryCode;
  name: string;
  flag: string;                          // emoji
  currencyCode: string;                  // ISO 4217
  currencySymbol: string;
  decimals: number;
  taxLabel: string;                      // "VAT" / "GST" / "Sales Tax"
  defaultTaxRate: number;
  paymentMethods: PaymentMethod[];
  complianceFeatures: ComplianceFeature[];
  pharmacyTerm: string;                  // "Dawa" / "Pharmacy" / "Apotek" / "Farmácia"
  phoneCountryCode: string;
  phonePlaceholder: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  /** BCP-47 locale for Intl.* — falls back to "en" if unset. */
  intlLocale: string;
  isSanctioned?: boolean;
}

/* ── Sanctioned (OFAC + EU export-control) ─────────────────────── */
const SANCTIONED_CODES = new Set<CountryCode>([
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "BY", // Belarus
  "RU", // Russia
]);

/* ── Rich profiles for top markets ─────────────────────────────── */
const RICH_PROFILES: Partial<Record<CountryCode, CountryProfile>> = {
  KE: {
    code: "KE", name: "Kenya", flag: "🇰🇪",
    currencyCode: "KES", currencySymbol: "KSh", decimals: 0,
    taxLabel: "VAT", defaultTaxRate: 16,
    paymentMethods: ["cash", "mpesa", "card", "airtel_money", "bank"],
    complianceFeatures: ["etims", "vat3", "sha", "nhif", "kra_pin", "ppb_register", "fb_levy", "kebs_marks"],
    pharmacyTerm: "Dawa",
    phoneCountryCode: "+254", phonePlaceholder: "+254 7XX XXX XXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "en-KE",
  },
  TZ: {
    code: "TZ", name: "Tanzania", flag: "🇹🇿",
    currencyCode: "TZS", currencySymbol: "TSh", decimals: 0,
    taxLabel: "VAT", defaultTaxRate: 18,
    paymentMethods: ["cash", "mpesa", "tigo_pesa", "airtel_money", "card", "bank"],
    complianceFeatures: ["tin"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+255", phonePlaceholder: "+255 7XX XXX XXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "sw-TZ",
  },
  UG: {
    code: "UG", name: "Uganda", flag: "🇺🇬",
    currencyCode: "UGX", currencySymbol: "USh", decimals: 0,
    taxLabel: "VAT", defaultTaxRate: 18,
    paymentMethods: ["cash", "mtn_momo", "airtel_money", "card", "bank"],
    complianceFeatures: ["ura"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+256", phonePlaceholder: "+256 7XX XXX XXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "en-UG",
  },
  RW: {
    code: "RW", name: "Rwanda", flag: "🇷🇼",
    currencyCode: "RWF", currencySymbol: "FRw", decimals: 0,
    taxLabel: "VAT", defaultTaxRate: 18,
    paymentMethods: ["cash", "mtn_momo", "airtel_money", "card", "bank"],
    complianceFeatures: [],
    pharmacyTerm: "Pharmacie",
    phoneCountryCode: "+250", phonePlaceholder: "+250 7XX XXX XXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "rw-RW",
  },
  NG: {
    code: "NG", name: "Nigeria", flag: "🇳🇬",
    currencyCode: "NGN", currencySymbol: "₦", decimals: 0,
    taxLabel: "VAT", defaultTaxRate: 7.5,
    paymentMethods: ["cash", "card", "bank", "airtel_money"],
    complianceFeatures: ["firs"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+234", phonePlaceholder: "+234 8XX XXX XXXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "en-NG",
  },
  GH: {
    code: "GH", name: "Ghana", flag: "🇬🇭",
    currencyCode: "GHS", currencySymbol: "₵", decimals: 2,
    taxLabel: "VAT", defaultTaxRate: 12.5,
    paymentMethods: ["cash", "card", "mtn_momo", "bank"],
    complianceFeatures: ["ghra"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+233", phonePlaceholder: "+233 2X XXX XXXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "en-GH",
  },
  ZA: {
    code: "ZA", name: "South Africa", flag: "🇿🇦",
    currencyCode: "ZAR", currencySymbol: "R", decimals: 2,
    taxLabel: "VAT", defaultTaxRate: 15,
    paymentMethods: ["cash", "card", "bank"],
    complianceFeatures: ["sars"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+27", phonePlaceholder: "+27 XX XXX XXXX",
    dateFormat: "YYYY-MM-DD", intlLocale: "en-ZA",
  },
  US: {
    code: "US", name: "United States", flag: "🇺🇸",
    currencyCode: "USD", currencySymbol: "$", decimals: 2,
    taxLabel: "Sales Tax", defaultTaxRate: 0, // state-level, owner sets it
    paymentMethods: ["cash", "card", "venmo", "cash_app", "bank"],
    complianceFeatures: ["irs_1099"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+1", phonePlaceholder: "+1 (XXX) XXX-XXXX",
    dateFormat: "MM/DD/YYYY", intlLocale: "en-US",
  },
  GB: {
    code: "GB", name: "United Kingdom", flag: "🇬🇧",
    currencyCode: "GBP", currencySymbol: "£", decimals: 2,
    taxLabel: "VAT", defaultTaxRate: 20,
    paymentMethods: ["cash", "card", "bank"],
    complianceFeatures: ["vat_uk"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+44", phonePlaceholder: "+44 7XXX XXXXXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "en-GB",
  },
  IN: {
    code: "IN", name: "India", flag: "🇮🇳",
    currencyCode: "INR", currencySymbol: "₹", decimals: 2,
    taxLabel: "GST", defaultTaxRate: 18,
    paymentMethods: ["cash", "card", "upi", "paytm", "bank"],
    complianceFeatures: ["gst_in"],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "+91", phonePlaceholder: "+91 XXXXX XXXXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "en-IN",
  },
  AE: {
    code: "AE", name: "United Arab Emirates", flag: "🇦🇪",
    currencyCode: "AED", currencySymbol: "د.إ", decimals: 2,
    taxLabel: "VAT", defaultTaxRate: 5,
    paymentMethods: ["cash", "card", "bank"],
    complianceFeatures: [],
    pharmacyTerm: "صيدلية",
    phoneCountryCode: "+971", phonePlaceholder: "+971 5X XXX XXXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "ar-AE",
  },
  EG: {
    code: "EG", name: "Egypt", flag: "🇪🇬",
    currencyCode: "EGP", currencySymbol: "E£", decimals: 2,
    taxLabel: "VAT", defaultTaxRate: 14,
    paymentMethods: ["cash", "card", "bank"],
    complianceFeatures: [],
    pharmacyTerm: "صيدلية",
    phoneCountryCode: "+20", phonePlaceholder: "+20 1X XXXX XXXX",
    dateFormat: "DD/MM/YYYY", intlLocale: "ar-EG",
  },
};

/* ── ISO 3166-1 list for "everywhere else" ─────────────────────── */
// Comprehensive list of ISO codes. Sanctioned codes are filtered out.
// Currency for each comes from the GENERIC_CURRENCY_MAP below; if a
// country isn't in that map it gets USD.
const ALL_ISO_CODES: ReadonlyArray<{ code: CountryCode; name: string; flag: string }> = [
  { code: "AD", name: "Andorra", flag: "🇦🇩" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
  { code: "AG", name: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "AI", name: "Anguilla", flag: "🇦🇮" },
  { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AW", name: "Aruba", flag: "🇦🇼" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BA", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "BB", name: "Barbados", flag: "🇧🇧" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "BI", name: "Burundi", flag: "🇧🇮" },
  { code: "BJ", name: "Benin", flag: "🇧🇯" },
  { code: "BN", name: "Brunei", flag: "🇧🇳" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "BS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹" },
  { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "BZ", name: "Belize", flag: "🇧🇿" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CD", name: "DR Congo", flag: "🇨🇩" },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫" },
  { code: "CG", name: "Congo", flag: "🇨🇬" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "CV", name: "Cape Verde", flag: "🇨🇻" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾" },
  { code: "CZ", name: "Czechia", flag: "🇨🇿" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "DM", name: "Dominica", flag: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "DZ", name: "Algeria", flag: "🇩🇿" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "ER", name: "Eritrea", flag: "🇪🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FJ", name: "Fiji", flag: "🇫🇯" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "GD", name: "Grenada", flag: "🇬🇩" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GM", name: "Gambia", flag: "🇬🇲" },
  { code: "GN", name: "Guinea", flag: "🇬🇳" },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "GY", name: "Guyana", flag: "🇬🇾" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "HT", name: "Haiti", flag: "🇭🇹" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "IS", name: "Iceland", flag: "🇮🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "KH", name: "Cambodia", flag: "🇰🇭" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "LA", name: "Laos", flag: "🇱🇦" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "LC", name: "Saint Lucia", flag: "🇱🇨" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "LR", name: "Liberia", flag: "🇱🇷" },
  { code: "LS", name: "Lesotho", flag: "🇱🇸" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "LY", name: "Libya", flag: "🇱🇾" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "MC", name: "Monaco", flag: "🇲🇨" },
  { code: "MD", name: "Moldova", flag: "🇲🇩" },
  { code: "ME", name: "Montenegro", flag: "🇲🇪" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬" },
  { code: "MK", name: "North Macedonia", flag: "🇲🇰" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" },
  { code: "MO", name: "Macao", flag: "🇲🇴" },
  { code: "MR", name: "Mauritania", flag: "🇲🇷" },
  { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺" },
  { code: "MV", name: "Maldives", flag: "🇲🇻" },
  { code: "MW", name: "Malawi", flag: "🇲🇼" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NE", name: "Niger", flag: "🇳🇪" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PG", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SC", name: "Seychelles", flag: "🇸🇨" },
  { code: "SD", name: "Sudan", flag: "🇸🇩" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "SO", name: "Somalia", flag: "🇸🇴" },
  { code: "SR", name: "Suriname", flag: "🇸🇷" },
  { code: "SS", name: "South Sudan", flag: "🇸🇸" },
  { code: "ST", name: "São Tomé and Príncipe", flag: "🇸🇹" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "SZ", name: "Eswatini", flag: "🇸🇿" },
  { code: "TD", name: "Chad", flag: "🇹🇩" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯" },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "YE", name: "Yemen", flag: "🇾🇪" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
];

/* ── Currency map for non-rich countries ───────────────────────── */
const GENERIC_CURRENCY: Record<CountryCode, { code: string; symbol: string; decimals: number }> = {
  // Eurozone
  AD: { code: "EUR", symbol: "€", decimals: 2 }, AT: { code: "EUR", symbol: "€", decimals: 2 },
  BE: { code: "EUR", symbol: "€", decimals: 2 }, CY: { code: "EUR", symbol: "€", decimals: 2 },
  DE: { code: "EUR", symbol: "€", decimals: 2 }, EE: { code: "EUR", symbol: "€", decimals: 2 },
  ES: { code: "EUR", symbol: "€", decimals: 2 }, FI: { code: "EUR", symbol: "€", decimals: 2 },
  FR: { code: "EUR", symbol: "€", decimals: 2 }, GR: { code: "EUR", symbol: "€", decimals: 2 },
  IE: { code: "EUR", symbol: "€", decimals: 2 }, IT: { code: "EUR", symbol: "€", decimals: 2 },
  LT: { code: "EUR", symbol: "€", decimals: 2 }, LU: { code: "EUR", symbol: "€", decimals: 2 },
  LV: { code: "EUR", symbol: "€", decimals: 2 }, MC: { code: "EUR", symbol: "€", decimals: 2 },
  ME: { code: "EUR", symbol: "€", decimals: 2 }, MT: { code: "EUR", symbol: "€", decimals: 2 },
  NL: { code: "EUR", symbol: "€", decimals: 2 }, PT: { code: "EUR", symbol: "€", decimals: 2 },
  SI: { code: "EUR", symbol: "€", decimals: 2 }, SK: { code: "EUR", symbol: "€", decimals: 2 },
  // CFA franc West/Central
  BF: { code: "XOF", symbol: "CFA", decimals: 0 }, BJ: { code: "XOF", symbol: "CFA", decimals: 0 },
  CI: { code: "XOF", symbol: "CFA", decimals: 0 }, GW: { code: "XOF", symbol: "CFA", decimals: 0 },
  ML: { code: "XOF", symbol: "CFA", decimals: 0 }, NE: { code: "XOF", symbol: "CFA", decimals: 0 },
  SN: { code: "XOF", symbol: "CFA", decimals: 0 }, TG: { code: "XOF", symbol: "CFA", decimals: 0 },
  CF: { code: "XAF", symbol: "FCFA", decimals: 0 }, CG: { code: "XAF", symbol: "FCFA", decimals: 0 },
  CM: { code: "XAF", symbol: "FCFA", decimals: 0 }, GA: { code: "XAF", symbol: "FCFA", decimals: 0 },
  GQ: { code: "XAF", symbol: "FCFA", decimals: 0 }, TD: { code: "XAF", symbol: "FCFA", decimals: 0 },
  // Other key markets
  BD: { code: "BDT", symbol: "৳", decimals: 2 }, BR: { code: "BRL", symbol: "R$", decimals: 2 },
  CA: { code: "CAD", symbol: "$", decimals: 2 }, CH: { code: "CHF", symbol: "Fr", decimals: 2 },
  CL: { code: "CLP", symbol: "$", decimals: 0 }, CN: { code: "CNY", symbol: "¥", decimals: 2 },
  CO: { code: "COP", symbol: "$", decimals: 0 }, CZ: { code: "CZK", symbol: "Kč", decimals: 2 },
  DK: { code: "DKK", symbol: "kr", decimals: 2 }, ET: { code: "ETB", symbol: "Br", decimals: 2 },
  HK: { code: "HKD", symbol: "$", decimals: 2 }, ID: { code: "IDR", symbol: "Rp", decimals: 0 },
  IL: { code: "ILS", symbol: "₪", decimals: 2 }, JP: { code: "JPY", symbol: "¥", decimals: 0 },
  MX: { code: "MXN", symbol: "$", decimals: 2 }, MY: { code: "MYR", symbol: "RM", decimals: 2 },
  NO: { code: "NOK", symbol: "kr", decimals: 2 }, NZ: { code: "NZD", symbol: "$", decimals: 2 },
  PE: { code: "PEN", symbol: "S/", decimals: 2 }, PH: { code: "PHP", symbol: "₱", decimals: 2 },
  PK: { code: "PKR", symbol: "Rs", decimals: 0 }, PL: { code: "PLN", symbol: "zł", decimals: 2 },
  RO: { code: "RON", symbol: "lei", decimals: 2 }, SA: { code: "SAR", symbol: "ر.س", decimals: 2 },
  SE: { code: "SEK", symbol: "kr", decimals: 2 }, SG: { code: "SGD", symbol: "$", decimals: 2 },
  TH: { code: "THB", symbol: "฿", decimals: 2 }, TR: { code: "TRY", symbol: "₺", decimals: 2 },
  UA: { code: "UAH", symbol: "₴", decimals: 2 }, VN: { code: "VND", symbol: "₫", decimals: 0 },
  ZM: { code: "ZMW", symbol: "ZK", decimals: 2 }, ZW: { code: "ZWL", symbol: "$", decimals: 2 },
  AU: { code: "AUD", symbol: "$", decimals: 2 },
};

/* ── Public API ────────────────────────────────────────────────── */

export const SANCTIONED = SANCTIONED_CODES;

/** Build a CountryProfile for any ISO code. Uses RICH_PROFILES first, then a generic template. */
export function getCountry(code: CountryCode): CountryProfile | null {
  if (SANCTIONED_CODES.has(code)) return null;
  const rich = RICH_PROFILES[code];
  if (rich) return rich;
  const meta = ALL_ISO_CODES.find((c) => c.code === code);
  if (!meta) return null;
  const cur = GENERIC_CURRENCY[code] ?? { code: "USD", symbol: "$", decimals: 2 };
  return {
    code,
    name: meta.name,
    flag: meta.flag,
    currencyCode: cur.code,
    currencySymbol: cur.symbol,
    decimals: cur.decimals,
    taxLabel: "VAT",
    defaultTaxRate: 0,
    paymentMethods: ["cash", "card", "bank"],
    complianceFeatures: [],
    pharmacyTerm: "Pharmacy",
    phoneCountryCode: "",
    phonePlaceholder: "",
    dateFormat: "DD/MM/YYYY",
    intlLocale: "en",
  };
}

/** Every country except sanctioned ones. */
export function listCountries(): CountryProfile[] {
  return ALL_ISO_CODES
    .filter((c) => !SANCTIONED_CODES.has(c.code))
    .map((c) => getCountry(c.code))
    .filter((c): c is CountryProfile => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Top markets first — used in setup wizard quick-pick row. */
export const TOP_MARKETS: CountryCode[] = [
  "KE", "TZ", "UG", "RW", "NG", "GH", "ZA", "US", "GB", "IN", "AE", "EG",
];
