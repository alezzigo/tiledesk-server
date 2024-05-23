var winston = require('../config/winston');
const requestEvent = require("../event/requestEvent");
const requestService = require('./requestService');
const { writeFileSync } = require('fs');

class GcCustomNotifier {
    listen() {

        requestEvent.on("request.close", function (data) {
            winston.debug("gc-custom-notify request_id: " + data?.request_id);
            requestService.getRequestParametersFromChatbot(data.request_id).then(userInputResult => {
                const colNames = Object.keys(userInputResult).filter(k => k.includes('userInput'));
                if (colNames.length < 0) {
                    return
                }

                if (!userInputResult['userInputForm']) {
                    return
                }
                winston.debug("gc-custom-notify userInputForm: " + userInputResult['userInputForm']);

                const bodyCols = colNames.map(colName => userInputResult[colName]);
                const csvStr = `${colNames.join(',')}\n ${bodyCols.join(',')}`

                const date = new Date();
                const name = userInputResult?.userLeadId ?? userInputResult?.userPhone;
                const filepath = './logs/form-' + name + '_' + (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getHours() + '-' + date.getMinutes() + '.csv';

                writeFileSync(filepath, csvStr, { unicode: 'utf8' });
                winston.debug("gc-custom-notify write:" + filepath);
            })
        });
    }
}

const gcCustomNotifier = new GcCustomNotifier();

module.exports = gcCustomNotifier;
