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

// Optional health check route
app.get("/", (req, res) => {
  res.send("Backend is running.");
});

// Setup clients
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Send OTP via SMS
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  try {
    await twilioClient.verify
      .v2.services(process.env.TWILIO_VERIFY_SID)
      .verifications.create({
        to: phone,
        channel: "sms",
      });

    res.json({ status: "OTP sent" });
  } catch (err) {
    console.error("Send OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP and issue JWT
app.post("/verify-otp", async (req, res) => {
  const { phone, code } = req.body;

  try {
    const verification_check = await twilioClient.verify
      .v2.services(process.env.TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phone, code });

    if (verification_check.status === "approved") {
      let { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("phone", phone)
        .single();

      if (!user) {
        const { data: newUser } = await supabase
          .from("users")
          .insert([{ phone }])
          .select()
          .single();
        user = newUser;
      }

      const token = jwt.sign(
        { user_id: user.id, phone },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ verified: true, token });
    } else {
      res.status(400).json({ verified: false, message: "Invalid code" });
    }
  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Dynamic port for Render
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
