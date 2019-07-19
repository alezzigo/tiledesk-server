var request = require('request');
const botEvent = require('../event/botEvent');
var winston = require('../config/winston');
var jwt = require('jsonwebtoken');
const Faq_kb = require('../models/faq_kb');


class BotSubscriptionNotifier {
   
  
  notify(bot,botWithSecret, payload) {
  
      winston.info("BotSubscriptionNotifier bot", bot.toObject(), 'payload', payload );

      var url = bot.url;

      var json = {timestamp: Date.now(), payload: payload};
    

      json["hook"] = bot;


      var signOptions = {
        issuer:  'https://tiledesk.com',
        subject:  'bot',
        audience:  'https://tiledesk.com/bots/'+bot._id,        
      };

      var token = jwt.sign(bot.toObject(), botWithSecret.secret, signOptions);
      json["token"] = token;

      winston.info("BotSubscriptionNotifier notify json ", json );

          request({
            url: url,
            headers: {
             'Content-Type' : 'application/json',        
              //'x-hook-secret': s.secret
            },
            json: json,
            method: 'POST'

          }, function(err, result, json){            
            winston.info("SENT notify for bot with url" + url +  " with error " + err);
            if (err) {
              winston.error("Error sending notify for bot with url " + url + " with error " + err);
              // next(err, json);
            }
          });
    
}


  start() {
    winston.debug('BotSubscriptionNotifier start');
    //modify to async
    botEvent.on('bot.message.received.notify.external', function(botNotification) {
      var bot = botNotification.bot;
      Faq_kb.findById(bot._id).select('+secret').exec(function (err, botWithSecret){
        if (err) {
          winston.debug('Error getting botWithSecret', err);
        }
        botSubscriptionNotifier.notify(bot, botWithSecret, botNotification.message);
      });
      
    });

    winston.info('BotSubscriptionNotifier started');

  }



};

var botSubscriptionNotifier = new BotSubscriptionNotifier();


module.exports = botSubscriptionNotifier;