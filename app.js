// ~~~~~~~~~~ FUNCTIONS START ~~~~~~~~~~
//Keeps a running log of time-stamped app events
function logMe(str, boolean) {
  let now = new Date();

  if ( logMe.arguments.length == 1 ) {
    boolean = true;
  }
  const timestamp = boolean;

  if (timestamp) {
    logDetails += (now.getTime() + '|' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString() + '|');
  }
  logDetails += str;
  if (timestamp) {
    logDetails += '|';
  }
}

//Ends the time-stamped log and returns
function endAndReturn(error) {
  if (error) {
    logDetails += err;
  }
  logDetails += 'ENDED';
  console.log(logDetails);
  if (error) {
    sendEmailAlert(
      'email@yourdomain.com',
      ['youremail@gmail.com','youremail@yourcompany.com'],
      'Error occurred!',
      'The following error occurred on this run of the GoogleAnalytics Node App.\n' + err + '\n\n\nThe full log details are as follows...\n' + logDetails + '\n',
      alertSent
    );
  } else {
    //comment this out when you're sick of getting these emails...
    /*sendEmailAlert(
      'email@yourdomain.com',
      ['youremail@gmail.com','youremail@yourcompany.com'],
      'Ran Successfully!',
      'The full log details are as follows...\n' + logDetails + '\n',
      function(err, info) {
        if (err) {
          logMe('\nError, success email did not send.');
          return;
        } else {
          return;
        }
      }
    );*/
    return;
  }
}

//Returns an array that's ready for processing
function ManageableArray(arr) {
  if (!Array.isArray(arr)) {
    endAndReturn('Error: response.body.Results is not an array!');
  } else {
    let results = [];
    for (var i = 0; i < arr.length; i++) {
      let obj = {};
      for (var j = 0; j < arr[i].Properties.Property.length; j++) {
        obj[arr[i].Properties.Property[j].Name] = arr[i].Properties.Property[j].Value;
      }
      results.push(obj);
    }
    return results;
  }
}

//Runs the function that Generates an image for each item in an array
function GenerateImages(arr, dataExtensionName) {
  if (arr.length > 0) {
    GenerateImage(arr[0].VawpLink, arr[0].JobId, dataExtensionName);
  } else {
    logDetails += '|';//I know, this is kinda cheating...
    logMe('Done processing all screenshots!');
    endAndReturn();
  }
}

//Generates a screen shot image
function GenerateImage(url, jobId, dataExtensionName) {
  webshot(
    url,
    var filePath = 'screenshots/' + jobId + '.png';// This is the directory where the screenshots will be saved to. This can be modified.
    {
      screenSize: {
        width: 640,
        height: 480
      },
      shotSize: {
        width: 'window',
        height: 'all'
      },
      quality: 50
    },
    function(err) {
      if (err) {
        endAndReturn('Error generating Job ID ' + jobId + ' screenshot. Error: ' + JSON.stringify(err, null, 2));
      } else {
        // screenshot now saved
        logMe(jobId + ' screenshot created! ', false);
        //Upsert to DE
        upsertRow(jobId);
      }
    }
  );
}

//Marks the row on the Data Extension as processed
function upsertRow(jobId) {
  SoapClient.update(
    "DataExtensionObject",
    {
      "Name": dataExtensionName,
      "Keys": [
        {
          "Key": {
            "Name": "JobId",
            "Value": jobId
          }
        }
      ],
      "Properties": [
        {
          "Property": {
            "Name": "imageGenerated",
            "Value": true
          }
        }
      ]
    },
    {
      SaveOptions: [
        {
          "SaveOption": {
            PropertyName: "DataExtensionObject",
            SaveAction: "UpdateAdd"
          }
        }
      ]
    },
    function(err, response) {
    if(err) {
      endAndReturn('Error updating Job ID ' + jobId + ' row on the ' + dataExtensionName + ' data extension. Error: ' + JSON.stringify(err, null, 2));
    } else {
      // screenshot now saved
      logMe('Row Updated! ', false);
      resultsArray.shift();
      GenerateImages(resultsArray, dataExtensionName);
    }
  });
}

//Sends an email alert if something goes wrong, then runs the callback
function sendEmailAlert(sender, recipients, subject, message, cb) {
  nodemailerMailgun.sendMail({
    from: sender,
    to: recipients,// An array if you have multiple recipients.
    //cc:'second@domain.com',
    //bcc:'secretagent@company.gov',
    subject: 'EmailScreenshots Node App: ' + subject,
    'h:Reply-To': sender,
    //You can use "html:" to send HTML email content. It's magic!
    //html: code,
    //You can use "text:" to send plain-text content. It's oldschool!
    text: message
  },
  cb
  );
}

//Runs if an email alert was sent
function alertSent(err, info) {
  if (err) {
    logMe('\nError, alert email did not send.');
    return;
  } else {
    endAndReturn();
  }
}
// ~~~~~~~~~~ FUNCTIONS END ~~~~~~~~~~

// ~~~~~~~~~~ VARIABLES START ~~~~~~~~~~
const FuelSoap = require('fuel-soap');
const webshot = require('webshot');
const fuelSoapKey = require('./fuelSoapKeys.json');//View the fuelSoapKeys_SAMPLE.json, edit it, and remove '_SAMPLE'
const SoapClient = new FuelSoap(fuelSoapKey);

const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');
const mailgunKey = require('./mailgunKeys.json');//View the mailgunKeys_SAMPLE.json, edit it, and remove '_SAMPLE'
const nodemailerMailgun = nodemailer.createTransport(mg(mailgunKey));

//Start a log of events
let logDetails = '';

let resultsArray = [];

const dataExtensionName = 'VawpLinks';
// ~~~~~~~~~~ VARIABLES END ~~~~~~~~~~

logMe('STARTED');

SoapClient.retrieve(
  'DataExtensionObject[' + dataExtensionName + ']',
  ['JobId', 'DateSent', 'VawpLink', 'ImageGenerated'],
  {
    filter: {
      leftOperand: 'ImageGenerated',
      operator: 'equals',
      rightOperand: false
    }
  },
  function( err, response ) {
    if (err) {
      endAndReturn('Error retrieving ' + dataExtensionName + ' Data: ' + JSON.stringify(err, null, 2));
    } else {
      resultsArray = ManageableArray(response.body.Results);
      if (resultsArray.length > 0) {
        logMe('Processing ' + resultsArray.length + ' ' + dataExtensionName + ' rows.');
        GenerateImages(resultsArray, dataExtensionName);
      } else {
        logMe(resultsArray.length + ' ' + dataExtensionName + ' rows found.');
        endAndReturn();
      }
    }
  }
);
