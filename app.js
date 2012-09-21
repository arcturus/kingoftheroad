var request = require('request');

var END_POINT = 'https://drivetoimprove.co.uk/api/m/TelemetryInfoByType/%SERVICE_ID%?from=%START%&to=%END%&type=1,3,4,25,13,51,52,94';

var getData = function getData(user, pass, service, 
    start, end, onSuccess, onError) {

  var end_point = END_POINT.replace('%SERVICE_ID%', service).
    replace('%START%', start).
    replace('%END%', end);

  var auth = "Basic " + new Buffer(user +
   ":" + pass).toString("base64");

  request({
    url: end_point,
    headers: {
      "Authorization": auth
    }
  }, function requestResult(error, response, body) {
    if (error || response.statusCode != 200) {
      if (onError) {
        onError(error);
      } else {
        onError({'status': response.statusCode});
      }
      return;
    }

    onSuccess(JSON.parse(body));
  });
};

var parseData = function parseData(points) {
  var re1 = new RegExp("(\\d+) (.+)", "ig");
  var re2 = new RegExp("(.+) \\[(.+)\\]", "ig");    
  points.GetTelemetryInfoByTypeResult.forEach(function(point) {    

    var streetName = point.geoStreet;
    var streetSplit = re1.exec(streetName);

    if (streetSplit != null) {
      streetName = streetSplit[2];
    }

    console.log(streetName);

    streetSplit = re2.exec(streetName);

    if (streetSplit != null) {
      //Double road
      var bigRoad = streetSplit[2];
      console.log(bigRoad + " from previous");
    }
  });
}

getData(USER, PASSWORD, SERVICE, '2012-09-10', '2012-09-11', parseData, function(e) {
  console.error(e);
});
