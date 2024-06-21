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
    files: {
      type: Array,
      default: [],
    },
    description: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: "Waiting",
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
