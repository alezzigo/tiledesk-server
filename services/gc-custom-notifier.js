var winston = require("../config/winston");
const requestEvent = require("../event/requestEvent");
const requestService = require("./requestService");
const { writeFileSync } = require("fs");
const ExcelJS = require("exceljs");
const { get } = require("axios");
const sizeOf = require("buffer-image-size");
const GCJobSchema = require("../models/gcjob");

const handleRequestClose = async (data) => {
  const userInputResults = await requestService.getRequestParametersFromChatbot(
    data.request_id
  );
  if (!userInputResults["userInputForm"]) {
    return;
  }
  winston.info(
    "gc-custom-notify userInputForm: " + userInputResults["userInputForm"]
  );

  if (userInputResults["userInputForm"] === "FORM10") {
    await handleRequestCloseUserInputForm10(userInputResults);
  }

  if (userInputResults["userInputForm"] === "JOB_FORM") {
    await handleRequestCloseUserInputJobForm(userInputResults);
  }
};

const handleRequestCloseUserInputForm10 = (userInputResults) => {
  const data = prepareValidData(userInputResults);

  const csvOutput = generateFilepath(data.userPhone, data.date, "csv");
  writeCSVFile(data.userInputs, csvOutput);
  winston.debug("gc-custom-notify write csv:" + csvOutput);

  const templateExcelInput = process.env.USER_INPUT_FORM_TEMPLATE_EXCEL;
  const excelOutput = generateFilepath(data.userPhone, data.date, "xlsx");
  writeExcelFile(data.userInputs, templateExcelInput, excelOutput);
  winston.debug("gc-custom-notify write excel:" + excelOutput);
};

const handleRequestCloseUserInputJobForm = (userInputResults) => {
  const data = prepareJobValidData(userInputResults);

  var gcJob = new GCJobSchema(data);
  return gcJob
    .save()
    .then((res) => {
      console.log(res);
      winston.debug("gc-custom-notify saved");
    })
    .catch((err) => {
      winston.error("--- > ERROR ", err);
    });
};

const generateFilepath = (subfix, date, ext) => {
  return (
    "./logs/form-" +
    subfix +
    "_" +
    (date.getMonth() + 1) +
    "-" +
    date.getDate() +
    "-" +
    date.getHours() +
    "-" +
    date.getMinutes() +
    "." +
    ext
  );
};

const prepareJobValidData = (data) => {
  const teamCode = data?.userInputTeamCode;
  const jobCode = data?.userInputJobCode;
  const media = data?.userInputMedia;

  return {
    teamCode,
    jobCode,
    media,
  };
};

const prepareValidData = (data) => {
  const date = new Date();
  const userPhone = data?.userLeadId ?? data?.userPhone ?? "";
  const userInputs = Object.keys(data)
    .filter((k) => k.includes("userInput"))
    .reduce((c, n) => {
      c[n] = data[n];
      return c;
    }, {});
  return {
    date,
    userPhone,
    userInputs,
  };
};

const writeCSVFile = (data, output) => {
  const colNames = Object.keys(data);
  const bodyCols = colNames.map((colName) => data[colName]);
  const content = `${colNames.join(",")}\n ${bodyCols.join(",")}`;

  writeFileSync(output, content, { unicode: "utf8" });
};

const writeExcelFile = async (data, input, output) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input);
  const worksheet = workbook.getWorksheet("Sheet1");

  if (!worksheet) {
    return;
  }

  const date = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedDate = formatter.format(date);

  worksheet.getCell("B15").value = data["userInputFullname"] ?? "";
  worksheet.getCell("B18").value = data["userInputPassportNumber"] ?? "";
  worksheet.getCell("D15").value = data["userInputBirthday"] ?? "";
  worksheet.getCell("D16").value = data["userInputExpectedSalary"] ?? "";
  worksheet.getCell("D17").value = data["userInputPhone"] ?? "";
  worksheet.getCell("D9").value = formattedDate;

  const imageUrl =
    typeof data["userInputPictureUrl"] === "string"
      ? data["userInputPictureUrl"]
      : false;

  if (imageUrl) {
    const { data: buffer } = await get(imageUrl, {
      responseType: "arraybuffer",
    });
    const size = sizeOf(buffer);

    if (["png", "jpg"].includes(size.type)) {
      const maxHeight = 120;
      const ratio = maxHeight / size.height;

      const ext = {
        width: size.width * ratio,
        height: size.height * ratio,
      };

      const imageId = workbook.addImage({
        buffer: buffer,
        extension: size.type,
      });

      worksheet.addImage(imageId, {
        tl: { col: 3, row: 3 },
        ext: ext,
      });
    }
  }

  workbook.xlsx.writeFile(output);
};

class GcCustomNotifier {
  listen() {
    requestEvent.on("request.close", handleRequestClose);
  }
}

const gcCustomNotifier = new GcCustomNotifier();
module.exports = gcCustomNotifier;
