function LogMe(str) {
  console.log( new Date().getTime() + ' | ' + str )
}

function ManageableArray(arr) {
  if (!Array.isArray(arr)) {
    logMe('Error: ' + arr + ' is not an array!');
  };
  var resultingArray = [];
  for (var i = 0; i < arr.length; i++) {
    var resultingObject = {};
    for (var j = 0; j < arr[i].Properties.Property.length; j++) {
      resultingObject[arr[i].Properties.Property[j].Name] = arr[i].Properties.Property[j].Value;
    }
    resultingArray.push(resultingObject);
  }
  return resultingArray;
}

function GenerateImage(url, jobId, dataExtensionName) {
	/* Webshot options can be found here...
	https://github.com/brenden/node-webshot#options */
  var options = {
    screenSize: {
      width: 640,
      height: 480
    },
    shotSize: {
      width: 'window',
      height: 'all'
    },
    quality: 50
  };
  var filePath = 'screenshots/' + jobId + '.png';// This is the directory where the screenshots will be saved to. This can be modified.

  webshot(url, filePath, options, function(err) {
    if (err) {
      LogMe('WebShot Error: ' + err);
    } else {
      // screenshot now saved
      LogMe('Image ' + filePath + ' Created!');

      //UPSERT DE
      var co = {
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
      };
      var uo = {
        SaveOptions: [
          {
            "SaveOption": {
              PropertyName: "DataExtensionObject",
              SaveAction: "UpdateAdd"
            }
          }
        ]
      };

      SoapClient.update("DataExtensionObject", co, uo, function(err, response) {
        if(err) {
          LogMe('Data Extension Update Error: ' + err);
        }
        else {
          LogMe('Job ID ' + jobId + ' row updated!');
          LogMe( JSON.stringify(response.body.Results, null, 2) );
        }
      });
    }
  });
}

function GenerateImages(arr, dataExtensionName) {
  for (var i = 0; i < arr.length; i++) {
    GenerateImage(arr[i].VawpLink, arr[i].JobId, dataExtensionName);
  }
}

var FuelSoap = require('fuel-soap'),
    webshot = require('webshot');

/* This requires an app created in App Center, more info here...
https://developer.salesforce.com/docs/atlas.en-us.noversion.mc-apis.meta/mc-apis/getting_started_developers_and_the_exacttarget_api.htm
...and here...
https://developer.salesforce.com/docs/atlas.en-us.mc-getting-started.meta/mc-getting-started/app-center.htm */
var fuelSoapOptions = {
  auth: {
    clientId: '[CLIENT_ID_GOES_HERE]',
    clientSecret: '[CLIENT_SECRET_GOES_HERE]'
  },
  soapEndpoint: 'https://webservice.s7.exacttarget.com/Service.asmx'
};

var dataExtensionObjectName = 'VawpLinks';
var vawpLinksOptions = {
  filter: {
    leftOperand: 'ImageGenerated',
    operator: 'equals',
    rightOperand: false
  }
};

LogMe('Started process');

var SoapClient = new FuelSoap(fuelSoapOptions);

SoapClient.retrieve(
  'DataExtensionObject[' + dataExtensionObjectName + ']',
  ['JobId', 'DateSent', 'VawpLink', 'ImageGenerated'],
  vawpLinksOptions,
  function( err, response ) {
    if ( err ) {
      LogMe('Data Extension Retrieve Error: ' + err);
      return;
    }

    LogMe( '"' + dataExtensionObjectName + '" Data Extension Results: ' + JSON.stringify(ManageableArray(response.body.Results), null, 2) );
    GenerateImages(ManageableArray(response.body.Results), dataExtensionObjectName);
  }
);
