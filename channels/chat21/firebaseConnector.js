'use strict';

var winston = require('../../config/winston');

const MaskData = require("maskdata");

const maskOptions = {
  // Character to mask the data. default value is '*'
  maskWith : "*",
  // If the starting 'n' digits needs to be unmasked
  // Default value is 4
  unmaskedStartDigits : 3, //Should be positive Integer
  //If the ending 'n' digits needs to be unmasked
  // Default value is 1
  unmaskedEndDigits : 3 // Should be positive Integer
  };


var chat21Enabled = process.env.CHAT21_ENABLED;
winston.debug("chat21Enabled: "+chat21Enabled);

if (chat21Enabled && chat21Enabled == "true"){
  // if (chat21Enabled){

      //firestore
      winston.info("Chat21 channel enabled"); 
      var firebaseConfig = require('./firebaseConfig');

      var firebaseConfigFilePath = process.env.FIREBASE_CONFIG_FILE || '../../.firebasekey.json';

      winston.info('FirebaseConnector firebaseConfig.databaseURL: '+ firebaseConfig.databaseUrl);

      var private_key = process.env.FIREBASE_PRIVATE_KEY;

      const maskedprivate_key = MaskData.maskPhone(private_key, maskOptions);

      winston.info('FirebaseConnector private_key: '+ maskedprivate_key);
      // var private_key_masked = private_key.replace(/\d(?=\d{4})/g, "*");
      // winston.info('firebaseConnector private_key:'+ private_key_masked);// <-- TODO obscure it
      
      var client_email = process.env.FIREBASE_CLIENT_EMAIL;
      const maskedclient_email = MaskData.maskEmail(client_email, maskOptions);

      winston.info('FirebaseConnector client_email: '+ maskedclient_email);


      var firebase_project_id = process.env.FIREBASE_PROJECT_ID;
      winston.info('FirebaseConnector firebase_project_id: '+ firebase_project_id);

      // https://stackoverflow.com/questions/41287108/deploying-firebase-app-with-service-account-to-heroku-environment-variables-wit
      var serviceAccount;

      if (!private_key || !client_email) {
        serviceAccount = require(firebaseConfigFilePath);
        winston.debug('FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL not specified, falling back to serviceAccountFromKey from path',firebaseConfigFilePath, serviceAccount);
      }else {
          serviceAccount = {
              "private_key": private_key.replace(/\\n/g, '\n'),
              "client_email": client_email,
              "project_id": firebase_project_id,
            };
            winston.debug('firebase serviceAccount from env', serviceAccount);
      }

      const admin = require('firebase-admin');
      // admin.initializeApp(functions.config().firebase);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: firebaseConfig.databaseURL
      });

      //var firestore = admin.firestore();
      //end firestore



      module.exports = admin;

          
}else { 
  winston.info("Chat21 channel disabled. ATTENTION you must configure and enable it"); 
  module.exports = undefined;
}
