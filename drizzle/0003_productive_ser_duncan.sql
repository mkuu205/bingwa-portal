CREATE INDEX `commands_poll_idx` ON `commands` (`deviceId`,`status`,`requestedAt`);--> statement-breakpoint
CREATE INDEX `commands_result_idx` ON `commands` (`deviceId`,`id`,`status`);--> statement-breakpoint
CREATE INDEX `devices_enrollment_lookup_idx` ON `devices` (`deviceId`,`enrollmentTokenHash`);--> statement-breakpoint
CREATE INDEX `devices_heartbeat_idx` ON `devices` (`status`,`lastHeartbeatAt`);--> statement-breakpoint
CREATE INDEX `subscriptions_device_idx` ON `subscriptions` (`deviceId`,`status`);--> statement-breakpoint
CREATE INDEX `sync_events_device_idx` ON `sync_events` (`deviceId`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `transactions_search_idx` ON `transactions` (`phoneNumber`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `transactions_device_idx` ON `transactions` (`deviceId`,`createdAt`);