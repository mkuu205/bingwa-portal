CREATE TABLE `commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`commandType` varchar(80) NOT NULL,
	`payload` json,
	`status` enum('QUEUED','DELIVERED','ACKNOWLEDGED','EXECUTING','SUCCEEDED','FAILED','EXPIRED') NOT NULL DEFAULT 'QUEUED',
	`requestedBy` int,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` datetime,
	`executedAt` datetime,
	`resultMessage` text,
	`expiresAt` datetime,
	CONSTRAINT `commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`deviceName` varchar(160) NOT NULL,
	`model` varchar(160),
	`manufacturer` varchar(120),
	`androidVersion` varchar(40),
	`sdkVersion` varchar(40),
	`appVersion` varchar(80),
	`appBuild` varchar(40),
	`phoneNumber` varchar(40),
	`simSlot` int,
	`subscriptionId` int,
	`carrierName` varchar(120),
	`iccId` varchar(160),
	`automationSimConfigured` int NOT NULL DEFAULT 0,
	`status` enum('pending','online','idle','offline','blocked') NOT NULL DEFAULT 'pending',
	`lastHeartbeatAt` datetime,
	`lastSyncAt` datetime,
	`enrollmentTokenHash` varchar(128),
	`enrolledAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceKey` varchar(100) NOT NULL,
	`serviceName` varchar(160) NOT NULL,
	`description` text,
	`status` enum('OPERATIONAL','DEGRADED','OUTAGE','MAINTENANCE') NOT NULL DEFAULT 'OPERATIONAL',
	`lastCheckedAt` datetime,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_serviceKey_unique` UNIQUE(`serviceKey`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int,
	`storeName` varchar(180) NOT NULL,
	`ownerPhone` varchar(40),
	`planName` varchar(120) NOT NULL,
	`status` enum('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'TRIAL',
	`tokenBalance` int NOT NULL DEFAULT 0,
	`renewalAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`payload` json,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`accepted` int NOT NULL DEFAULT 1,
	`rejectionReason` text,
	CONSTRAINT `sync_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int,
	`androidTransactionId` varchar(128),
	`executionId` varchar(128),
	`operationId` varchar(160),
	`customerName` varchar(180),
	`phoneNumber` varchar(40) NOT NULL,
	`packageName` varchar(160) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`paymentMethod` enum('MPESA','AIRTEL_MONEY','AIRTIME','OTHER'),
	`status` enum('PENDING','PROCESSING','COMPLETED','FAILED','WAITING') NOT NULL DEFAULT 'PENDING',
	`verificationStatus` enum('NOT_REQUIRED','PENDING','VERIFIED','FAILED'),
	`verificationMessage` text,
	`receiptCode` varchar(120),
	`issue` text,
	`executedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
