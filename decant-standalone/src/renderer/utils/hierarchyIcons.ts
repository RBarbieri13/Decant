import {
  // Segment icons
  IconBrain,
  IconCode,
  IconChartBar,
  IconTrophy,
  IconHeartbeat,
  IconBriefcase,
  IconDeviceGamepad2,
  IconHome,
  IconFlask,
  IconPalette,

  // AI & ML categories
  IconMessageChatbot,
  IconRobot,
  IconCube,
  IconServer,
  IconLanguage,
  IconEye,
  IconSparkles,
  IconScale,
  IconMicroscope,
  IconDots,

  // Technology categories
  IconBrowser,
  IconDeviceMobile,
  IconTerminal2,
  IconCloud,
  IconShield,
  IconDatabase,
  IconApi,
  IconPackage,
  IconCpu,

  // Finance categories
  IconTrendingUp,
  IconCurrencyBitcoin,
  IconReportAnalytics,
  IconBuildingBank,
  IconReceipt,
  IconWallet,
  IconChartCandle,
  IconBuilding,
  IconCoin,

  // Sports categories
  IconBallAmericanFootball,
  IconChess,
  IconBarbell,
  IconRun,
  IconStretching,
  IconBallBasketball,
  IconBallBaseball,
  IconBallFootball,
  IconMedal,

  // Health categories
  IconStethoscope,
  IconMoodHappy,
  IconApple,
  IconMoon,
  IconAccessible,
  IconYoga,
  IconBabyCarriage,
  IconOld,
  IconVirus,

  // Business categories
  IconTargetArrow,
  IconUsers,
  IconBox,
  IconSpeakerphone,
  IconCash,
  IconSettings,
  IconUserPlus,
  IconRocket,
  IconBuildingSkyscraper,

  // Entertainment categories
  IconDeviceGamepad,
  IconMusic,
  IconMovie,
  IconBrandYoutube,
  IconBrandInstagram,
  IconStar,
  IconMicrophone,
  IconCrown,
  IconTicket,

  // Lifestyle categories
  IconSmartHome,
  IconShirt,
  IconToolsKitchen2,
  IconPlane,
  IconHeart,
  IconFriends,
  IconPaw,
  IconPuzzle,
  IconPlant,

  // Science categories
  IconAtom,
  IconDna,
  IconTestPipe,
  IconTelescope,
  IconLeaf,
  IconMath,
  IconEngine,
  IconUsersGroup,
  IconMoodSearch as IconPsychology,

  // Creative categories
  IconLayout,
  IconVectorTriangle,
  IconPencil,
  IconCamera,
  IconVideo,
  IconHeadphones,
  IconBrush,
  IconGif,
  IconTypography,

  // Content type icons
  IconTool,
  IconFileText,
  IconSchool,
  IconGitBranch,
  IconBook,
  IconCloudComputing,
  IconPhoto,
  IconNews,
  IconNotebook,
  IconQuestionMark,

  // Misc
  IconFolder,
  IconFolderOpen,
  IconWorld,
  IconCircle,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';

const ICON_SIZE = 16;
const ICON_STROKE = 1.5;

export interface HierarchyIconProps {
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}

// Segment code -> Icon component
const SEGMENT_ICONS: Record<string, Icon> = {
  A: IconBrain,
  T: IconCode,
  F: IconChartBar,
  S: IconTrophy,
  H: IconHeartbeat,
  B: IconBriefcase,
  E: IconDeviceGamepad2,
  L: IconHome,
  X: IconFlask,
  C: IconPalette,
};

// Category code -> Icon component (keyed by "SEG.CAT")
const CATEGORY_ICONS: Record<string, Icon> = {
  // AI & ML
  'A.LLM': IconMessageChatbot,
  'A.AGT': IconRobot,
  'A.FND': IconCube,
  'A.MLO': IconServer,
  'A.NLP': IconLanguage,
  'A.CVS': IconEye,
  'A.GEN': IconSparkles,
  'A.ETH': IconScale,
  'A.RES': IconMicroscope,
  'A.OTH': IconDots,

  // Technology
  'T.WEB': IconBrowser,
  'T.MOB': IconDeviceMobile,
  'T.DEV': IconTerminal2,
  'T.CLD': IconCloud,
  'T.SEC': IconShield,
  'T.DAT': IconDatabase,
  'T.API': IconApi,
  'T.OPS': IconPackage,
  'T.HRD': IconCpu,
  'T.OTH': IconDots,

  // Finance
  'F.INV': IconTrendingUp,
  'F.CRY': IconCurrencyBitcoin,
  'F.FPA': IconReportAnalytics,
  'F.BNK': IconBuildingBank,
  'F.TAX': IconReceipt,
  'F.PFN': IconWallet,
  'F.MKT': IconChartCandle,
  'F.REL': IconBuilding,
  'F.ECN': IconCoin,
  'F.OTH': IconDots,

  // Sports
  'S.NFL': IconBallAmericanFootball,
  'S.FAN': IconChess,
  'S.FIT': IconBarbell,
  'S.RUN': IconRun,
  'S.GYM': IconStretching,
  'S.NBA': IconBallBasketball,
  'S.MLB': IconBallBaseball,
  'S.SOC': IconBallFootball,
  'S.OLY': IconMedal,
  'S.OTH': IconDots,

  // Health
  'H.MED': IconStethoscope,
  'H.MNT': IconMoodHappy,
  'H.NUT': IconApple,
  'H.SLP': IconMoon,
  'H.ACC': IconAccessible,
  'H.WEL': IconYoga,
  'H.FRT': IconBabyCarriage,
  'H.AGE': IconOld,
  'H.DIS': IconVirus,
  'H.OTH': IconDots,

  // Business
  'B.STR': IconTargetArrow,
  'B.MNG': IconUsers,
  'B.PRD': IconBox,
  'B.MKT': IconSpeakerphone,
  'B.SAL': IconCash,
  'B.OPS': IconSettings,
  'B.HRS': IconUserPlus,
  'B.STP': IconRocket,
  'B.ENT': IconBuildingSkyscraper,
  'B.OTH': IconDots,

  // Entertainment
  'E.GAM': IconDeviceGamepad,
  'E.MUS': IconMusic,
  'E.MOV': IconMovie,
  'E.STR': IconBrandYoutube,
  'E.SOC': IconBrandInstagram,
  'E.POP': IconStar,
  'E.POD': IconMicrophone,
  'E.CEL': IconCrown,
  'E.EVT': IconTicket,
  'E.OTH': IconDots,

  // Lifestyle
  'L.HOM': IconSmartHome,
  'L.FAS': IconShirt,
  'L.FOD': IconToolsKitchen2,
  'L.TRV': IconPlane,
  'L.REL': IconHeart,
  'L.PAR': IconFriends,
  'L.PET': IconPaw,
  'L.HOB': IconPuzzle,
  'L.GAR': IconPlant,
  'L.OTH': IconDots,

  // Science
  'X.PHY': IconAtom,
  'X.BIO': IconDna,
  'X.CHM': IconTestPipe,
  'X.AST': IconTelescope,
  'X.ENV': IconLeaf,
  'X.MAT': IconMath,
  'X.ENG': IconEngine,
  'X.SOC': IconUsersGroup,
  'X.PSY': IconPsychology,
  'X.OTH': IconDots,

  // Creative
  'C.UXD': IconLayout,
  'C.GRD': IconVectorTriangle,
  'C.WRT': IconPencil,
  'C.PHO': IconCamera,
  'C.VID': IconVideo,
  'C.AUD': IconHeadphones,
  'C.ART': IconBrush,
  'C.ANI': IconGif,
  'C.TYP': IconTypography,
  'C.OTH': IconDots,
};

// Content type code -> Icon component
const CONTENT_TYPE_ICONS: Record<string, Icon> = {
  T: IconTool,
  A: IconFileText,
  V: IconVideo,
  P: IconSchool,
  R: IconGitBranch,
  G: IconBook,
  S: IconCloudComputing,
  C: IconSchool,
  I: IconPhoto,
  N: IconNews,
  K: IconNotebook,
  U: IconQuestionMark,
};

export function getSegmentIcon(segmentCode: string): Icon {
  return SEGMENT_ICONS[segmentCode] || IconFolder;
}

export function getCategoryIcon(segmentCode: string, categoryCode: string): Icon {
  return CATEGORY_ICONS[`${segmentCode}.${categoryCode}`] || IconFolder;
}

export function getContentTypeIcon(contentTypeCode: string): Icon {
  return CONTENT_TYPE_ICONS[contentTypeCode] || IconCircle;
}

/**
 * Get the appropriate icon for a tree node based on its ID and type.
 * Tree node IDs follow patterns: seg-A, cat-A-LLM, or item UUIDs.
 */
export function getTreeNodeIcon(nodeId: string, nodeType?: string): Icon {
  if (nodeId.startsWith('seg-')) {
    const segCode = nodeId.replace('seg-', '');
    return getSegmentIcon(segCode);
  }

  if (nodeId.startsWith('cat-')) {
    const parts = nodeId.replace('cat-', '').split('-');
    const segCode = parts[0];
    const catCode = parts[1];
    return getCategoryIcon(segCode, catCode);
  }

  if (nodeType === 'organization') {
    return IconWorld;
  }

  return IconFileText;
}

/**
 * Render props for consistent icon styling
 */
export function getIconProps(overrides?: HierarchyIconProps) {
  return {
    size: overrides?.size ?? ICON_SIZE,
    stroke: overrides?.stroke ?? ICON_STROKE,
    color: overrides?.color,
    className: overrides?.className ?? 'hierarchy-icon',
  };
}

// Re-export for direct use
export { IconFolder, IconFolderOpen, IconWorld, IconFileText };
