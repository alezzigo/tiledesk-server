var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var GCJobSchema = new Schema(
  {
    teamCode: {
      type: String,
      required: true,
      index: true,
    },
    jobCode: {
      type: String,
      required: false,
    },
    media: {
      type: Array,
      default: [],
    },
    status: {
      type: String,
      default: "Waiting",
      required: true,
      index: true,
    },
    createdBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("gcjobs", GCJobSchema);
