const fs = require("fs");
const path = require("path");

const runtimeFiles = [
  "server/src/services/settings.service.js",
  "server/src/repositories/settings.repository.js",
  "server/src/routes/settings.routes.js",
  "server/src/modules/notifications/notificationPreferenceUtils.js",
  "server/src/modules/notifications/notification.service.js",
  "server/src/modules/notifications/notification.repository.js",
  "client/src/features/settings/settingsService.js",
];

const forbiddenPatterns = [
  "legacyPreferenceSource",
  "legacyEnabledRuleCodes",
  "legacyChannels",
  'source: "legacy"',
  "source === \"legacy\"",
  "source === 'legacy'",
];

const fileSpecificForbiddenPatterns = {
  "server/src/services/settings.service.js": [
    "enabled_notification_rule_codes_json",
    "notification_channels_json",
  ],
  "server/src/repositories/settings.repository.js": [
    "enabled_notification_rule_codes_json",
    "notification_channels_json",
  ],
  "server/src/modules/notifications/notification.service.js": [
    "enabled_notification_rule_codes_json",
    "notification_channels_json",
  ],
  "server/src/modules/notifications/notification.repository.js": [
    "enabled_notification_rule_codes_json",
    "notification_channels_json",
  ],
};

const violations = [];

for (const relativePath of runtimeFiles) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const patterns = [
    ...forbiddenPatterns,
    ...(fileSpecificForbiddenPatterns[relativePath] || []),
  ];

  for (const pattern of patterns) {
    if (source.includes(pattern)) {
      violations.push({
        file: relativePath,
        pattern,
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Modern-only notification preference check failed.");
  violations.forEach((violation) => {
    console.error(`- ${violation.file}: contains "${violation.pattern}"`);
  });
  process.exitCode = 1;
} else {
  console.log("Modern-only notification preference check passed.");
}
