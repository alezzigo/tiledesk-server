const GCJobSchema = require("../models/gcjob");
var winston = require("../config/winston");

const handleRequestCloseUserInputJobForm = (userInputResults) => {
  const data = prepareJobValidData(userInputResults);
  console.log(data);
  var gcJob = new GCJobSchema(data);
  return gcJob
    .save()
    .then((res) => {
      console.log(res);
    })
    .catch((err) => {
      winston.error("--- > ERROR ", err);
    });
};

const prepareJobValidData = (data) => {
  const teamCode = data?.userInputTeamCode;
  const jobCode = data?.userInputJobCode;
  const media = [data?.userInputPictureUrl];

  return {
    teamCode,
    jobCode,
    media,
  };
};

var mongoose = require("mongoose");
mongoose
  .connect("mongodb://10.0.88.176:27019/tiledesk")
  .then((res) => {
    handleRequestCloseUserInputJobForm({
      userInputForm: "JOBFORM",
      userInputTeamCode: "T3122",
      userInputJobCode: "J12312",
      userInputPictureUrl: "m12312.jpg",
      userPhone: "9111111",
    })
      .then((res) => console.log(res))
      .catch((e) => console.log(e));
  })
  .catch((e) => console.log(e));
