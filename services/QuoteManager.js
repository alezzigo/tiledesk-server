const { ceil, floor } = require('lodash');
let winston = require('../config/winston');
const requestEvent = require('../event/requestEvent');
const messageEvent = require('../event/messageEvent');
const emailEvent = require('../event/emailEvent');

// const PLANS_LIST = {
//     FREE_TRIAL: { users: 2, requests: 3000, chatbots: 20, kbs: 3, kb_pages: 500, tokens: 250000 }, // same as PREMIUM
//     SANDBOX: { users: 1, requests: 200, chatbots: 2, kbs: 1, kb_pages: 50, tokens: 10000 },
//     BASIC: { users: 1, requests: 810, chatbots: 5, kbs: 2, kb_pages: 250, tokens: 50000 },
//     PREMIUM: { users: 2, requests: 3000, chatbots: 20, kbs: 3, kb_pages: 500, tokens: 250000 },
//     CUSTOM: { users: 100, conversations: 10000, chatbots: 100, kbs: 100, kb_pages: 1000, tokens: 100000 } // manage it --> get limit directly from project info
// }

// const PLANS_LIST = {
//     FREE_TRIAL: { users: 2,     requests: 3000,     chatbots: 20,   kbs: 3,     kb_pages: 500,      tokens: 250000 }, // same as PREMIUM
//     SANDBOX:    { users: 1,     requests: 200,      chatbots: 2,    kbs: 1,     kb_pages: 50,       tokens: 10000 },
//     BASIC:      { users: 1,     requests: 800,      chatbots: 5,    kbs: 2,     kb_pages: 250,      tokens: 50000 },
//     PREMIUM:    { users: 2,     requests: 3000,     chatbots: 20,   kbs: 3,     kb_pages: 500,      tokens: 250000 },
//     CUSTOM:     { users: 2,     requests: 3000,     chatbots: 20,   kbs: 3,     kb_pages: 5000,     tokens: 1000000 }
// }

const PLANS_LIST = {
    FREE_TRIAL: { requests: 3000,   messages: 0,    tokens: 250000,     email: 200 }, // same as PREMIUM
    SANDBOX:    { requests: 200,    messages: 0,    tokens: 10000,      email: 200 },
    BASIC:      { requests: 800,    messages: 0,    tokens: 50000,      email: 200 },
    PREMIUM:    { requests: 3000,   messages: 0,    tokens: 250000,     email: 200 },
    CUSTOM:     { requests: 3000,   messages: 0,    tokens: 250000,     email: 200 }
}

const typesList = ['requests', 'messages', 'email', 'tokens']

let quotes_enabled = true;

class QuoteManager {

    constructor(config) {

        if (!config) {
            throw new Error('config is mandatory')
        }

        if (!config.tdCache) {
            throw new Error('config.tdCache is mandatory')
        }

        this.tdCache = config.tdCache;
        this.project;

    }

    // INCREMENT KEY SECTION - START
    async incrementRequestsCount(project, request) {

        this.project = project;
        let key = await this.generateKey(request, 'requests');
        winston.verbose("[QuoteManager] incrementRequestsCount key: " + key);

        await this.tdCache.incr(key)
        return key;
    }

    async incrementMessagesCount(project, message) {

        this.project = project;
        let key = await this.generateKey(message, 'messages');
        winston.verbose("[QuoteManager] incrementMessagesCount key: " + key);

        await this.tdCache.incr(key)
        return key;
    }

    async incrementEmailCount(project, email) {

        this.project = project;
        let key = await this.generateKey(email, 'email');
        winston.info("[QuoteManager] incrementEmailCount key: " + key);

        await this.tdCache.incr(key)
        return key;
    }

    async incrementTokenCount(project, data) { // ?? cosa passo? il messaggio per vedere la data?

        this.project = project;
        let key = await this.generateKey(data, 'tokens');
        winston.info("[QuoteManager] incrementTokenCount key: " + key);

        if (quotes_enabled === false) {
            winston.debug("QUOTES DISABLED - incrementTokenCount")
            return key;
        }

        await this.tdCache.incrby(key, data.tokens);
        return key;
    }
    // INCREMENT KEY SECTION - END


    async generateKey(object, type) {

        let subscriptionDate;
        if (this.project.profile.subStart) {
            subscriptionDate = this.project.profile.subStart;
        } else {
            subscriptionDate = this.project.createdAt;
        }
        let objectDate = object.createdAt;

        // converts date in timestamps and transform from ms to s
        const objectDateTimestamp = ceil(objectDate.getTime() / 1000);
        const subscriptionDateTimestamp = ceil(subscriptionDate.getTime() / 1000);

        let ndays = (objectDateTimestamp - subscriptionDateTimestamp) / 86400;  // 86400 is the number of seconds in 1 day
        let nmonths = floor(ndays / 30); // number of month to add to the initial subscription date;

        let date = new Date(subscriptionDate);
        date.setMonth(date.getMonth() + nmonths);

        return "quotes:" + type + ":" + this.project._id + ":" + date.toLocaleDateString();
    }

