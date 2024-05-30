const listener = require("./listener");

const whatsapp = require("@vmdao/tiledesk-whatsapp-connector");
const whatsappRoute = whatsapp.router;


module.exports = { listener: listener, whatsappRoute: whatsappRoute }