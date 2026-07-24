/**
 * 前後端共用的 zod schema。
 * 見 docs/spec/04-api-contract.md。
 */
export {
  uuidSchema,
  emailSchema,
  slugSchema,
  hexColorSchema,
  paginationSchema,
  type Pagination,
} from './common.js'

export {
  ALLOWED_MIME,
  ALL_ALLOWED_MIME,
  LIMITS,
  kindForMime,
  limitForMime,
  uploadIntentSchema,
  assetListQuerySchema,
  assetPatchSchema,
  sniffMimeType,
  mimeMatches,
  type AssetKind,
  type UploadIntentInput,
  type AssetListQuery,
  type AssetPatchInput,
} from './assets.js'

export {
  themeCreateSchema,
  themePatchSchema,
  themeFromImageSchema,
  themeImportSchema,
  contrastCheckSchema,
  type ThemeCreateInput,
  type ThemePatchInput,
} from './themes.js'

export {
  backgroundTypeSchema,
  gradientSpecSchema,
  backgroundCreateSchema,
  backgroundPatchSchema,
  playModeSchema,
  transitionSchema,
  ALPHA_TRANSITIONS,
  scheduleSchema,
  playlistCreateSchema,
  playlistPatchSchema,
  playlistItemsSchema,
  reorderSchema,
  type BackgroundCreateInput,
  type PlaylistCreateInput,
  type GradientSpec,
  type ScheduleSpec,
} from './backgrounds.js'

export { localHour, localDate, slotForHour, seededIndex } from './schedule.js'

export { parseVideoDuration, type VideoMetadata } from './video-metadata.js'

export {
  CLIENT_ROTATED,
  needsClientRotation,
  intervalMsFor,
  perLoginIndex,
  nextIndex,
  validateSlots,
  hoursIn,
  uncoveredHours,
  type PlayMode,
  type Slot,
} from './playback.js'

export {
  FORBIDDEN_PATTERNS,
  passesContentFilter,
  contentFilterReason,
  quoteSchema,
  promptSchema,
  greetingSchema,
  greetingsFileSchema,
  surpriseSchema,
  chainLinkSchema,
  GREETING_SLOTS,
  SURPRISE_RARITIES,
  type Quote,
  type Prompt,
  type Greeting,
  type Surprise,
  type ChainLink,
  type GreetingSlot,
  type SurpriseRarity,
} from './content.js'

export {
  pickDailyItem,
  hashToUnit,
  daysBetween,
  greetingSlotForHour,
  type PoolEntry,
  type RecentItem,
  type SpaceContext,
  type SelectInput,
} from './daily-select.js'

export { passwordStrength, PASSWORD_MIN_LENGTH, type PasswordStrength } from './password.js'

export {
  PROJECT_STATUSES,
  projectCreateSchema,
  projectPatchSchema,
  projectListQuerySchema,
  type ProjectStatus,
  type ProjectCreateInput,
  type ProjectPatchInput,
  type ProjectListQuery,
} from './projects.js'

export {
  designFileCreateSchema,
  designFilePatchSchema,
  designFileListQuerySchema,
  snapshotCreateSchema,
  snapshotCompareSchema,
  type DesignFileCreateInput,
  type DesignFilePatchInput,
  type DesignFileListQuery,
  type SnapshotCreateInput,
  type SnapshotCompareInput,
} from './design.js'

export {
  TIMELINE_VIEWS,
  TIMELINE_VISIBILITY,
  timelineListQuerySchema,
  timelinePatchSchema,
  type TimelineView,
  type TimelineVisibility,
  type TimelineListQuery,
  type TimelinePatchInput,
} from './timeline.js'

export {
  MEMORY_SENSITIVITY,
  memoryCreateSchema,
  memoryPatchSchema,
  memoryListQuerySchema,
  type MemorySensitivity,
  type MemoryCreateInput,
  type MemoryPatchInput,
  type MemoryListQuery,
} from './memory.js'
