const express = require("express");
const authController = require("./auth.controller");

const router = express.Router();

router.post("/google", authController.loginWithGoogle);
router.post("/development", authController.loginDevelopmentRole);

module.exports = router;
