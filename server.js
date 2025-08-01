require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Health check route
app.get("/", (req, res) => {
  res.send("✅ Backend is running.");
});

// Setup Twilio and Supabase clients
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Send OTP via SMS
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    await twilioClient.verify
      .v2.services(process.env.TWILIO_VERIFY_SID)
      .verifications.create({ to: phone, channel: "sms" });

    console.log("✅ OTP sent to", phone);
    res.json({ status: "OTP sent" });
  } catch (err) {
    console.error("❌ Send OTP Error:", err.message);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP and create user + JWT
app.post("/verify-otp", async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: "Phone and code are required" });
  }

  console.log("🔍 Verifying code:", code, "for", phone);

  try {
    const verification_check = await twilioClient.verify
      .v2.services(process.env.TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phone, code });

    console.log("✅ Twilio status:", verification_check.status);

    if (verification_check.status !== "approved") {
      console.warn("❌ Invalid verification code");
      return res.status(400).json({ verified: false, message: "Invalid code" });
    }

    // Check if user exists
    const { data: userData, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (selectError) {
      console.error("❌ Supabase Select Error:", selectError);
      return res.status(500).json({ error: "Failed to fetch user" });
    }

    let user = userData;

    // If user does not exist, create them
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert([{ phone }])
        .select()
        .single();

      if (insertError) {
        console.error("❌ Supabase Insert Error:", insertError);
        return res.status(500).json({ error: "Failed to create user" });
      }

      user = newUser;
      console.log("✅ New user created:", user);
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("✅ JWT issued for", phone);
    res.json({ verified: true, token });

  } catch (err) {
    console.error("❌ Verify OTP Error:", err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Port
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
