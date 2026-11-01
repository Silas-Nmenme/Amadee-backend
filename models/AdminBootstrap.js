import mongoose from "mongoose";

const adminBootstrapSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "initial-admin",
    },
    claimToken: {
      type: String,
      select: false,
    },
    claimExpiresAt: {
      type: Date,
    },
    usedAt: {
      type: Date,
    },
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "admin_bootstrap",
  }
);

adminBootstrapSchema.statics.claimInitialAdmin = async function (
  claimToken,
  claimExpiresAt
) {
  try {
    const claim = await this.findOneAndUpdate(
      {
        _id: "initial-admin",
        usedAt: { $exists: false },
        $or: [
          { claimExpiresAt: { $exists: false } },
          { claimExpiresAt: { $lte: new Date() } },
        ],
      },
      {
        $set: { claimToken, claimExpiresAt },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).select("+claimToken");

    return claim?.claimToken === claimToken;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
};

adminBootstrapSchema.statics.releaseInitialAdminClaim = function (
  claimToken
) {
  return this.updateOne(
    {
      _id: "initial-admin",
      claimToken,
      usedAt: { $exists: false },
    },
    {
      $unset: {
        claimToken: 1,
        claimExpiresAt: 1,
      },
    }
  );
};

adminBootstrapSchema.statics.consumeInitialAdminClaim = async function (
  claimToken,
  adminUserId
) {
  const result = await this.updateOne(
    {
      _id: "initial-admin",
      claimToken,
      usedAt: { $exists: false },
    },
    {
      $set: {
        usedAt: new Date(),
        adminUserId,
      },
      $unset: {
        claimToken: 1,
        claimExpiresAt: 1,
      },
    }
  );

  return result.modifiedCount === 1;
};

const AdminBootstrap =
  mongoose.models.AdminBootstrap ||
  mongoose.model("AdminBootstrap", adminBootstrapSchema);

export { AdminBootstrap };
export default AdminBootstrap;
