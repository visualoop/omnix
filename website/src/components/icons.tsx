/**
 * Single icon entrypoint — Phosphor only.
 * NEVER import from 'lucide-react'. Always import from this file.
 *
 * Two import styles supported:
 *   1. `import { Icon } from '@/components/icons'` → <Icon.ArrowRight />
 *   2. `import { ArrowRight } from '@/components/icons'` → <ArrowRight />
 */

import {
  ArrowDown as PhArrowDown,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowUpRight as PhArrowUpRight,
  ArrowsLeftRight as PhArrowsLeftRight,
  Bell as PhBell,
  Buildings as PhBuildings,
  CalendarBlank as PhCalendar,
  CaretDown as PhCaretDown,
  ChartBar as PhChartBar,
  ChartLine as PhChartLine,
  ChatCircle as PhChatCircle,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CircleNotch as PhCircleNotch,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  CloudArrowUp as PhCloudArrowUp,
  Code as PhCode,
  Coffee as PhCoffee,
  Coins as PhCoins,
  CopySimple as PhCopySimple,
  Cpu as PhCpu,
  CreditCard as PhCreditCard,
  Database as PhDatabase,
  DesktopTower as PhDesktopTower,
  DotsThree as PhDotsThree,
  Download as PhDownload,
  EnvelopeSimple as PhEnvelope,
  Eye as PhEye,
  File as PhFile,
  FileText as PhFileText,
  Files as PhFiles,
  FloppyDisk as PhFloppy,
  GearSix as PhGear,
  GlobeHemisphereWest as PhGlobe,
  Hammer as PhHammer,
  HandCoins as PhHandCoins,
  HardDrives as PhHardDrives,
  Heart as PhHeart,
  HouseSimple as PhHouse,
  IdentificationCard as PhId,
  Info as PhInfo,
  Key as PhKey,
  Lifebuoy as PhLifebuoy,
  Lightning as PhLightning,
  ListBullets as PhList,
  Lock as PhLock,
  MagnifyingGlass as PhSearch,
  MapPin as PhMapPin,
  MapTrifold as PhMap,
  Megaphone as PhMegaphone,
  Minus as PhMinus,
  Monitor as PhMonitor,
  Notebook as PhNotebook,
  Package as PhPackage,
  PaintBrush as PhPaintBrush,
  Path as PhPath,
  PencilSimpleLine as PhPencil,
  Phone as PhPhone,
  Pill as PhPill,
  Plus as PhPlus,
  Question as PhQuestion,
  Receipt as PhReceipt,
  Barcode as PhBarcode,
  Scissors as PhScissors,
  ShieldCheck as PhShield,
  ShoppingBagOpen as PhShoppingBag,
  Sliders as PhSliders,
  Sparkle as PhSparkle,
  Stack as PhStack,
  Storefront as PhStorefront,
  TrayArrowDown as PhTray,
  TrendUp as PhTrendUp,
  Truck as PhTruck,
  User as PhUser,
  UserCircle as PhUserCircle,
  Users as PhUsers,
  Warning as PhWarning,
  WhatsappLogo as PhWhatsapp,
  X as PhX,
} from '@phosphor-icons/react/dist/ssr'

/* ── Inline brand icons (Phosphor SSR build doesn't ship these) ── */

export const Twitter = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

export const LinkedIn = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45z" />
  </svg>
)

export const Github = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .3a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2c-3.34.72-4.04-1.61-4.04-1.61C4.42 18.07 3.63 17.7 3.63 17.7c-1.09-.74.09-.73.09-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.46-2.38 1.23-3.22-.13-.3-.54-1.52.11-3.18 0 0 1-.32 3.3 1.23a11.46 11.46 0 016 0c2.28-1.55 3.28-1.23 3.28-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0012 .3" />
  </svg>
)

/* ── Named exports (Lucide-compatible names → Phosphor under the hood) ── */

