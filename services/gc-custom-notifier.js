const winston = require("../config/winston");
const requestEvent = require("../event/requestEvent");
const requestService = require("./requestService");
const { writeFileSync, readFileSync } = require("fs");
const ExcelJS = require("exceljs");
const {
  TemplateHandler,
  createDefaultPlugins,
} = require("easy-template-x");
const { createResolver } = require("easy-template-x-angular-expressions");

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
    try {
      await handleRequestCloseUserInputJobForm(userInputResults);
    } catch (e) {
      winston.error(e);
    }
  }
};

const handleRequestCloseUserInputForm10 = (userInputResults) => {
  const data = prepareValidData(userInputResults);

  const csvOutput = generateFilepath(data.userPhone, data.date, "csv");
  writeCSVFile(data.userInputs, csvOutput);
  winston.debug("gc-custom-notify write csv:" + csvOutput);

  // const templateExcelInput = process.env.USER_INPUT_FORM_TEMPLATE_EXCEL;
  // const excelOutput = generateFilepath(data.userPhone, data.date, "xlsx");
  // writeExcelFile(data.userInputs, templateExcelInput, excelOutput);

  const templateWordFileInput = process.env.USER_INPUT_FORM_TEMPLATE_WORD;
  const wordFileOutput = generateFilepath(data.userPhone, data.date, "docx");
  writeWordFile(data.userInputs, templateWordFileInput, wordFileOutput);

  winston.debug("gc-custom-notify write to template:" + wordFileOutput);
};

const handleRequestCloseUserInputJobForm = (userInputResults) => {
  console.log("handleRequestCloseUserInputJobForm", userInputResults);
  const data = prepareJobValidData(userInputResults);
  console.log("data", data);

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
  const userInputFiles = data?.userInputFiles || "";
  const files = userInputFiles
    .split(",")
    .filter((f) => f)
    .map((f) => {
      const [url, caption] = f.split("::");
      return {
        url,
        caption,
      };
    });

  return {
    teamCode,
    jobCode,
    files,
    description: userInputFiles,
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

const writeWordFile = async (data, input, output) => {
  const templateFile = readFileSync(input);
  const handler = new TemplateHandler({
    plugins: createDefaultPlugins(),
    scopeDataResolver: createResolver({
      angularFilters: {
        upper: (input) => (input || "").toUpperCase(),
        lower: (input) => (input || "").toLowerCase(),
        date: (input) => {
          try {
            return new Date(input || "").toISOString();
          } catch (error) {
            return "";
          }
        },
      },
    }),
  });
  const doc = await handler.process(templateFile, data);
  writeFileSync(output, doc);
};

class GcCustomNotifier {
  listen() {
    requestEvent.on("request.close", handleRequestClose);
  }
}

const gcCustomNotifier = new GcCustomNotifier();
module.exports = gcCustomNotifier;
