
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    /* ---------------------------------------------------------------------- */
    /* USER INFORMATION                                                       */
    /* ---------------------------------------------------------------------- */

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
      required: true,
    },

    verified: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* ---------------------------------------------------------------------- */
    /* EMAIL VERIFICATION AND PASSWORD RESET OTP                              */
    /* ---------------------------------------------------------------------- */

    // Store only the hashed OTP, never the original six-digit code.
    verificationOtpHash: {
      type: String,
      select: false,
    },

    verificationOtpExpiresAt: {
      type: Date,
      select: false,
    },

    verificationOtpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      select: false,
    },

    /* ---------------------------------------------------------------------- */
    /* LOGIN AND PASSWORD SECURITY                                            */
    /* ---------------------------------------------------------------------- */

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* -------------------------------------------------------------------------- */
/* NORMALIZE EMAIL                                                            */
/* -------------------------------------------------------------------------- */

userSchema.pre("validate", function () {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }
});

/* -------------------------------------------------------------------------- */
/* MODEL EXPORTS                                                              */
/* -------------------------------------------------------------------------- */

const User = mongoose.models.User || mongoose.model("User", userSchema);

export { User };
export default User;