export const ArrowDown = PhArrowDown
export const ArrowLeft = PhArrowLeft
export const ArrowRight = PhArrowRight
export const ArrowUpRight = PhArrowUpRight
export const ArrowRightLeft = PhArrowsLeftRight
export const Bell = PhBell
export const Box = PhPackage
export const BookOpen = PhNotebook
export const Building2 = PhBuildings
export const Buildings = PhBuildings
export const Calendar = PhCalendar
export const CalendarBlank = PhCalendar
export const CaretDown = PhCaretDown
export const ChartBar = PhChartBar
export const ChartLine = PhChartLine
export const ChatCircle = PhChatCircle
export const Check = PhCheck
export const CheckCircle2 = PhCheckCircle
export const ChevronDown = PhCaretDown
export const ChevronUp = PhCaretDown
export const ChefHat = PhCoffee
export const ClipboardList = PhClipboardText
export const ClipboardText = PhClipboardText
export const Clock = PhClock
export const CloudArrowUp = PhCloudArrowUp
export const CloudUpload = PhCloudArrowUp
export const Code = PhCode
export const Coffee = PhCoffee
export const Coins = PhCoins
export const Copy = PhCopySimple
export const CopySimple = PhCopySimple
export const Cpu = PhCpu
export const CreditCard = PhCreditCard
export const Crown = PhSparkle
export const Database = PhDatabase
export const DesktopTower = PhDesktopTower
export const Download = PhDownload
export const Email = PhEnvelope
export const EnvelopeSimple = PhEnvelope
export const Eye = PhEye
export const File = PhFile
export const FileBarChart = PhChartBar
export const FileQuestion = PhQuestion
export const FileText = PhFileText
export const Files = PhFiles
export const FileWarning = PhWarning
export const FloppyDisk = PhFloppy
export const GearSix = PhGear
export const Gift = PhHeart
export const Globe = PhGlobe
export const GlobeHemisphereWest = PhGlobe
export const Grid3x3 = PhStack
export const Hammer = PhHammer
export const HandCoins = PhHandCoins
export const HardDrive = PhHardDrives
export const HardDrives = PhHardDrives
export const Heart = PhHeart
export const HelpCircle = PhQuestion
export const HouseSimple = PhHouse
export const Hourglass = PhClock
export const IdentificationCard = PhId
export const Info = PhInfo
export const KeyRound = PhKey
export const Landmark = PhBuildings
export const LayoutDashboard = PhStack
export const Lifebuoy = PhLifebuoy
export const Lightning = PhLightning
export const ListBullets = PhList
export const Lock = PhLock
export const LogOut = PhArrowRight
export const Mail = PhEnvelope
export const Map = PhMap
export const MapPin = PhMapPin
export const Megaphone = PhMegaphone
export const MemoryStick = PhHardDrives
export const Menu = PhList
export const MessageCircle = PhChatCircle
export const Minus = PhMinus
export const Monitor = PhMonitor
export const Notebook = PhNotebook
export const Package = PhPackage
export const PackageCheck = PhPackage
export const PaintBrush = PhPaintBrush
export const Path = PhPath
export const PencilSimpleLine = PhPencil
export const PenTool = PhPencil
export const Percent = PhChartLine
export const Phone = PhPhone
export const Pill = PhPill
export const Plus = PhPlus
export const Question = PhQuestion
export const Receipt = PhReceipt
export const ReceiptText = PhReceipt
export const RefreshCw = PhArrowsLeftRight
export const Ruler = PhBarcode
export const Save = PhFloppy
export const ScanBarcode = PhBarcode
export const ScanLine = PhSearch
export const Search = PhSearch
export const Send = PhArrowRight
export const Settings = PhGear
export const Shield = PhShield
export const ShieldCheck = PhShield
export const ShoppingBag = PhShoppingBag
export const ShoppingBagOpen = PhShoppingBag
export const Sliders = PhSliders
export const Smartphone = PhPhone
export const Soup = PhCoffee
export const Sparkle = PhSparkle
export const Sparkles = PhSparkle
export const Split = PhArrowsLeftRight
export const Stack = PhStack
export const Stethoscope = PhHeart
export const Store = PhStorefront
export const Storefront = PhStorefront
export const TrayArrowDown = PhTray
export const TrendUp = PhTrendUp
export const TrendingUp = PhTrendUp
export const TriangleAlert = PhWarning
export const AlertCircle = PhWarning
export const AlertTriangle = PhWarning
export const Truck = PhTruck
export const User = PhUser
export const UserCircle = PhUserCircle
export const Users = PhUsers
export const UtensilsCrossed = PhCoffee
export const Warehouse = PhBuildings
export const Warning = PhWarning
export const WhatsappLogo = PhWhatsapp
export const Wrench = PhHammer
export const X = PhX
export const Banknote = PhHandCoins
export const Scissors = PhScissors
export const CircleNotch = PhCircleNotch
export const ArrowsLeftRight = PhArrowsLeftRight
export const DotsThree = PhDotsThree
export const MagnifyingGlass = PhSearch
export const CurrencyDollar = PhCoins

/* ── Composite namespace export (matches Lucide naming) ── */

export const Icon = {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  AlertCircle,
  Banknote,
  Bell,
  BookOpen,
  Box,
  Building2,
  Calendar,
  ChartBar,
  ChartLine,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ClipboardText,
  Clock,
  Close: X,
  Cloud: CloudUpload,
  CloudUpload,
  Code,
  Coffee,
  Coins,
  Copy,
  CreditCard,
  Cpu,
  Database,
  Desktop: DesktopTower,
  Download,
  Email,
  Eye,
  File,
  FileText,
  Files,
  FloppyDisk,
  Github,
  Globe,
  Hammer,
  HandCoins,
  HardDrives,
  Heart,
  HelpCircle,
  HouseSimple,
  Info,
  KeyRound,
  Lifebuoy,
  Lightning,
  ListBullets,
  LinkedIn,
  Lock,
  Mail,
  Map,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Notebook,
  Package,
  Path,
  Phone,
  Pill,
  Plus,
  Question,
  Receipt,
  Save,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkle,
  Sparkles,
  Stack,
  Storefront,
  Truck,
  TrendingUp,
  TriangleAlert,
  Twitter,
  User,
  UserCircle,
  Users,
  Warning,
  WhatsApp: WhatsappLogo,
  Wrench,
  X,
}

export type IconComponent = (props: {
  className?: string
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
}) => React.ReactElement
