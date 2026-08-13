-- Public baseline for new, empty MySQL databases.
-- Existing deployments must retain their original Prisma migration history.

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'VIEWER') NOT NULL DEFAULT 'ADMIN',
    `name` VARCHAR(100) NULL,
    `avatar` TEXT NULL,
    `bio` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `content` JSON NOT NULL,
    `excerpt` TEXT NULL,
    `titleI18n` JSON NULL,
    `slugI18n` JSON NULL,
    `excerptI18n` JSON NULL,
    `contentI18n` JSON NULL,
    `seoI18n` JSON NULL,
    `coverImage` TEXT NULL,
    `coverRatio` VARCHAR(10) NOT NULL DEFAULT '3:4',
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `categoryId` VARCHAR(191) NULL,
    `ctaProductId` VARCHAR(191) NULL,
    `ctaLabel` VARCHAR(120) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `shareCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Post_slug_key`(`slug`),
    INDEX `Post_status_idx`(`status`),
    INDEX `Post_categoryId_idx`(`categoryId`),
    INDEX `Post_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Work` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `titleI18n` JSON NULL,
    `slugI18n` JSON NULL,
    `workType` ENUM('DESIGN', 'DEVELOPMENT') NOT NULL DEFAULT 'DESIGN',
    `description` TEXT NULL,
    `content` JSON NULL,
    `descriptionI18n` JSON NULL,
    `contentI18n` JSON NULL,
    `seoI18n` JSON NULL,
    `coverImage` TEXT NOT NULL,
    `coverRatio` VARCHAR(10) NOT NULL DEFAULT '3:4',
    `images` JSON NOT NULL,
    `currentVersion` VARCHAR(20) NULL,
    `price` DECIMAL(10, 2) NULL,
    `isFree` BOOLEAN NOT NULL DEFAULT false,
    `figmaUrl` TEXT NULL,
    `deliveryUrl` TEXT NULL,
    `fileUrl` TEXT NULL,
    `fileName` VARCHAR(255) NULL,
    `demoUrl` TEXT NULL,
    `demoQrCode` TEXT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `categoryId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Work_slug_key`(`slug`),
    INDEX `Work_status_idx`(`status`),
    INDEX `Work_workType_idx`(`workType`),
    INDEX `Work_categoryId_idx`(`categoryId`),
    INDEX `Work_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkVersion` (
    `id` VARCHAR(191) NOT NULL,
    `workId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(20) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `changelog` TEXT NULL,
    `figmaUrl` TEXT NULL,
    `deliveryUrl` TEXT NULL,
    `fileUrl` TEXT NULL,
    `fileName` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkVersion_workId_idx`(`workId`),
    UNIQUE INDEX `WorkVersion_workId_version_key`(`workId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(64) NOT NULL,
    `workId` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NULL,
    `upgradeFromId` VARCHAR(64) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `buyerEmail` VARCHAR(255) NOT NULL,
    `buyerName` VARCHAR(100) NULL,
    `buyerLocale` ENUM('ZH', 'EN') NOT NULL DEFAULT 'ZH',
    `paymentId` VARCHAR(64) NULL,
    `paidAt` DATETIME(3) NULL,
    `downloadToken` VARCHAR(64) NULL,
    `downloadCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderNo_key`(`orderNo`),
    UNIQUE INDEX `Order_downloadToken_key`(`downloadToken`),
    INDEX `Order_status_idx`(`status`),
    INDEX `Order_workId_idx`(`workId`),
    INDEX `Order_versionId_idx`(`versionId`),
    INDEX `Order_buyerEmail_idx`(`buyerEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `nameI18n` JSON NULL,
    `slugI18n` JSON NULL,
    `type` ENUM('POST', 'WORK', 'DESIGN', 'DEVELOPMENT', 'TUTORIAL') NOT NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `nameI18n` JSON NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Media` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `url` TEXT NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastReferencedAt` DATETIME(3) NULL,
    `cleanupAt` DATETIME(3) NULL,

    INDEX `Media_type_idx`(`type`),
    INDEX `Media_entityType_idx`(`entityType`),
    INDEX `Media_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `Media_cleanupAt_idx`(`cleanupAt`),
    INDEX `Media_lastReferencedAt_idx`(`lastReferencedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'settings',
    `siteName` VARCHAR(255) NOT NULL DEFAULT 'Fan''s Studio',
    `defaultLocale` ENUM('ZH', 'EN') NOT NULL DEFAULT 'ZH',
    `avatar` TEXT NULL,
    `socialLinks` JSON NULL,
    `about` JSON NULL,
    `nav` JSON NULL,
    `navI18n` JSON NULL,
    `pageCopy` JSON NULL,
    `pageCopyI18n` JSON NULL,
    `aiAssistant` JSON NULL,
    `aiAssistantI18n` JSON NULL,
    `aiModelConfig` JSON NULL,
    `theme` JSON NULL,
    `footer` JSON NULL,
    `footerI18n` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteStat` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'site',
    `pageViews` INTEGER NOT NULL DEFAULT 0,
    `baseVisits` INTEGER NOT NULL DEFAULT 0,
    `basePasses` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VideoTutorial` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `titleI18n` JSON NULL,
    `slugI18n` JSON NULL,
    `description` TEXT NULL,
    `descriptionI18n` JSON NULL,
    `seoI18n` JSON NULL,
    `videoUrl` TEXT NOT NULL,
    `thumbnail` TEXT NULL,
    `coverRatio` VARCHAR(10) NOT NULL DEFAULT '3:4',
    `categoryId` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VideoTutorial_slug_key`(`slug`),
    INDEX `VideoTutorial_categoryId_idx`(`categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestbookMessage` (
    `id` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(60) NULL,
    `content` TEXT NOT NULL,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `isOwner` BOOLEAN NOT NULL DEFAULT false,
    `ipHash` VARCHAR(64) NULL,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GuestbookMessage_parentId_idx`(`parentId`),
    INDEX `GuestbookMessage_hidden_createdAt_idx`(`hidden`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeSource` (
    `id` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('POST', 'WORK', 'TUTORIAL', 'SETTINGS') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `locale` ENUM('ZH', 'EN') NOT NULL DEFAULT 'ZH',
    `slug` VARCHAR(255) NULL,
    `title` VARCHAR(255) NOT NULL,
    `url` TEXT NOT NULL,
    `status` ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `hash` VARCHAR(64) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeSource_status_idx`(`status`),
    INDEX `KnowledgeSource_sourceType_idx`(`sourceType`),
    INDEX `KnowledgeSource_locale_idx`(`locale`),
    UNIQUE INDEX `KnowledgeSource_sourceType_sourceId_locale_key`(`sourceType`, `sourceId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `contentText` LONGTEXT NOT NULL,
    `locale` ENUM('ZH', 'EN') NOT NULL DEFAULT 'ZH',
    `contentTokens` INTEGER NOT NULL DEFAULT 0,
    `embedding` JSON NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeChunk_sourceId_idx`(`sourceId`),
    INDEX `KnowledgeChunk_locale_idx`(`locale`),
    UNIQUE INDEX `KnowledgeChunk_sourceId_chunkIndex_key`(`sourceId`, `chunkIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeAsset` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `assetType` ENUM('IMAGE') NOT NULL DEFAULT 'IMAGE',
    `url` TEXT NOT NULL,
    `locale` ENUM('ZH', 'EN') NOT NULL DEFAULT 'ZH',
    `caption` VARCHAR(255) NULL,
    `ocrText` TEXT NULL,
    `embedding` JSON NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `hash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeAsset_sourceId_idx`(`sourceId`),
    INDEX `KnowledgeAsset_locale_idx`(`locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeSyncJob` (
    `id` VARCHAR(191) NOT NULL,
    `jobType` ENUM('UPSERT_SOURCE', 'DELETE_SOURCE', 'FULL_REBUILD') NOT NULL,
    `payload` JSON NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeSyncJob_status_idx`(`status`),
    INDEX `KnowledgeSyncJob_jobType_idx`(`jobType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `blurb` VARCHAR(255) NULL,
    `landingPath` VARCHAR(255) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `isAllAccess` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entitlement` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `isLifetime` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `source` ENUM('PURCHASE', 'COMP') NOT NULL DEFAULT 'PURCHASE',
    `note` VARCHAR(255) NULL,
    `sourceOrderId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Entitlement_productId_idx`(`productId`),
    INDEX `Entitlement_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `Entitlement_memberId_productId_key`(`memberId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Member` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NULL,
    `wechatOpenId` VARCHAR(64) NULL,
    `phone` VARCHAR(20) NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Member_email_key`(`email`),
    UNIQUE INDEX `Member_wechatOpenId_key`(`wechatOpenId`),
    UNIQUE INDEX `Member_phone_key`(`phone`),
    INDEX `Member_archivedAt_idx`(`archivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberSession` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `MemberSession_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipPlan` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `key` ENUM('MONTH', 'YEAR', 'LIFETIME', 'QUARTER') NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `originalPrice` DECIMAL(10, 2) NULL,
    `durationDays` INTEGER NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `badge` VARCHAR(50) NULL,
    `recommended` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipPlan_productId_key_key`(`productId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipOrder` (
    `id` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(64) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `promoCodeId` VARCHAR(191) NULL,
    `promoCodeText` VARCHAR(64) NULL,
    `planKey` ENUM('MONTH', 'YEAR', 'LIFETIME', 'QUARTER') NULL,
    `planName` VARCHAR(100) NOT NULL,
    `source` ENUM('PURCHASE', 'COMP') NOT NULL DEFAULT 'PURCHASE',
    `note` VARCHAR(255) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `paymentId` VARCHAR(64) NULL,
    `grantsDays` INTEGER NULL,
    `isLifetime` BOOLEAN NOT NULL DEFAULT false,
    `buyerEmail` VARCHAR(255) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipOrder_orderNo_key`(`orderNo`),
    INDEX `MembershipOrder_status_idx`(`status`),
    INDEX `MembershipOrder_source_idx`(`source`),
    INDEX `MembershipOrder_productId_idx`(`productId`),
    INDEX `MembershipOrder_memberId_idx`(`memberId`),
    INDEX `MembershipOrder_buyerEmail_idx`(`buyerEmail`),
    INDEX `MembershipOrder_promoCodeId_idx`(`promoCodeId`),
    INDEX `MembershipOrder_archivedAt_idx`(`archivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `orderNo` VARCHAR(64) NULL,
    `memberId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `email` VARCHAR(255) NULL,
    `type` VARCHAR(64) NOT NULL,
    `level` VARCHAR(16) NOT NULL DEFAULT 'INFO',
    `message` VARCHAR(255) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MembershipEvent_orderNo_idx`(`orderNo`),
    INDEX `MembershipEvent_memberId_idx`(`memberId`),
    INDEX `MembershipEvent_email_idx`(`email`),
    INDEX `MembershipEvent_type_idx`(`type`),
    INDEX `MembershipEvent_level_idx`(`level`),
    INDEX `MembershipEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoCode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `planKey` ENUM('MONTH', 'YEAR', 'LIFETIME', 'QUARTER') NULL,
    `percentOff` INTEGER NOT NULL,
    `maxRedemptions` INTEGER NULL,
    `redeemedCount` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromoCode_code_key`(`code`),
    INDEX `PromoCode_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationCode` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VerificationCode_email_idx`(`email`),
    INDEX `VerificationCode_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_PostToTag` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_PostToTag_AB_unique`(`A`, `B`),
    INDEX `_PostToTag_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TagToWork` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TagToWork_AB_unique`(`A`, `B`),
    INDEX `_TagToWork_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TagToVideoTutorial` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TagToVideoTutorial_AB_unique`(`A`, `B`),
    INDEX `_TagToVideoTutorial_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_ctaProductId_fkey` FOREIGN KEY (`ctaProductId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Work` ADD CONSTRAINT `Work_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Work` ADD CONSTRAINT `Work_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkVersion` ADD CONSTRAINT `WorkVersion_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `Work`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `Work`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `WorkVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoTutorial` ADD CONSTRAINT `VideoTutorial_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestbookMessage` ADD CONSTRAINT `GuestbookMessage_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `GuestbookMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeAsset` ADD CONSTRAINT `KnowledgeAsset_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `KnowledgeSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entitlement` ADD CONSTRAINT `Entitlement_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entitlement` ADD CONSTRAINT `Entitlement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MemberSession` ADD CONSTRAINT `MemberSession_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipPlan` ADD CONSTRAINT `MembershipPlan_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipOrder` ADD CONSTRAINT `MembershipOrder_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipOrder` ADD CONSTRAINT `MembershipOrder_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipOrder` ADD CONSTRAINT `MembershipOrder_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `MembershipPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipOrder` ADD CONSTRAINT `MembershipOrder_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `PromoCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoCode` ADD CONSTRAINT `PromoCode_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PostToTag` ADD CONSTRAINT `_PostToTag_A_fkey` FOREIGN KEY (`A`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PostToTag` ADD CONSTRAINT `_PostToTag_B_fkey` FOREIGN KEY (`B`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToWork` ADD CONSTRAINT `_TagToWork_A_fkey` FOREIGN KEY (`A`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToWork` ADD CONSTRAINT `_TagToWork_B_fkey` FOREIGN KEY (`B`) REFERENCES `Work`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToVideoTutorial` ADD CONSTRAINT `_TagToVideoTutorial_A_fkey` FOREIGN KEY (`A`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToVideoTutorial` ADD CONSTRAINT `_TagToVideoTutorial_B_fkey` FOREIGN KEY (`B`) REFERENCES `VideoTutorial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