    /**
     * Get current quote for a single type (tokens or request or ...)
     */
    async getCurrentQuote(project, object, type) {

        this.project = project;
        let key = await this.generateKey(object, type);
        winston.verbose("[QuoteManager] getCurrentQuote key: " + key);

        let quote = await this.tdCache.get(key);
        return Number(quote);
    }

    /**
     * Get quotes for a all types (tokens and request and ...)
     */
    async getAllQuotes(project, obj) {

        this.project = project;

        let quotes = {}
        for (let type of typesList) {
            console.log("*** get all quotes --> search for type: ", type);
            let key = await this.generateKey(obj, type);
            console.log("*** get all quotes --> key generated: ", key);
            let quote = await this.tdCache.get(key);
            console.log("*** get all quotes --> quote retrieved: ", quote);

            quotes[type] = {
                quote: Number(quote)
            };
        }
        return quotes;

    }

    /**
     * Perform a check on a single type.
     * Returns TRUE if the limit is not reached --> operation can be performed
     * Returns FALSE if the limit is reached --> operation can't be performed
     */
    async checkQuote(project, object, type) {

        if (quotes_enabled === false) {
            winston.debug("QUOTES DISABLED - checkQuote for type " + type);
            return true;
        }

        this.project = project;
        let limits = await this.getPlanLimits();
        console.log("limits for current plan: ", limits)
        let quote = await this.getCurrentQuote(project, object, type);

        if (quote == null) {
            return true;
        }

        if (quote < limits[type]) {
            return true;
        } else {
            return false;
        }
    }


    async getPlanLimits() {

        let limits;
        if (this.project.profile.type === 'payment') {

            const plan = this.project.profile.name;
            switch (plan) {
                case 'Sandbox':
                    limits = PLANS_LIST.SANDBOX;
                    break;
                case 'Basic':
                    limits = PLANS_LIST.BASIC;
                    break;
                case 'Premium':
                    limits = PLANS_LIST.PREMIUM;
                    break;
                case 'Custom':
                    limits = PLANS_LIST.CUSTOM;
                    break;
                case 'Sandbox':
                    limits = PLANS_LIST.SANDBOX;
                    break;
                case 'Growth':
                    limits = PLANS_LIST.BASIC
                    break;
                case 'Scale':
                    limits = PLANS_LIST.PREMIUM
                    break;
                case 'Plus':
                    limits = PLANS_LIST.CUSTOM
                    break;
                default:
                    limits = PLANS_LIST.FREE_TRIAL;
            }
        } else {
            limits = PLANS_LIST.FREE_TRIAL;
        }
        return limits;
    }



    start() {
        winston.verbose('QuoteManager start');

        if (process.env.QUOTES_ENABLED !== undefined) {
            if (process.env.QUOTES_ENABLED === false || process.env.QUOTES_ENABLED === 'false') {
                quotes_enabled = false;
            }
        }

        // TODO - Try to generalize to avoid repetition
        let incrementEventHandler = (object) => { }
        let checkEventHandler = (object) => { }


        // REQUESTS EVENTS - START
        // requestEvent.on('request.create.quote.before', async (payload) => {
        //     let result = await this.checkQuote(payload.project, payload.request, 'requests');
        //     if (result == true) {
        //         winston.info("Limit not reached - a request can be created")
        //     } else {
        //         winston.info("Requests limit reached for the current plan!")
        //     }
        //     return result;
        // });

        requestEvent.on('request.create.quote', async (payload) => {
            if (quotes_enabled === true) {
                winston.verbose("request.create.quote event catched");
                let result = await this.incrementRequestsCount(payload.project, payload.request);
                return result;
            } else {
                console.log("QUOTES DISABLED - request.create.quote event")
                winston.debug("QUOTES DISABLED - request.create.quote event")
            }
        })
        // REQUESTS EVENTS - END


        // MESSAGES EVENTS - START
        // messageEvent.on('message.create.quote.before', async (payload) => {
        //     let result = await this.checkQuote(payload.project, payload.message, 'messages');
        //     if (result == true) {
        //         winston.info("Limit not reached - a message can be created")
        //     } else {
        //         winston.info("Messages limit reached for the current plan!")
        //     }
        //     return result;
        // })

        messageEvent.on('message.create.quote', async (payload) => {
            if (quotes_enabled === true) {
                winston.verbose("message.create.quote event catched");
                let result = await this.incrementMessagesCount(payload.project, payload.message);
                return result;
            } else {
                winston.debug("QUOTES DISABLED - message.create.quote event")
            }
        })
        // MESSAGES EVENTS - END


        // EMAIL EVENTS - START - Warning! Can't be used for check quote
        // emailEvent.on('email.send.before', async (payload) => {
        //     let result = await this.checkQuote(payload.project, payload.email, 'email');
        //     if (result == true) {
        //         winston.info("Limit not reached - a message can be created")
        //     } else {
        //         winston.info("Email limit reached for the current plan!")
        //     }
        //     return result;
        // })

        emailEvent.on('email.send.quote', async (payload) => {
            if (quotes_enabled === true) {
                winston.info("email.send event catched");
                let result = await this.incrementEmailCount(payload.project, payload.email);
                return result;
            } else {
                winston.debug("QUOTES DISABLED - email.send event")
            }
        })
        // EMAIL EVENTS - END
    }


}

module.exports = { QuoteManager };